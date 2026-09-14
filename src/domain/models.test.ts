import { describe, expect, it } from 'vitest';
import {
  dateSchema,
  emptySnapshot,
  isTodayTask,
  localDate,
  snapshotSchema,
  sortTasks,
  type Task,
} from './models';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Call Mum',
  priority: 'medium',
  dueDate: null,
  completed: false,
  createdAt: '2026-09-14T12:00:00.000Z',
  ...overrides,
});
describe('planner data boundaries', () => {
  it('uses a local calendar date rather than UTC for today', () => {
    const date = new Date(2026, 8, 14, 0, 1);
    expect(localDate(date)).toBe('2026-09-14');
  });
  it('rejects impossible dates and accepts a leap day', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(dateSchema.safeParse('2028-02-29').success).toBe(true);
  });
  it('includes overdue tasks and excludes undated or future tasks from today', () => {
    expect(isTodayTask(task({ dueDate: '2026-09-13' }), '2026-09-14')).toBe(true);
    expect(isTodayTask(task({ dueDate: '2026-09-14' }), '2026-09-14')).toBe(true);
    expect(isTodayTask(task({ dueDate: '2026-09-15' }), '2026-09-14')).toBe(false);
    expect(isTodayTask(task(), '2026-09-14')).toBe(false);
  });
  it('sorts dates and priority without mutating stored tasks', () => {
    const tasks = [
      task({ id: 'undated' }),
      task({ id: 'done', completed: true, dueDate: '2026-09-12' }),
      task({ id: 'high', priority: 'high', dueDate: '2026-09-14' }),
      task({ id: 'overdue', dueDate: '2026-09-13' }),
    ];
    expect(sortTasks(tasks).map((item) => item.id)).toEqual(['overdue', 'high', 'undated', 'done']);
    expect(tasks[0]?.id).toBe('undated');
  });
  it('rejects incompatible or corrupt persisted data', () => {
    expect(snapshotSchema.safeParse({ ...emptySnapshot, version: 2 }).success).toBe(false);
    expect(
      snapshotSchema.safeParse({ ...emptySnapshot, tasks: [{ ...task(), title: '' }] }).success,
    ).toBe(false);
  });
});
