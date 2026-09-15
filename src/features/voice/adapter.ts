import { AppState } from 'react-native';
import Constants from 'expo-constants';
import type { KokoroTtsModel, WhisperSttModel, WhisperSpeechToText } from 'react-native-executorch';
import { VOICE_SAMPLE_RATE, type VoiceLanguage } from '../../domain/voice';
import { AIInterruptedError } from '../ai/engine.core';
import type { VoiceAdapter } from './adapter.types';

let speechModel: WhisperSttModel | null = null;
const outputModels: Partial<Record<VoiceLanguage, KokoroTtsModel<string>>> = {};
const voices = { en: 'af_heart', hi: 'hf_alpha' } as const;

function checkActive(signal?: AbortSignal) {
  if (signal?.aborted || AppState.currentState !== 'active')
    throw new AIInterruptedError('Voice stopped. Keep Saathi open and try again.');
}

export const voiceAdapter: VoiceAdapter = {
  supported: Constants.appOwnership !== 'expo',
  async prepare(pack, signal, onProgress) {
    const runtime = await import('react-native-executorch');
    runtime.setTelemetryEnabled(false);
    if (pack === 'speech') {
      speechModel = await runtime.download(runtime.models.speechToText.WHISPER.TINY.XNNPACK_FP32, { signal, onProgress });
    } else {
      const config = pack === 'en'
        ? runtime.models.textToSpeech.KOKORO.EN_US.XNNPACK_FP32
        : runtime.models.textToSpeech.KOKORO.HI.XNNPACK_FP32;
      const selected = config as KokoroTtsModel<string>;
      outputModels[pack] = await runtime.download({ ...selected, voices: { [voices[pack]]: selected.voices[voices[pack]]! } }, { signal, onProgress });
    }
  },
  async requestPermission() {
    const { AudioManager } = await import('react-native-audio-api');
    if (await AudioManager.requestRecordingPermissions() !== 'Granted')
      throw new AIInterruptedError('Microphone access is off. Enable it for Saathi in your phone settings to record.');
  },
  async capture(onAudio, onError, signal) {
    const { AudioRecorder, AudioManager } = await import('react-native-audio-api');
    checkActive(signal);
    const recorder = new AudioRecorder();
    AudioManager.setAudioSessionOptions({ iosCategory: 'record', iosMode: 'measurement', iosOptions: ['allowBluetoothHFP'], iosNotifyOthersOnDeactivation: true });
    AudioManager.observeAudioInterruptions('gainTransient');
    const interruption = AudioManager.addSystemEventListener('interruption', ({ type }) => {
      if (type === 'began') onError(new Error('Audio was interrupted. Review the completed transcript and start a new recording.'));
    });
    const route = AudioManager.addSystemEventListener('routeChange', ({ reason }) => {
      if (reason === 'OldDeviceUnavailable' || reason === 'NoSuitableRouteForCategory')
        onError(new Error('The microphone connection changed. Reconnect it and start a new recording.'));
    });
    let stopped = false;
    let stopping: Promise<void> | null = null;
    const stop = () => {
      if (stopping) return stopping;
      stopped = true;
      stopping = (async () => {
        try { await recorder.stop(); }
        finally {
          recorder.clearOnAudioReady(); recorder.clearOnError();
          interruption.remove(); route.remove();
          AudioManager.observeAudioInterruptions(false);
          await AudioManager.setAudioSessionActivity(false);
        }
      })();
      return stopping;
    };
    try {
      recorder.onError(() => onError(new Error('The microphone stopped unexpectedly. Try recording again.')));
      const callback = recorder.onAudioReady({ sampleRate: VOICE_SAMPLE_RATE, bufferLength: 1600, channelCount: 1 }, ({ buffer, numFrames }) => {
        if (stopped || signal.aborted) return;
        if (buffer.sampleRate !== VOICE_SAMPLE_RATE || buffer.numberOfChannels !== 1) {
          onError(new Error('This audio route cannot provide 16 kHz mono audio. Try the phone microphone.')); return;
        }
        onAudio(buffer.getChannelData(0).slice(0, numFrames));
      });
      if (callback.status === 'error') throw new Error('Could not configure the microphone.');
      await AudioManager.setAudioSessionActivity(true);
      checkActive(signal);
      const result = await recorder.start();
      if (result.status === 'error') throw new Error('Could not start the microphone.');
      checkActive(signal);
      return { stop };
    } catch (error) { await stop(); throw error; }
  },
  async speech(transcription) {
    if (!speechModel) throw new AIInterruptedError('Download the speech pack first.');
    const { createWhisperSpeechToText, createFsmnVoiceActivityDetector } = await import('react-native-executorch');
    const vad = await createFsmnVoiceActivityDetector(speechModel.vadModel);
    let stt: WhisperSpeechToText | null = null;
    try { if (transcription) stt = await createWhisperSpeechToText(speechModel); }
    catch (error) { vad.dispose(); throw error; }
    return {
      detect: (audio) => vad.detectVoice(audio, { minSpeechDurationMs: 100, speechPadMs: 0 }),
      transcribe: async (audio, language, onToken) => stt ? stt.transcribe(audio, { language }, onToken) : '',
      stop: () => stt?.transcribeStop(),
      dispose: () => { stt?.dispose(); vad.dispose(); },
    };
  },
  async output(language) {
    const config = outputModels[language];
    if (!config) throw new AIInterruptedError('Download the selected read-aloud voice in Settings first.');
    const { createKokoroTextToSpeech } = await import('react-native-executorch');
    const tts = await createKokoroTextToSpeech(config);
    return {
      synthesize: (text, speed) => tts.synthesize(text, { voice: voices[language], speed, maxChunkLength: 180 }),
      stop: () => tts.synthesizeStop(),
      dispose: () => tts.dispose(),
    };
  },
  async play(audio, sampleRate, signal) {
    const { AudioContext, AudioManager } = await import('react-native-audio-api');
    checkActive(signal);
    AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'spokenAudio', iosNotifyOthersOnDeactivation: true });
    const context = new AudioContext({ sampleRate });
    const source = context.createBufferSource();
    try {
      await AudioManager.setAudioSessionActivity(true);
      await context.resume();
      checkActive(signal);
      const buffer = context.createBuffer(1, audio.length, sampleRate);
      buffer.copyToChannel(new Float32Array(audio), 0);
      source.buffer = buffer; source.connect(context.destination);
      await new Promise<void>((resolve, reject) => {
        let started = false;
        let settled = false;
        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          interruption.remove(); route.remove();
          source.onEnded = null;
          if (started && error) { try { source.stop(); } catch { /* Audio may already have ended after an interruption. */ } }
          error ? reject(error) : resolve();
        };
        const abort = () => done(new AIInterruptedError('Read-aloud stopped.'));
        const interruption = AudioManager.addSystemEventListener('interruption', ({ type }) => { if (type === 'began') abort(); });
        const route = AudioManager.addSystemEventListener('routeChange', ({ reason }) => { if (reason === 'OldDeviceUnavailable') abort(); });
        AudioManager.observeAudioInterruptions('gainTransient');
        signal.addEventListener('abort', abort, { once: true });
        source.onEnded = () => done();
        if (signal.aborted) { abort(); return; }
        try { source.start(); started = true; } catch { done(new Error('Audio playback could not start.')); }
      });
    } finally {
      source.disconnect();
      await context.close();
      AudioManager.observeAudioInterruptions(false);
      await AudioManager.setAudioSessionActivity(false);
    }
  },
};
