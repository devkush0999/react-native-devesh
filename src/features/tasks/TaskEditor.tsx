import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import {
  MAX_TASKS,
  localDate,
  taskDraftSchema,
  tomorrow,
  type Task,
  type TaskDraft,
} from '../../domain/models';
import { actions, useAppDispatch, useAppSelector } from '../../store/store';
import { Button, Copy, Input, Notice, Pill, Sheet, layout } from '../../ui/components';
import { View } from 'react-native';

export function TaskEditor({ task, onClose }: { task?: Task; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const count = useAppSelector((state) => state.data.tasks.length);
  const [title, setTitle] = useState(task?.title ?? '');
  const [priority, setPriority] = useState<TaskDraft['priority']>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? localDate());
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    const result = taskDraftSchema.safeParse({ title, priority, dueDate: dueDate || null });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please check this task.');
      return;
    }
    if (!task && count >= MAX_TASKS) {
      setError('Your planner is full. Delete older tasks first.');
      return;
    }
    const next: Task = {
      ...result.data,
      id: task?.id ?? randomUUID(),
      completed: task?.completed ?? false,
      createdAt: task?.createdAt ?? new Date().toISOString(),
      ...(task?.sourceNoteId ? { sourceNoteId: task.sourceNoteId } : {}),
    };
    dispatch(task ? actions.updateTask(next) : actions.addTasks([next]));
    onClose();
  }
  return (
    <Sheet visible title={task ? 'A small step' : 'One thing to do'} onClose={onClose}>
      <Copy muted>Make it specific. Make it manageable.</Copy>
      <Input
        accessibilityLabel="Task title"
        placeholder="What would you like to get done?"
        value={title}
        onChangeText={setTitle}
        maxLength={160}
        multiline
        autoFocus
      />
      <Copy weight="600">When</Copy>
      <View style={layout.wrap}>
        {[
          { label: 'Today', date: localDate() },
          { label: 'Tomorrow', date: tomorrow() },
          { label: 'Anytime', date: '' },
        ].map((item) => (
          <Pill
            key={item.label}
            label={item.label}
            active={dueDate === item.date}
            onPress={() => setDueDate(item.date)}
          />
        ))}
      </View>
      <Input
        accessibilityLabel="Due date in YYYY-MM-DD format"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD (optional)"
        maxLength={10}
        autoCapitalize="none"
      />
      <Copy weight="600">Priority</Copy>
      <View style={layout.wrap}>
        {(['low', 'medium', 'high'] as const).map((value) => (
          <Pill
            key={value}
            label={value.charAt(0).toUpperCase() + value.slice(1)}
            active={priority === value}
            onPress={() => setPriority(value)}
          />
        ))}
      </View>
      <Notice>
        Tasks stay in your planner. Notification reminders are not enabled in this version.
      </Notice>
      {!!error && <Notice error>{error}</Notice>}
      <Button label="Save task" icon="checkmark" onPress={save} disabled={!title.trim()} />
      {task && (
        <Button
          label={confirmDelete ? 'Confirm delete task' : 'Delete task'}
          variant="danger"
          icon="trash-outline"
          onPress={() => {
            if (!confirmDelete) setConfirmDelete(true);
            else {
              dispatch(actions.deleteTask(task.id));
              onClose();
            }
          }}
        />
      )}
    </Sheet>
  );
}
