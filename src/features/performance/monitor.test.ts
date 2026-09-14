import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reading } from './fixtures.test-helper';

const mocks = vi.hoisted(() => ({
  native: { start: vi.fn(), stop: vi.fn(), sample: vi.fn(), addListener: vi.fn() },
  dispatch: vi.fn(),
  preferences: { thermalProtection: true },
}));
vi.mock('../../../modules/device-health', () => ({ default: mocks.native }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'recording-id' }));
vi.mock('../../store/store', () => ({
  actions: { savePerformanceSession: (payload: unknown) => ({ type: 'save', payload }) },
  store: {
    getState: () => ({ hydrated: true, data: { preferences: mocks.preferences } }),
    dispatch: mocks.dispatch,
  },
}));

import { PerformanceMonitor } from './monitor';
let monitor: PerformanceMonitor;
let thermalListener: (event: unknown) => void;
let milliseconds: number;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.preferences.thermalProtection = true;
  milliseconds = 0;
  mocks.native.start.mockResolvedValue(undefined);
  mocks.native.stop.mockResolvedValue(undefined);
  mocks.native.addListener.mockImplementation((_name, callback) => {
    thermalListener = callback;
    return { remove: vi.fn() };
  });
  mocks.native.sample.mockImplementation(async () => {
    milliseconds += 3000;
    return reading({ monotonicMs: milliseconds, processCpuTimeMs: milliseconds / 2 });
  });
  monitor = new PerformanceMonitor();
});
afterEach(async () => {
  monitor.finish();
  await Promise.resolve();
  vi.useRealTimers();
});

describe('automatic device recording', () => {
  it('records baseline, generation and cooldown then saves locally', async () => {
    await monitor.before('inference');
    monitor.phase('generating');
    await vi.advanceTimersByTimeAsync(3100);
    monitor.after('completed');
    await vi.advanceTimersByTimeAsync(12_000);
    expect(monitor.getSnapshot().recording).toBe(false);
    const saved = mocks.dispatch.mock.calls[0]![0].payload;
    expect(saved.kind).toBe('inference');
    expect(saved.outcome).toBe('completed');
    expect(saved.samples.some((sample: { phase: string }) => sample.phase === 'generating')).toBe(
      true,
    );
    expect(saved.samples.some((sample: { phase: string }) => sample.phase === 'cooldown')).toBe(
      true,
    );
    expect(mocks.native.stop).toHaveBeenCalled();
  });
  it('blocks an AI operation when preflight detects high heat', async () => {
    mocks.native.sample.mockResolvedValue(reading({ thermalLevel: 3, thermalLabel: 'Severe' }));
    const cancel = vi.fn();
    monitor.setCancelAI(cancel);
    await expect(monitor.before('inference')).rejects.toThrow('thermal pressure');
    expect(cancel).toHaveBeenCalled();
    monitor.after('cancelled');
    await vi.advanceTimersByTimeAsync(12_000);
    expect(mocks.dispatch.mock.calls[0]![0].payload.outcome).toBe('thermal-stop');
  });
  it('reacts to native thermal events during generation', async () => {
    const cancel = vi.fn();
    monitor.setCancelAI(cancel);
    await monitor.before('inference');
    thermalListener({ thermalLevel: 4, thermalLabel: 'Critical', isPhysicalDevice: true });
    expect(cancel).toHaveBeenCalled();
    expect(monitor.getSnapshot().thermalNotice).toContain('stopping');
  });
  it('does not stop based on emulator readings or when protection is disabled', async () => {
    const cancel = vi.fn();
    monitor.setCancelAI(cancel);
    await monitor.before('inference');
    thermalListener({ thermalLevel: 4, thermalLabel: 'Critical', isPhysicalDevice: false });
    expect(cancel).not.toHaveBeenCalled();
    mocks.preferences.thermalProtection = false;
    thermalListener({ thermalLevel: 4, thermalLabel: 'Critical', isPhysicalDevice: true });
    expect(cancel).not.toHaveBeenCalled();
    expect(monitor.getSnapshot().thermalNotice).toContain('Consider stopping');
  });
  it('keeps manual baseline recording across an AI request', async () => {
    await monitor.startManual();
    await monitor.before('inference');
    monitor.phase('generating');
    await vi.advanceTimersByTimeAsync(3000);
    monitor.after('completed');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(monitor.getSnapshot().recording).toBe(true);
    expect(monitor.getSnapshot().phase).toBe('manual');
    monitor.finish();
    expect(mocks.dispatch.mock.calls[0]![0].payload.kind).toBe('manual');
  });
  it('stops timers and saves on background without duplicate history', async () => {
    const cancel = vi.fn();
    monitor.setCancelAI(cancel);
    await monitor.before('inference');
    monitor.background();
    monitor.after('cancelled');
    const count = mocks.native.sample.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.native.sample).toHaveBeenCalledTimes(count);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch.mock.calls[0]![0].payload.outcome).toBe('background');
    expect(cancel).toHaveBeenCalled();
  });
  it('discards a stale asynchronous reading after recording has stopped', async () => {
    await monitor.startManual();
    let complete!: (value: unknown) => void;
    mocks.native.sample.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(3000);
    monitor.finish();
    complete(reading({ monotonicMs: 6000 }));
    await vi.advanceTimersByTimeAsync(9000);
    expect(monitor.getSnapshot().active).toBeNull();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch.mock.calls[0]![0].payload.samples).toHaveLength(1);
  });
});
