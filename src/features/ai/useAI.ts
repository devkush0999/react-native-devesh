import { useSyncExternalStore } from 'react';
import { engine } from './engine';

export function useAI() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
