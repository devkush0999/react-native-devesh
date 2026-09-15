import { describe, expect, it, vi } from 'vitest';
import { emptySnapshot, snapshotSchema } from '../../domain/models';
import { MAX_TRANSCRIPT_LENGTH, VOICE_SAMPLE_RATE, splitTranscript } from '../../domain/voice';
import { LocalAIEngine, type AIAdapter } from '../ai/engine.core';
import { AudioQueue } from './audioQueue';
import type { SpeechSession, VoiceAdapter } from './adapter.types';
import { VoiceController, parseInsights } from './controller';

function fixture() {
  const speech: SpeechSession = {
    detect: vi.fn(async () => [{ start: 0, end: 1 }]),
    transcribe: vi.fn(async () => 'A spoken thought.'),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const microphone = { stop: vi.fn(async () => {}) };
  let feed!: (audio: Float32Array) => void;
  let microphoneError!: (error: Error) => void;
  const output = {
    synthesize: vi.fn(async function* () {
      yield { audio: new Float32Array(16), sampleRate: 24000 };
    }),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const adapter: VoiceAdapter = {
    supported: true,
    prepare: vi.fn(async () => {}),
    requestPermission: vi.fn(async () => {}),
    capture: vi.fn(async (onAudio, onError) => {
      feed = onAudio;
      microphoneError = onError;
      return microphone;
    }),
    speech: vi.fn(async () => speech),
    output: vi.fn(async () => output),
    play: vi.fn(async () => {}),
  };
  const text: AIAdapter = {
    prepare: vi.fn(async () => {}),
    create: vi.fn(async () => ({
      send: vi.fn(async () => 'A helpful answer.'),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
  };
  const engine = new LocalAIEngine(text);
  const controller = new VoiceController(adapter, engine);
  return {
    controller,
    adapter,
    speech,
    microphone,
    output,
    engine,
    text,
    feed: (seconds = 1) => feed(new Float32Array(VOICE_SAMPLE_RATE * seconds)),
    fail: (error: Error) => microphoneError(error),
  };
}

describe('bounded audio queue', () => {
  it('preserves sample order including final partial frames', async () => {
    const queue = new AudioQueue();
    queue.push(new Float32Array([1, 2]));
    queue.push(new Float32Array([3]));
    queue.close();
    const frames: number[] = [];
    for await (const frame of queue.read()) frames.push(...frame);
    expect(frames).toEqual([1, 2, 3]);
    expect(queue.pendingSeconds).toBe(0);
  });
  it('fails explicitly on overflow without dropping previously accepted audio', async () => {
    const queue = new AudioQueue(4);
    queue.push(new Float32Array([1, 2, 3]));
    expect(() => queue.push(new Float32Array([4, 5]))).toThrow('could not keep up');
    queue.close();
    const frames = [];
    for await (const frame of queue.read()) frames.push(...frame);
    expect(frames).toEqual([1, 2, 3]);
  });
  it('unblocks the waiting consumer on cancellation', async () => {
    const queue = new AudioQueue();
    const reader = queue.read();
    const next = reader.next();
    queue.close(true);
    await expect(next).resolves.toMatchObject({ done: true });
  });
});

describe('voice lifecycle and privacy', () => {
  it('does not open the microphone after cancelling its permission prompt', async () => {
    const f = fixture();
    let grant!: () => void;
    f.adapter.requestPermission = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          grant = resolve;
        }),
    );
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.adapter.requestPermission).toHaveBeenCalled());
    f.controller.cancel();
    grant();
    await recording;
    expect(f.adapter.capture).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().status).toBe('idle');
  });
  it('cancels during health preflight before allocating speech models', async () => {
    const f = fixture();
    let checked!: () => void;
    const engine = new LocalAIEngine(f.text, {
      before: (kind) =>
        kind === 'voice'
          ? new Promise<void>((resolve) => {
              checked = resolve;
            })
          : Promise.resolve(),
      phase: () => {},
      after: () => {},
    });
    const controller = new VoiceController(f.adapter, engine);
    await controller.prepare('speech');
    const recording = controller.record('note', 'en');
    await vi.waitFor(() => expect(checked).toBeTypeOf('function'));
    controller.cancel();
    checked();
    await recording;
    expect(f.adapter.speech).not.toHaveBeenCalled();
    expect(f.adapter.capture).not.toHaveBeenCalled();
  });
  it('drains the final audio callback emitted while the microphone is stopping', async () => {
    const f = fixture();
    let didFlush = false;
    f.microphone.stop = vi.fn(async () => {
      if (!didFlush) {
        didFlush = true;
        f.feed(0.25);
      }
    });
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed();
    f.controller.finish();
    await recording;
    const captured = vi.mocked(f.speech.transcribe).mock.calls[0]![0];
    expect(captured.length).toBe(VOICE_SAMPLE_RATE * 1.25);
    expect(f.controller.getSnapshot().durationSeconds).toBe(1.25);
  });
  it('clears retained draft text when vault erasure interrupts active voice work', async () => {
    const f = fixture();
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed(8);
    await vi.waitFor(() => expect(f.controller.getSnapshot().transcript).not.toBe(''));
    f.controller.clear();
    await recording;
    expect(f.controller.getSnapshot()).toMatchObject({
      transcript: '',
      summary: '',
      answer: '',
      tasks: [],
      status: 'idle',
    });
  });
  it('requires explicit speech setup without asking for microphone access', async () => {
    const { controller, adapter } = fixture();
    await controller.record('note', 'en');
    expect(adapter.requestPermission).not.toHaveBeenCalled();
    expect(controller.getSnapshot().error).toContain('speech pack');
  });
  it('keeps a completed transcript and disposes speech before generating or speaking an answer', async () => {
    const f = fixture();
    await f.engine.prepare();
    await f.controller.prepare('speech');
    await f.controller.prepare('en');
    const recording = f.controller.record('assistant', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed(2);
    f.controller.finish();
    await recording;
    expect(f.controller.getSnapshot().transcript).toBe('A spoken thought.');
    expect(f.controller.getSnapshot().answer).toBe('A helpful answer.');
    expect(f.adapter.play).toHaveBeenCalledOnce();
    expect(vi.mocked(f.speech.dispose).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(f.text.create).mock.invocationCallOrder[0]!,
    );
    expect(f.output.dispose).toHaveBeenCalledOnce();
  });
  it('does not transcribe silence, and detection-only mode never loads transcription', async () => {
    const f = fixture();
    f.speech.detect = vi.fn(async () => []);
    await f.controller.prepare('speech');
    const recording = f.controller.record('activity', 'hi');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed();
    f.controller.finish();
    await recording;
    expect(f.adapter.speech).toHaveBeenCalledWith(false);
    expect(f.speech.transcribe).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().speechDetected).toBe(false);
  });
  it('does not dispose a runner until an active transcription settles after cancellation', async () => {
    const f = fixture();
    let finish!: (text: string) => void;
    f.speech.transcribe = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await f.controller.prepare('speech');
    const recording = f.controller.record('dictation', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed(8);
    await vi.waitFor(() => expect(f.speech.transcribe).toHaveBeenCalled());
    f.controller.cancel();
    expect(f.speech.stop).toHaveBeenCalled();
    expect(f.speech.dispose).not.toHaveBeenCalled();
    finish('A cancelled partial.');
    await recording;
    expect(f.speech.dispose).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().transcript).toBe('');
  });
  it('cancels during model loading without ever opening the microphone', async () => {
    const f = fixture();
    let finish!: (speech: SpeechSession) => void;
    f.adapter.speech = vi.fn(
      () =>
        new Promise<SpeechSession>((resolve) => {
          finish = resolve;
        }),
    );
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.adapter.speech).toHaveBeenCalled());
    f.controller.cancel();
    finish(f.speech);
    await recording;
    expect(f.adapter.capture).not.toHaveBeenCalled();
    expect(f.speech.dispose).toHaveBeenCalledOnce();
  });
  it('holds the shared engine lock throughout microphone capture', async () => {
    const f = fixture();
    await f.engine.prepare();
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    await expect(f.engine.generate('system', 'other job', () => {})).rejects.toThrow(
      'already working',
    );
    f.controller.cancel();
    await recording;
  });
  it('surfaces microphone interruption while preserving completed audio for review', async () => {
    const f = fixture();
    await f.controller.prepare('speech');
    const recording = f.controller.record('note', 'en');
    await vi.waitFor(() => expect(f.controller.getSnapshot().status).toBe('recording'));
    f.feed(2);
    f.fail(new Error('Audio was interrupted'));
    await recording;
    expect(f.controller.getSnapshot().error).toContain('interrupted');
    expect(f.controller.getSnapshot().transcript).toBe('A spoken thought.');
  });
  it('does not mark aborted model downloads as ready', async () => {
    const f = fixture();
    let finish!: () => void;
    f.adapter.prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const setup = f.controller.prepare('speech');
    await vi.waitFor(() => expect(f.adapter.prepare).toHaveBeenCalled());
    f.controller.cancel();
    finish();
    await setup;
    expect(f.controller.getSnapshot().ready.speech).toBe(false);
  });
});

describe('meeting data integrity', () => {
  it('processes every transcript chunk and deduplicates actions across chunks', async () => {
    const f = fixture();
    const prompts: string[] = [];
    f.text.create = vi.fn(async () => ({
      send: async (prompt: string) => {
        prompts.push(prompt);
        return JSON.stringify({
          summary: 'A project update.',
          tasks: [{ title: 'Send the update', priority: 'medium', dueDate: null }],
        });
      },
      stop: () => {},
      dispose: () => {},
    }));
    await f.engine.prepare();
    const transcript = 'Start of meeting. ' + 'Discussion '.repeat(450) + ' Final decision.';
    f.controller.editTranscript(transcript);
    await f.controller.summarize(transcript, 'en');
    const excerpts = prompts.map((prompt) => JSON.parse(prompt.split('EXCERPT: ')[1]!));
    expect(excerpts.join('')).toBe(transcript);
    expect(f.controller.getSnapshot().tasks).toHaveLength(1);
    expect(f.controller.getSnapshot().transcript).toBe(transcript);
  });
  it('migrates existing encrypted snapshots without losing notes', () => {
    const { voiceNotes: _voiceNotes, ...old } = emptySnapshot;
    expect(snapshotSchema.parse(old).voiceNotes).toEqual([]);
  });
  it('chunks the entire input, preserving Unicode without silent truncation', () => {
    const input = 'मेरी meeting 🧑‍💻 tomorrow. '.repeat(500);
    const parts = splitTranscript(input);
    expect(parts.join('')).toBe(input);
    expect(parts.every((part) => part.length <= 2000)).toBe(true);
    expect(splitTranscript('a'.repeat(MAX_TRANSCRIPT_LENGTH)).join('')).toHaveLength(
      MAX_TRANSCRIPT_LENGTH,
    );
  });
  it('rejects invalid dates and unbounded model output before suggesting actions', () => {
    expect(() =>
      parseInsights(
        '{"summary":"Call","tasks":[{"title":"Call","priority":"high","dueDate":"2026-02-30"}]}',
      ),
    ).toThrow();
    expect(() => parseInsights(JSON.stringify({ summary: 'a'.repeat(1201), tasks: [] }))).toThrow();
    expect(
      parseInsights('```json\n{"summary":"Discussed milestones.","tasks":[]}\n```').summary,
    ).toBe('Discussed milestones.');
  });
});
