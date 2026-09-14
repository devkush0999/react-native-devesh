import { describe, expect, it } from 'vitest';
import {
  cpuPercent,
  MAX_SESSION_SAMPLES,
  nativeReadingSchema,
  sessionSummary,
} from '../../domain/performance';
import { snapshotSchema } from '../../domain/models';
import { chartRange, chartSegments } from './chart';
import { reading } from './fixtures.test-helper';
import { SessionRecorder } from './recorder';

function recorder() {
  const instance = new SessionRecorder();
  instance.begin('test', 'inference', '2026-09-14T12:00:00.000Z');
  return instance;
}

describe('resource measurements', () => {
  it('computes process CPU across all cores without calling it device CPU', () => {
    expect(cpuPercent(reading(), reading({ monotonicMs: 2000, processCpuTimeMs: 2100 }))).toBe(200);
    expect(cpuPercent(null, reading())).toBeNull();
    expect(cpuPercent(reading(), reading())).toBeNull();
    expect(cpuPercent(reading(), reading({ monotonicMs: 2000, processCpuTimeMs: 1 }))).toBeNull();
  });
  it('preserves unsupported sensors as null rather than zero', () => {
    const instance = recorder();
    const session = instance.add(
      reading({
        batteryTemperatureC: null,
        thermalLevel: null,
        batteryPercent: null,
        charging: null,
      }),
    );
    expect(session!.samples[0]!.thermalLevel).toBeNull();
    expect(sessionSummary(session!).peakTemperature).toBeNull();
    expect(sessionSummary(session!).worstThermal).toBeNull();
    expect(chartSegments(session!.samples, 'batteryTemperatureC')).toEqual([]);
  });
  it('bounds memory and preserves baseline plus recent samples', () => {
    const instance = recorder();
    for (let i = 0; i < MAX_SESSION_SAMPLES + 30; i++)
      instance.add(reading({ monotonicMs: 1000 + i * 3000 }));
    const session = instance.finish('completed')!;
    expect(session.samples).toHaveLength(MAX_SESSION_SAMPLES);
    expect(session.sampleCount).toBe(MAX_SESSION_SAMPLES + 30);
    expect(session.samples[0]!.elapsedMs).toBe(0);
    expect(session.samples.at(-1)!.elapsedMs).toBe((MAX_SESSION_SAMPLES + 29) * 3000);
    expect(chartSegments(session.samples, 'appMemoryMb')).toHaveLength(2);
  });
  it('labels captured phases and finishes once', () => {
    const instance = recorder();
    instance.add(reading());
    instance.setPhase('loading');
    instance.add(reading({ monotonicMs: 4000 }));
    instance.setPhase('generating');
    instance.add(reading({ monotonicMs: 7000 }));
    const session = instance.finish('cancelled');
    expect(session!.samples.map((sample) => sample.phase)).toEqual([
      'baseline',
      'loading',
      'generating',
    ]);
    expect(session!.outcome).toBe('cancelled');
    expect(instance.finish('completed')).toBeNull();
    expect(instance.add(reading())).toBeNull();
  });
  it('suppresses battery comparisons while charging or with unknown power state', () => {
    const instance = recorder();
    instance.add(reading());
    instance.add(reading({ monotonicMs: 4000, batteryPercent: 79 }));
    expect(sessionSummary(instance.getSession()!).batteryChange).toBe(-1);
    instance.add(reading({ monotonicMs: 7000, charging: true }));
    expect(sessionSummary(instance.getSession()!).batteryChange).toBeNull();
  });
  it('splits charts across missing data and time gaps', () => {
    const instance = recorder();
    instance.add(reading());
    instance.add(reading({ monotonicMs: 4000, appMemoryMb: null }));
    instance.add(reading({ monotonicMs: 7000 }));
    instance.add(reading({ monotonicMs: 25000 }));
    expect(chartSegments(instance.getSession()!.samples, 'appMemoryMb')).toHaveLength(3);
    expect(chartRange(instance.getSession()!.samples, 'thermalLevel')).toEqual([0, 6]);
  });
  it('rejects NaN readings and migrates existing vaults without losing notes', () => {
    expect(nativeReadingSchema.safeParse(reading({ appMemoryMb: NaN })).success).toBe(false);
    const old = {
      version: 1,
      notes: [],
      tasks: [],
      preferences: { theme: 'dark', language: 'Hinglish' },
    };
    const migrated = snapshotSchema.parse(old);
    expect(migrated.performanceSessions).toEqual([]);
    expect(migrated.preferences.thermalProtection).toBe(true);
    expect(migrated.preferences.theme).toBe('dark');
  });
});
