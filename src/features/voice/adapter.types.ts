import type { VoiceLanguage, VoicePack } from '../../domain/voice';

export interface SpeechSession {
  detect(audio: Float32Array): Promise<{ start: number; end: number }[]>;
  transcribe(
    audio: Float32Array,
    language: VoiceLanguage,
    onToken: (token: string) => void,
  ): Promise<string>;
  stop(): void;
  dispose(): void;
}
export interface SpeechOutput {
  synthesize(
    text: string,
    speed: number,
  ): AsyncGenerator<{ audio: Float32Array; sampleRate: number }>;
  stop(): void;
  dispose(): void;
}
export interface VoiceAdapter {
  supported: boolean;
  prepare(
    pack: VoicePack,
    signal: AbortSignal,
    onProgress: (progress: number) => void,
  ): Promise<void>;
  requestPermission(): Promise<void>;
  capture(
    onAudio: (audio: Float32Array) => void,
    onError: (error: Error) => void,
    signal: AbortSignal,
  ): Promise<{ stop(): Promise<void> }>;
  speech(transcription: boolean): Promise<SpeechSession>;
  output(language: VoiceLanguage): Promise<SpeechOutput>;
  play(audio: Float32Array, sampleRate: number, signal: AbortSignal): Promise<void>;
}
