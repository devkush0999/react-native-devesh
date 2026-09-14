import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { localDate, type Task } from '../../domain/models';
import { actions, useAppDispatch } from '../../store/store';
import { Copy, Icon, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';

export const TaskRow = memo(function TaskRow({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const today = localDate();
  const overdue = task.dueDate !== null && task.dueDate < today && !task.completed;
  return (
    <View style={[layout.row, { paddingVertical: 9 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: task.completed }}
        onPress={() => dispatch(actions.toggleTask(task.id))}
        style={{ width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 25,
            height: 25,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: task.completed ? colors.green : colors.line,
            backgroundColor: task.completed ? colors.soft : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.completed && <Icon name="checkmark" size={17} color={colors.green} />}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={() => onEdit(task)}
        style={{ flex: 1, minHeight: 48, justifyContent: 'center', gap: 4 }}
      >
        <Copy
          size={15}
          weight="500"
          style={{
            textDecorationLine: task.completed ? 'line-through' : 'none',
            color: task.completed ? colors.muted : colors.ink,
          }}
        >
          {task.title}
        </Copy>
        <Copy size={12} muted>
          {task.completed
            ? 'Completed'
            : task.dueDate === today
              ? 'Today'
              : task.dueDate
                ? `${overdue ? 'Overdue · ' : ''}${task.dueDate}`
                : 'Anytime'}
          {task.priority === 'high' ? '  ·  High priority' : ''}
        </Copy>
      </Pressable>
      {!task.completed && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: task.priority === 'high' ? '#D4895C' : colors.green,
            opacity: task.priority === 'low' ? 0.3 : 1,
          }}
        />
      )}
    </View>
  );
});
