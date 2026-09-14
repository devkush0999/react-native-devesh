import { useSyncExternalStore } from 'react';
import { randomUUID } from 'expo-crypto';
import DeviceHealth from '../../../modules/device-health';
import { actions, store } from '../../store/store';
import { SAMPLE_INTERVAL_MS, nativeReadingSchema, thermalEventSchema, type OperationKind, type PerformanceOutcome, type PerformancePhase, type PerformanceSession } from '../../domain/performance';
import { AIInterruptedError, type OperationObserver } from '../ai/engine.core';
import { SessionRecorder } from './recorder';

type MonitorState = {
  supported: boolean;
  recording: boolean;
  active: PerformanceSession | null;
  phase: PerformancePhase;
  error: string | null;
  thermalNotice: string | null;
};

class PerformanceMonitor implements OperationObserver {
  private state: MonitorState = { supported: DeviceHealth !== null, recording: false, active: null, phase: 'baseline', error: null, thermalNotice: null };
  private listeners = new Set<() => void>();
  private recorder = new SessionRecorder();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cooldown: ReturnType<typeof setTimeout> | null = null;
  private thermalSubscription: { remove(): void } | null = null;
  private pendingSample: Promise<void> | null = null;
  private initialization: Promise<void> | null = null;
  private generation = 0;
  private nativeStop: Promise<void> = Promise.resolve();
  private aiActive = false;
  private thermalStopped = false;
  private cancelAI: (() => void) | null = null;
  private kind: PerformanceSession['kind'] = 'manual';
  private lastOutcome: PerformanceOutcome = 'completed';

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<MonitorState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  setCancelAI(cancel: () => void) { this.cancelAI = cancel; }

  private onHeat(event: unknown) {
    const result = thermalEventSchema.safeParse(event);
    if (!result.success || !result.data.isPhysicalDevice || result.data.thermalLevel === null) return;
    const { thermalLevel, thermalLabel } = result.data;
    if (thermalLevel >= 3) {
      const protection = store.getState().data.preferences.thermalProtection;
      this.update({ thermalNotice: `The OS reports ${thermalLabel.toLowerCase()} thermal pressure.${protection && this.aiActive ? ' Saathi is stopping this AI request. Let the phone cool before retrying.' : ' Consider stopping AI and letting the phone cool.'}` });
      if (protection && this.aiActive) { this.thermalStopped = true; this.cancelAI?.(); }
    }
  }

  private async sample(delay: number | null = null): Promise<void> {
    if (this.pendingSample) return this.pendingSample;
    if (!DeviceHealth || !this.state.recording) return;
    const generation = this.generation;
    const phase = this.state.phase;
    this.pendingSample = (async () => {
      try {
        const reading = nativeReadingSchema.parse(await DeviceHealth.sample());
        if (generation !== this.generation || !this.state.recording) return;
        this.onHeat(reading);
        const active = this.recorder.add(reading, delay, phase);
        this.update({ active, error: null });
      } catch {
        if (generation === this.generation) this.update({ error: 'A device reading failed. Gaps mean unavailable data, not zero usage. Thermal protection may also be unavailable.' });
      }
    })();
    try { await this.pendingSample; } finally { this.pendingSample = null; }
  }

  private schedule() {
    if (!this.state.recording) return;
    const generation = this.generation;
    const due = performance.now() + SAMPLE_INTERVAL_MS;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sample(Math.max(0, performance.now() - due)).then(() => { if (generation === this.generation) this.schedule(); });
    }, SAMPLE_INTERVAL_MS);
  }

  private async start(kind: PerformanceSession['kind']): Promise<void> {
    if (!DeviceHealth) return;
    if (this.initialization) await this.initialization;
    if (this.state.recording) return;
    const generation = ++this.generation;
    this.kind = kind;
    this.thermalStopped = false;
    this.recorder.begin(randomUUID(), kind, new Date().toISOString());
    this.update({ recording: true, active: null, phase: 'baseline', error: null, thermalNotice: null });
    this.initialization = (async () => {
      try {
        await this.nativeStop;
        await this.pendingSample;
        if (generation !== this.generation) return;
        await DeviceHealth.start();
        if (generation !== this.generation) return;
        this.thermalSubscription = DeviceHealth.addListener('onThermalChange', (event) => {
          this.onHeat(event);
          // Capture transitions as well as periodic samples; unavailable sensors remain null.
          void this.sample();
        });
        await this.sample();
        if (generation === this.generation) this.schedule();
      } catch {
        this.finish('error');
        this.update({ error: 'Device monitoring could not start. Rebuild the native app and retry.' });
      }
    })();
    try { await this.initialization; } finally { this.initialization = null; }
  }

  async before(kind: OperationKind) {
    if (this.cooldown) this.finish(this.lastOutcome);
    this.aiActive = true;
    this.thermalStopped = false;
    await this.start(kind);
    await this.initialization;
    // A fresh preflight reading is needed even inside an existing manual recording.
    await this.sample();
    if (this.thermalStopped) throw new AIInterruptedError('AI did not start because the device reports high thermal pressure. Let it cool and retry.');
  }

  phase = (phase: PerformancePhase) => {
    this.recorder.setPhase(phase);
    this.update({ phase });
    if (phase === 'generating' || phase === 'releasing') void this.sample();
  };

  after = (outcome: PerformanceOutcome) => {
    this.aiActive = false;
    this.lastOutcome = this.thermalStopped ? 'thermal-stop' : outcome;
    if (!this.state.recording) return;
    if (this.kind === 'manual') { this.phase('manual'); return; }
    this.phase('cooldown');
    void this.sample();
    this.cooldown = setTimeout(() => this.finish(this.lastOutcome), 12_000);
  };

  startManual = async () => {
    await this.start('manual');
    if (!this.aiActive && !this.cooldown) this.phase('manual');
  };

  finish = (outcome: PerformanceOutcome = 'manual') => {
    if (this.timer) clearTimeout(this.timer);
    if (this.cooldown) clearTimeout(this.cooldown);
    this.timer = null; this.cooldown = null;
    this.thermalSubscription?.remove(); this.thermalSubscription = null;
    this.generation++;
    this.aiActive = false;
    const session = this.recorder.finish(this.thermalStopped ? 'thermal-stop' : outcome);
    this.update({ recording: false, active: null });
    if (session?.samples.length && store.getState().hydrated) store.dispatch(actions.savePerformanceSession(session));
    this.nativeStop = (this.initialization ?? Promise.resolve()).then(() => DeviceHealth?.stop()).catch(() => {});
  };

  stopAndSave = () => { this.cancelAI?.(); this.finish('manual'); };
  background = () => { this.cancelAI?.(); this.finish('background'); };
  dismissNotice = () => this.update({ thermalNotice: null });
}

export const performanceMonitor = new PerformanceMonitor();
export function usePerformanceMonitor() { return useSyncExternalStore(performanceMonitor.subscribe, performanceMonitor.getSnapshot, performanceMonitor.getSnapshot); }
