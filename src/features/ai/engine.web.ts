import { LocalAIEngine } from './engine.core';
import { performanceMonitor } from '../performance/monitor';

export const engine = new LocalAIEngine({
  async prepare() {
    throw new Error('On-device AI requires the iOS or Android app.');
  },
  async create() {
    throw new Error('On-device AI requires the iOS or Android app.');
  },
}, performanceMonitor);

performanceMonitor.setCancelAI(engine.cancel);
