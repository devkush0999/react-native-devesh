import type { VoiceAdapter } from './adapter.types';
const unavailable = async (): Promise<never> => { throw new Error('Offline voice requires a native iOS or Android development build.'); };
export const voiceAdapter: VoiceAdapter = {
  supported: false, prepare: unavailable, requestPermission: unavailable,
  capture: unavailable, speech: unavailable, output: unavailable, play: unavailable,
};
