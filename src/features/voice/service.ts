import { useSyncExternalStore } from 'react';
import { engine } from '../ai/engine';
import { voiceAdapter } from './adapter';
import { VoiceController } from './controller';
export const voice = new VoiceController(voiceAdapter, engine);
export function useVoice() { return useSyncExternalStore(voice.subscribe, voice.getSnapshot, voice.getSnapshot); }
