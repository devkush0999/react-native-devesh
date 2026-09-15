import { VOICE_SAMPLE_RATE, joinAudio } from '../../domain/voice';

/** Single consumer with a strict pending-audio budget; overflow is an explicit error. */
export class AudioQueue {
  private frames: Float32Array[] = [];
  private size = 0;
  private closed = false;
  private wake: (() => void) | null = null;
  constructor(private maxSamples = VOICE_SAMPLE_RATE * 24) {}
  get pendingSeconds() { return this.size / VOICE_SAMPLE_RATE; }
  push(frame: Float32Array) {
    if (this.closed) return;
    if (this.size + frame.length > this.maxSamples) throw new Error('This phone could not keep up with live audio. Recording stopped; review the completed transcript and try shorter clips.');
    this.frames.push(frame); this.size += frame.length; this.wake?.(); this.wake = null;
  }
  close(discard = false) {
    this.closed = true;
    if (discard) { this.frames = []; this.size = 0; }
    this.wake?.(); this.wake = null;
  }
  async *read(): AsyncGenerator<Float32Array> {
    while (!this.closed || this.size) {
      if (!this.size) { await new Promise<void>((resolve) => { this.wake = resolve; }); continue; }
      // Exactly one second for VAD. Preserve every sample including the final short frame.
      if (this.size < VOICE_SAMPLE_RATE && !this.closed) {
        await new Promise<void>((resolve) => { this.wake = resolve; }); continue;
      }
      let remaining = Math.min(VOICE_SAMPLE_RATE, this.size);
      const parts: Float32Array[] = [];
      while (remaining > 0) {
        const head = this.frames.shift()!;
        const count = Math.min(remaining, head.length);
        parts.push(head.subarray(0, count));
        if (count < head.length) this.frames.unshift(head.subarray(count));
        this.size -= count; remaining -= count;
      }
      yield joinAudio(parts);
    }
  }
}
