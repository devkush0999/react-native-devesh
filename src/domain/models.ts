import { z } from 'zod';
import { MAX_PERFORMANCE_SESSIONS, performanceSessionSchema } from './performance';

export const MAX_NOTE_LENGTH = 3000;
export const MAX_NOTES = 500;
export const MAX_TASKS = 1000;

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDate(date);
}

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDate(date) === value;
  }, 'Use a valid date in YYYY-MM-DD format.');

export const categorySchema = z.enum(['Personal', 'Work', 'Ideas']);
export const prioritySchema = z.enum(['high', 'medium', 'low']);
export const noteSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  category: categorySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const taskDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  priority: prioritySchema,
  dueDate: dateSchema.nullable(),
});
export const taskSchema = taskDraftSchema.extend({
  id: z.string(),
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  sourceNoteId: z.string().optional(),
});
export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  language: z.enum(['English', 'Hinglish']),
  thermalProtection: z.boolean().default(true),
});
export const snapshotSchema = z.object({
  version: z.literal(1),
  notes: z.array(noteSchema).max(MAX_NOTES),
  tasks: z.array(taskSchema).max(MAX_TASKS),
  preferences: preferencesSchema,
  performanceSessions: z.array(performanceSessionSchema).max(MAX_PERFORMANCE_SESSIONS).default([]),
});

export type Note = z.infer<typeof noteSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskDraft = z.infer<typeof taskDraftSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

export const emptySnapshot: Snapshot = {
  version: 1,
  notes: [],
  tasks: [],
  preferences: { theme: 'system', language: 'English', thermalProtection: true },
  performanceSessions: [],
};

export function isTodayTask(task: Task, today = localDate()): boolean {
  return task.dueDate !== null && task.dueDate <= today;
}

export function sortTasks(tasks: Task[]): Task[] {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      rank[a.priority] - rank[b.priority],
  );
}
