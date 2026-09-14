import type { OperationKind, PerformanceOutcome, PerformancePhase } from '../../domain/performance';

export type AIState = {
  status: 'idle' | 'downloading' | 'ready' | 'generating' | 'error';
  progress: number;
  available: boolean;
  error: string | null;
};
export interface Session {
  send(prompt: string, onToken: (token: string) => void): Promise<string>;
  stop(): void;
  dispose(): void;
}
export interface AIAdapter {
  prepare(signal: AbortSignal, onProgress: (progress: number) => void): Promise<void>;
  create(system: string): Promise<Session>;
}

export class AIInterruptedError extends Error {}
export interface OperationObserver {
  before(kind: OperationKind): Promise<void>;
  phase(phase: PerformancePhase): void;
  after(outcome: PerformanceOutcome): void;
}

export class LocalAIEngine {
  private state: AIState = { status: 'idle', progress: 0, available: false, error: null };
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private session: Session | null = null;
  private busy = false;

  constructor(
    private adapter: AIAdapter,
    private observer?: OperationObserver,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<AIState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  async prepare(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: 'downloading', error: null, progress: 0 });
    let outcome: PerformanceOutcome = 'completed';
    try {
      await this.observer?.before('setup');
      if (controller.signal.aborted) throw new AIInterruptedError('AI setup stopped.');
      this.observer?.phase('download');
      await this.adapter.prepare(controller.signal, (progress) => {
        if (!controller.signal.aborted)
          this.update({ progress: Math.max(0, Math.min(1, progress)) });
      });
      if (!controller.signal.aborted)
        this.update({ available: true, status: 'ready', progress: 1 });
    } catch (error) {
      outcome = controller.signal.aborted ? 'cancelled' : 'error';
      if (!controller.signal.aborted)
        this.update({
          status: 'error',
          error:
            error instanceof AIInterruptedError
              ? error.message
              : 'AI setup failed. Check your connection and free storage, then retry in a native development build.',
        });
    } finally {
      if (controller.signal.aborted)
        this.update({ status: this.state.available ? 'ready' : 'idle', error: null });
      this.controller = null;
      this.busy = false;
      this.observer?.after(controller.signal.aborted ? 'cancelled' : outcome);
    }
  }

  async generate(
    system: string,
    prompt: string,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (this.busy) throw new Error('AI is already working. Wait or stop the current request.');
    if (!this.state.available) throw new Error('Set up your on-device AI in Settings first.');
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: 'generating', error: null });
    let outcome: PerformanceOutcome = 'completed';
    try {
      await this.observer?.before('inference');
      if (controller.signal.aborted) throw new AIInterruptedError('Generation stopped.');
      this.observer?.phase('loading');
      this.session = await this.adapter.create(system);
      if (controller.signal.aborted) throw new Error('Generation stopped.');
      this.observer?.phase('generating');
      const answer = await this.session.send(prompt, (token) => {
        if (!controller.signal.aborted) onToken(token);
      });
      if (controller.signal.aborted) throw new Error('Generation stopped.');
      return answer;
    } catch (error) {
      outcome = controller.signal.aborted ? 'cancelled' : 'error';
      if (error instanceof AIInterruptedError) throw error;
      if (controller.signal.aborted) throw new Error('Generation stopped. Nothing was saved.');
      throw new Error(
        error instanceof Error && error.message === 'Generation stopped.'
          ? error.message
          : 'AI could not finish. Try a shorter note and close other apps to free memory.',
      );
    } finally {
      // Disposing only after send settles prevents freeing tensors during native inference.
      this.observer?.phase('releasing');
      try {
        this.session?.dispose();
      } finally {
        this.session = null;
        this.controller = null;
        this.busy = false;
        this.update({ status: 'ready' });
        this.observer?.after(controller.signal.aborted ? 'cancelled' : outcome);
      }
    }
  }

  cancel = () => {
    this.controller?.abort();
    this.session?.stop();
  };
}
