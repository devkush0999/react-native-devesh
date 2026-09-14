import { describe, expect, it, vi } from 'vitest';
import { LocalAIEngine, type AIAdapter, type Session } from './engine.core';

function fixture() {
  const session: Session = {
    send: vi.fn(async () => 'A clear answer'),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const adapter: AIAdapter = { prepare: vi.fn(async () => {}), create: vi.fn(async () => session) };
  return { session, adapter, engine: new LocalAIEngine(adapter) };
}
describe('native AI lifecycle', () => {
  it('requires an explicit model setup before inference', async () => {
    const { engine, adapter } = fixture();
    await expect(engine.generate('system', 'question', () => {})).rejects.toThrow('Set up');
    expect(adapter.create).not.toHaveBeenCalled();
  });
  it('releases native resources after a completed request', async () => {
    const { engine, session } = fixture();
    await engine.prepare();
    await expect(engine.generate('system', 'question', () => {})).resolves.toBe('A clear answer');
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().status).toBe('ready');
  });
  it('does not dispose during an active native generation', async () => {
    const { engine, session } = fixture();
    let finish!: (value: string) => void;
    session.send = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await engine.prepare();
    const request = engine.generate('system', 'question', () => {});
    const rejected = expect(request).rejects.toThrow('stopped');
    await vi.waitFor(() => expect(session.send).toHaveBeenCalled());
    await expect(engine.generate('system', 'again', () => {})).rejects.toThrow('already working');
    engine.cancel();
    expect(session.stop).toHaveBeenCalledOnce();
    expect(session.dispose).not.toHaveBeenCalled();
    finish('partial output');
    await rejected;
    expect(session.dispose).toHaveBeenCalledOnce();
  });
  it('handles cancellation while a model session is being created', async () => {
    const { engine, adapter, session } = fixture();
    let finish!: (value: Session) => void;
    adapter.create = () =>
      new Promise<Session>((resolve) => {
        finish = resolve;
      });
    await engine.prepare();
    const request = engine.generate('system', 'question', () => {});
    const rejected = expect(request).rejects.toThrow('stopped');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    engine.cancel();
    finish(session);
    await rejected;
    expect(session.send).not.toHaveBeenCalled();
    expect(session.dispose).toHaveBeenCalledOnce();
  });
  it('surfaces setup failures and allows retry', async () => {
    const { engine, adapter } = fixture();
    adapter.prepare = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    await engine.prepare();
    expect(engine.getSnapshot().status).toBe('error');
    expect(engine.getSnapshot().available).toBe(false);
    await engine.prepare();
    expect(engine.getSnapshot().status).toBe('ready');
  });
});
