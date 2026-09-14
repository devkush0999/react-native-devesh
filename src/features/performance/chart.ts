import { SAMPLE_INTERVAL_MS, type PerformanceSample } from '../../domain/performance';

export type MetricKey =
  | 'appCpuPercent'
  | 'appMemoryMb'
  | 'thermalLevel'
  | 'batteryTemperatureC'
  | 'batteryPercent'
  | 'jsDelayMs'
  | 'deviceAvailableMemoryMb'
  | 'appAvailableMemoryMb';
export const metrics: Record<MetricKey, { label: string; unit: string; description: string }> = {
  appCpuPercent: {
    label: 'App CPU',
    unit: '%',
    description:
      'CPU consumed by Saathi, including native AI. One fully used core is 100%; multi-core work can exceed 100%. This is not total phone CPU.',
  },
  appMemoryMb: {
    label: 'App RAM',
    unit: 'MB',
    description:
      'Memory attributed to Saathi: physical footprint on iOS, proportional set size (PSS) on Android. These measures differ; compare sessions on the same device.',
  },
  thermalLevel: {
    label: 'Thermal state',
    unit: '',
    description:
      'OS thermal severity, not degrees. iOS: 0 nominal, 1 fair, 3 serious, 4 critical. Android: 0 none, 1 light, 2 moderate, 3 severe, 4 critical, 5 emergency, 6 shutdown.',
  },
  batteryTemperatureC: {
    label: 'Battery heat',
    unit: '°C',
    description:
      'Android battery sensor temperature only. It is not CPU or surface temperature. iOS does not expose an equivalent public sensor.',
  },
  batteryPercent: {
    label: 'Battery',
    unit: '%',
    description:
      'Whole-device battery level. Screen brightness, charging, radio use and other apps also affect it. Short sessions may show no measurable change.',
  },
  jsDelayMs: {
    label: 'JS delay',
    unit: 'ms',
    description:
      'How late the 3-second sampling timer ran on the JS thread. This can reveal stalls; it is not FPS, touch latency or a whole-device speed score.',
  },
  deviceAvailableMemoryMb: {
    label: 'Device free RAM',
    unit: 'MB',
    description:
      'Android OS estimate of available device memory, including reclaimable memory. iOS does not expose this through this module.',
  },
  appAvailableMemoryMb: {
    label: 'App headroom',
    unit: 'MB',
    description:
      'iOS estimate of how much memory this app can still allocate. This is not total free RAM, and the allowance can change.',
  },
};

export function chartRange(samples: PerformanceSample[], key: MetricKey): [number, number] {
  if (key === 'thermalLevel') return [0, 6];
  if (key === 'batteryPercent') return [0, 100];
  const values = samples.flatMap((sample) => (sample[key] === null ? [] : [sample[key]]));
  if (!values.length) return [0, 100];
  if (key === 'batteryTemperatureC')
    return [Math.floor(Math.min(...values)) - 2, Math.ceil(Math.max(...values)) + 2];
  const minimumMax = key === 'appCpuPercent' ? 100 : key === 'jsDelayMs' ? 50 : 1;
  return [0, Math.max(minimumMax, Math.ceil(Math.max(...values) * 1.1))];
}

export function chartSegments(samples: PerformanceSample[], key: MetricKey): PerformanceSample[][] {
  const segments: PerformanceSample[][] = [];
  let current: PerformanceSample[] = [];
  let previousTime: number | null = null;
  for (const sample of samples) {
    if (
      sample[key] === null ||
      (previousTime !== null && sample.elapsedMs - previousTime > SAMPLE_INTERVAL_MS * 2.5)
    ) {
      if (current.length) segments.push(current);
      current = [];
    }
    if (sample[key] !== null) current.push(sample);
    previousTime = sample.elapsedMs;
  }
  if (current.length) segments.push(current);
  return segments;
}

export function elapsedLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
