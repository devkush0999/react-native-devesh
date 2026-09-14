import { appendSample, sampleReading, type NativeReading, type PerformanceOutcome, type PerformancePhase, type PerformanceSession } from '../../domain/performance';

export class SessionRecorder {
  private previous: NativeReading | null = null;
  private phase: PerformancePhase = 'baseline';
  private origin = 0;
  private session: PerformanceSession | null = null;

  begin(id: string, kind: PerformanceSession['kind'], startedAt: string) {
    this.previous = null;
    this.phase = 'baseline';
    this.session = null;
    this.metadata = { id, kind, startedAt };
  }
  private metadata: Pick<PerformanceSession, 'id' | 'kind' | 'startedAt'> | null = null;
  setPhase(phase: PerformancePhase) { this.phase = phase; }
  getSession() { return this.session; }
  add(reading: NativeReading, jsDelayMs: number | null = null) {
    if (!this.metadata) return null;
    if (!this.session) {
      this.origin = reading.monotonicMs;
      this.session = { ...this.metadata, platform: reading.platform, isPhysicalDevice: reading.isPhysicalDevice, processorCount: reading.processorCount, memoryMetric: reading.memoryMetric, outcome: 'completed', durationMs: 0, samples: [], sampleCount: 0 };
    }
    this.session = appendSample(this.session, sampleReading(reading, this.previous, reading.monotonicMs - this.origin, this.phase, jsDelayMs));
    this.previous = reading;
    return this.session;
  }
  finish(outcome: PerformanceOutcome): PerformanceSession | null {
    const result = this.session ? { ...this.session, outcome } : null;
    this.metadata = null; this.session = null; this.previous = null;
    return result;
  }
}
