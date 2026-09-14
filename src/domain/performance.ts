import { z } from 'zod';

export const SAMPLE_INTERVAL_MS = 3000;
export const MAX_SESSION_SAMPLES = 300;
export const MAX_PERFORMANCE_SESSIONS = 12;
export const performancePhaseSchema = z.enum([
  'baseline',
  'download',
  'loading',
  'generating',
  'releasing',
  'cooldown',
  'manual',
]);
export type PerformancePhase = z.infer<typeof performancePhaseSchema>;
export type OperationKind = 'setup' | 'inference';
export const outcomeSchema = z.enum([
  'completed',
  'cancelled',
  'error',
  'thermal-stop',
  'background',
  'manual',
]);
export type PerformanceOutcome = z.infer<typeof outcomeSchema>;
const nullableMetric = z.number().finite().nonnegative().nullable();
export const nativeReadingSchema = z.object({
  platform: z.enum(['ios', 'android']),
  isPhysicalDevice: z.boolean(),
  monotonicMs: z.number().finite().nonnegative(),
  processorCount: z.number().int().min(1),
  processCpuTimeMs: nullableMetric,
  appMemoryMb: nullableMetric,
  memoryMetric: z.enum(['PSS', 'physical footprint']),
  deviceTotalMemoryMb: nullableMetric,
  deviceAvailableMemoryMb: nullableMetric,
  appAvailableMemoryMb: nullableMetric,
  batteryPercent: z.number().min(0).max(100).nullable(),
  batteryTemperatureC: z.number().finite().min(-20).max(100).nullable(),
  thermalLevel: z.number().int().min(0).max(6).nullable(),
  thermalLabel: z.string().max(80),
  charging: z.boolean().nullable(),
  lowPowerMode: z.boolean().nullable(),
});
export type NativeReading = z.infer<typeof nativeReadingSchema>;
export const thermalEventSchema = nativeReadingSchema.pick({
  thermalLevel: true,
  thermalLabel: true,
  isPhysicalDevice: true,
});
export const performanceSampleSchema = nativeReadingSchema
  .omit({
    monotonicMs: true,
    processCpuTimeMs: true,
    platform: true,
    isPhysicalDevice: true,
    processorCount: true,
    memoryMetric: true,
  })
  .extend({
    elapsedMs: z.number().nonnegative(),
    phase: performancePhaseSchema,
    appCpuPercent: nullableMetric,
    jsDelayMs: nullableMetric,
  });
export type PerformanceSample = z.infer<typeof performanceSampleSchema>;
export const performanceSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  kind: z.enum(['setup', 'inference', 'manual']),
  outcome: outcomeSchema,
  platform: z.enum(['ios', 'android']),
  isPhysicalDevice: z.boolean(),
  memoryMetric: z.enum(['PSS', 'physical footprint']),
  processorCount: z.number().int().positive(),
  samples: z.array(performanceSampleSchema).max(MAX_SESSION_SAMPLES),
  sampleCount: z.number().int().nonnegative(),
  peakThermalLevel: z.number().int().min(0).max(6).nullable().default(null),
});
export type PerformanceSession = z.infer<typeof performanceSessionSchema>;

export function cpuPercent(previous: NativeReading | null, current: NativeReading): number | null {
  if (!previous || previous.processCpuTimeMs === null || current.processCpuTimeMs === null)
    return null;
  const elapsed = current.monotonicMs - previous.monotonicMs;
  const cpu = current.processCpuTimeMs - previous.processCpuTimeMs;
  if (elapsed < 100 || cpu < 0) return null;
  // One fully used CPU core = 100%. Multi-core AI can legitimately exceed 100%.
  return Math.min(current.processorCount * 100, (cpu / elapsed) * 100);
}

export function sampleReading(
  current: NativeReading,
  previous: NativeReading | null,
  elapsedMs: number,
  phase: PerformancePhase,
  jsDelayMs: number | null,
): PerformanceSample {
  return performanceSampleSchema.parse({
    ...current,
    elapsedMs: Math.max(0, elapsedMs),
    phase,
    appCpuPercent: cpuPercent(previous, current),
    jsDelayMs,
  });
}

export function appendSample(
  session: PerformanceSession,
  sample: PerformanceSample,
): PerformanceSession {
  const samples = [...session.samples, sample];
  if (samples.length > MAX_SESSION_SAMPLES) samples.splice(1, samples.length - MAX_SESSION_SAMPLES);
  return {
    ...session,
    samples,
    sampleCount: session.sampleCount + 1,
    durationMs: sample.elapsedMs,
  };
}

function peak(
  samples: PerformanceSample[],
  field: 'appCpuPercent' | 'appMemoryMb' | 'batteryTemperatureC' | 'thermalLevel' | 'jsDelayMs',
): number | null {
  const values = samples.flatMap((sample) => (sample[field] === null ? [] : [sample[field]]));
  return values.length ? Math.max(...values) : null;
}
export function sessionSummary(session: PerformanceSession) {
  const batterySamples = session.samples.filter((sample) => sample.batteryPercent !== null);
  const first = batterySamples[0];
  const last = batterySamples.at(-1);
  const batteryComparable =
    batterySamples.length >= 2 && session.samples.every((sample) => sample.charging === false);
  return {
    peakCpu: peak(session.samples, 'appCpuPercent'),
    peakMemory: peak(session.samples, 'appMemoryMb'),
    peakTemperature: peak(session.samples, 'batteryTemperatureC'),
    worstThermal: session.peakThermalLevel ?? peak(session.samples, 'thermalLevel'),
    peakDelay: peak(session.samples, 'jsDelayMs'),
    batteryChange:
      batteryComparable && first?.batteryPercent != null && last?.batteryPercent != null
        ? last.batteryPercent - first.batteryPercent
        : null,
  };
}

export function thermalDescription(level: number | null): string {
  if (level === null) return 'Thermal reading unavailable';
  if (level >= 4) return 'Critical thermal pressure';
  if (level >= 3) return 'High thermal pressure';
  if (level >= 1) return 'Some thermal pressure reported';
  return 'No thermal warning in these samples';
}
