import type { NativeReading } from '../../domain/performance';

export function reading(overrides: Partial<NativeReading> = {}): NativeReading {
  return {
    platform: 'android',
    isPhysicalDevice: true,
    monotonicMs: 1000,
    processorCount: 8,
    processCpuTimeMs: 100,
    appMemoryMb: 140,
    memoryMetric: 'PSS',
    deviceTotalMemoryMb: 8000,
    deviceAvailableMemoryMb: 4000,
    appAvailableMemoryMb: null,
    batteryPercent: 80,
    batteryTemperatureC: 32,
    thermalLevel: 0,
    thermalLabel: 'None',
    charging: false,
    lowPowerMode: false,
    ...overrides,
  };
}
