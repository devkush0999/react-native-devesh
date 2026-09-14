import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { isTodayTask, sortTasks, type Task } from '../../domain/models';
import { useAppSelector } from '../../store/store';
import { Button, Copy, Empty, Pill, layout } from '../../ui/components';
import { TaskRow } from './TaskRow';
import { useToday } from '../../ui/useToday';

export function TasksScreen({
  onCreate,
  onEdit,
}: {
  onCreate: () => void;
  onEdit: (task: Task) => void;
}) {
  const today = useToday();
  const tasks = useAppSelector((state) => state.data.tasks);
  const [filter, setFilter] = useState<'Today' | 'All' | 'Done'>('Today');
  const filtered = useMemo(
    () =>
      sortTasks(
        tasks.filter((task) =>
          filter === 'Done'
            ? task.completed
            : !task.completed && (filter === 'All' || isTodayTask(task, today)),
        ),
      ),
    [tasks, filter, today],
  );
  return (
    <FlatList
      data={filtered}
      keyExtractor={(task) => task.id}
      contentContainerStyle={layout.page}
      ListHeaderComponent={
        <View style={{ gap: 20 }}>
          <View>
            <Copy serif size={34} accessibilityRole="header">
              Small steps, forward.
            </Copy>
            <Copy muted size={14}>
              One thing at a time is enough.
            </Copy>
          </View>
          <Button label="Add a task" icon="add" onPress={onCreate} />
          <View style={layout.wrap}>
            {(['Today', 'All', 'Done'] as const).map((value) => (
              <Pill
                key={value}
                label={value}
                active={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
          {filter === 'Today' && (
            <Copy muted size={12}>
              Due today and overdue. Anytime tasks appear in All.
            </Copy>
          )}
        </View>
      }
      renderItem={({ item }) => <TaskRow task={item} onEdit={onEdit} />}
      ListEmptyComponent={
        <Empty
          icon={filter === 'Done' ? 'checkmark-circle-outline' : 'sunny-outline'}
          title={filter === 'Done' ? 'Progress starts small' : 'A little breathing room'}
          body={
            filter === 'Done'
              ? 'Your completed tasks will collect here.'
              : 'Nothing here yet. Add one thing you want to move forward.'
          }
        />
      }
    />
  );
}
