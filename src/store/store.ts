import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import {
  emptySnapshot,
  MAX_NOTES,
  MAX_TASKS,
  type Note,
  type Preferences,
  type Snapshot,
  type Task,
} from '../domain/models';
import { repository } from '../data/repository';
import { MAX_PERFORMANCE_SESSIONS, performanceSessionSchema, type PerformanceSession } from '../domain/performance';

const slice = createSlice({
  name: 'vault',
  initialState: {
    data: emptySnapshot,
    hydrated: false,
    storageError: null as string | null,
    saving: false,
  },
  reducers: {
    hydrate(state, action: PayloadAction<Snapshot>) {
      state.data = action.payload;
      state.hydrated = true;
      state.storageError = null;
    },
    saveNote(state, action: PayloadAction<Note>) {
      const index = state.data.notes.findIndex((note) => note.id === action.payload.id);
      if (index >= 0) state.data.notes[index] = action.payload;
      else if (state.data.notes.length < MAX_NOTES) state.data.notes.unshift(action.payload);
    },
    deleteNote(state, action: PayloadAction<string>) {
      state.data.notes = state.data.notes.filter((note) => note.id !== action.payload);
      state.data.tasks.forEach((task) => {
        if (task.sourceNoteId === action.payload) delete task.sourceNoteId;
      });
    },
    addTasks(state, action: PayloadAction<Task[]>) {
      state.data.tasks.unshift(...action.payload.slice(0, MAX_TASKS - state.data.tasks.length));
    },
    toggleTask(state, action: PayloadAction<string>) {
      const task = state.data.tasks.find((item) => item.id === action.payload);
      if (task) task.completed = !task.completed;
    },
    updateTask(state, action: PayloadAction<Task>) {
      const index = state.data.tasks.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.data.tasks[index] = action.payload;
    },
    deleteTask(state, action: PayloadAction<string>) {
      state.data.tasks = state.data.tasks.filter((task) => task.id !== action.payload);
    },
    setPreferences(state, action: PayloadAction<Partial<Preferences>>) {
      Object.assign(state.data.preferences, action.payload);
    },
    savePerformanceSession(state, action: PayloadAction<PerformanceSession>) {
      const session = performanceSessionSchema.parse(action.payload);
      state.data.performanceSessions = [session, ...state.data.performanceSessions.filter((item) => item.id !== session.id)].slice(0, MAX_PERFORMANCE_SESSIONS);
    },
    clearPerformanceSessions(state) { state.data.performanceSessions = []; },
    clearVault(state) {
      state.data = { ...emptySnapshot, preferences: state.data.preferences };
    },
    storageState(state, action: PayloadAction<{ saving: boolean; error: string | null }>) {
      state.saving = action.payload.saving;
      state.storageError = action.payload.error;
    },
  },
});

export const actions = slice.actions;
export const store = configureStore({ reducer: slice.reducer });
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>();
export const useAppSelector = useSelector.withTypes<ReturnType<typeof store.getState>>();

let lastSnapshot = store.getState().data;
let writeQueue = Promise.resolve();
let revision = 0;

export function persistCurrent(): Promise<void> {
  const snapshot = store.getState().data;
  const currentRevision = ++revision;
  store.dispatch(actions.storageState({ saving: true, error: null }));
  writeQueue = writeQueue.then(async () => {
    try {
      await repository.save(snapshot);
      if (revision === currentRevision)
        store.dispatch(actions.storageState({ saving: false, error: null }));
    } catch {
      if (revision === currentRevision)
        store.dispatch(
          actions.storageState({
            saving: false,
            error: 'Changes could not be saved. Keep the app open and retry.',
          }),
        );
    }
  });
  return writeQueue;
}

store.subscribe(() => {
  const state = store.getState();
  if (state.data === lastSnapshot) return;
  lastSnapshot = state.data;
  if (state.hydrated) void persistCurrent();
});

export async function hydrateVault(): Promise<void> {
  try {
    store.dispatch(actions.hydrate((await repository.load()) ?? emptySnapshot));
  } catch (error) {
    store.dispatch(
      actions.storageState({
        saving: false,
        error:
          error instanceof Error ? error.message : 'Your vault could not be opened. Please retry.',
      }),
    );
  }
}
