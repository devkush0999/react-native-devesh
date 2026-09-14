import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { isTodayTask, sortTasks, type Note, type Task } from '../../domain/models';
import { useAppSelector } from '../../store/store';
import { Button, Card, Copy, Empty, Icon, Section, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { useAI } from '../ai/useAI';
import { NoteCard } from '../notes/NotesScreen';
import { TaskRow } from '../tasks/TaskRow';
import { useToday } from '../../ui/useToday';

type Props = {
  onCapture: () => void;
  onPlan: () => void;
  onSetup: () => void;
  onTasks: () => void;
  onNotes: () => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onEditNote: (note: Note) => void;
};
export function HomeScreen(props: Props) {
  const { colors } = useTheme();
  const today = useToday();
  const { notes, tasks } = useAppSelector((state) => state.data);
  const ai = useAI();
  const todayTasks = sortTasks(tasks.filter((task) => isTodayTask(task, today)));
  const completed = todayTasks.filter((task) => task.completed).length;
  const open = todayTasks.filter((task) => !task.completed).slice(0, 3);
  const hour = new Date().getHours();
  return (
    <ScrollView contentContainerStyle={[layout.page, { paddingTop: 12, gap: 22 }]}>
      <View style={{ gap: 3 }}>
        <Copy
          size={11}
          weight="600"
          muted
          style={{ letterSpacing: 1.7, textTransform: 'uppercase' }}
        >
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Copy>
        <Copy serif size={35} accessibilityRole="header">
          {hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.'}
        </Copy>
        <Copy muted size={14}>
          Let’s make room for what matters.
        </Copy>
      </View>
      <LinearGradient
        colors={['#2D5B43', '#1D4435']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.orb, { pointerEvents: 'none' }]}>
          <View style={styles.ring}>
            <View style={styles.ringInner}>
              <Icon name="leaf-outline" size={72} color="#AACB89" />
            </View>
          </View>
        </View>
        <View style={[layout.row, { gap: 7 }]}>
          <Icon name="sparkles-outline" size={15} color="#D9EF9E" />
          <Copy size={10} weight="600" style={{ color: '#D9EF9E', letterSpacing: 1.8 }}>
            A MOMENT FOR YOU
          </Copy>
        </View>
        <Copy serif size={35} style={{ color: '#FAFCEE', lineHeight: 42, maxWidth: 285 }}>
          A little less{'\n'}on your mind.
        </Copy>
        <Copy size={14} style={{ color: '#D2DFCB', maxWidth: 225 }}>
          Let your thoughts out.{'\n'}Find your next small step.
        </Copy>
        <Pressable
          accessibilityRole="button"
          onPress={props.onCapture}
          style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Copy size={14} weight="600" style={{ color: '#243C2D' }}>
            Clear my head
          </Copy>
          <Icon name="arrow-forward" size={18} color="#243C2D" />
        </Pressable>
      </LinearGradient>
      <View style={[layout.row, { gap: 12 }]}>
        {[
          {
            title: 'Plan my day',
            sub: 'Find your focus',
            icon: 'sunny-outline' as const,
            action: props.onPlan,
          },
          {
            title: 'Save a thought',
            sub: 'Keep it for later',
            icon: 'create-outline' as const,
            action: props.onCapture,
          },
        ].map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={item.action}
            style={{ flex: 1 }}
          >
            <Card style={{ padding: 16, gap: 8 }}>
              <View style={[styles.quickIcon, { backgroundColor: colors.soft }]}>
                <Icon name={item.icon} size={20} color={colors.green} />
              </View>
              <Copy weight="600" size={14}>
                {item.title}
              </Copy>
              <Copy muted size={12}>
                {item.sub}
              </Copy>
            </Card>
          </Pressable>
        ))}
      </View>
      {!ai.available && (
        <Pressable accessibilityRole="button" onPress={props.onSetup}>
          <View style={[styles.setup, { backgroundColor: colors.soft }]}>
            <Icon name="hardware-chip-outline" size={23} color={colors.green} />
            <View style={{ flex: 1, gap: 3 }}>
              <Copy size={13} weight="600">
                Your private AI, on your phone
              </Copy>
              <Copy size={12} muted>
                {Platform.OS === 'web'
                  ? 'Explore the app. Enable AI on iOS or Android.'
                  : 'Set up once. Use offline after download.'}
              </Copy>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.green} />
          </View>
        </Pressable>
      )}
      <View style={{ gap: 8 }}>
        <Section title="Today’s focus" action="Your planner" onPress={props.onTasks} />
        <Card style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          {todayTasks.length > 0 && (
            <View style={[layout.between, { paddingHorizontal: 9, paddingTop: 6 }]}>
              <Copy size={12} muted>
                {completed} of {todayTasks.length} complete
              </Copy>
              <Copy size={12} weight="600" style={{ color: colors.green }}>
                {Math.round((completed / todayTasks.length) * 100)}%
              </Copy>
            </View>
          )}
          {todayTasks.length > 0 && (
            <View
              style={{
                height: 4,
                backgroundColor: colors.soft,
                borderRadius: 3,
                marginHorizontal: 9,
              }}
            >
              <View
                style={{
                  height: 4,
                  width: `${(completed / todayTasks.length) * 100}%`,
                  backgroundColor: colors.green,
                  borderRadius: 3,
                }}
              />
            </View>
          )}
          {open.length ? (
            open.map((task) => <TaskRow key={task.id} task={task} onEdit={props.onEditTask} />)
          ) : (
            <Empty
              icon={todayTasks.length ? 'checkmark-done-outline' : 'partly-sunny-outline'}
              title={todayTasks.length ? 'You made space. Well done.' : 'What matters today?'}
              body={
                todayTasks.length
                  ? 'Your planned tasks are complete. Take a breath.'
                  : 'Start with one small, achievable thing.'
              }
            >
              <Button
                label="Add a small step"
                icon="add"
                variant="soft"
                onPress={props.onAddTask}
              />
            </Empty>
          )}
        </Card>
      </View>
      <View style={{ gap: 8 }}>
        <Section title="Fresh from your mind" action="All notes" onPress={props.onNotes} />
        {notes.length ? (
          [...notes]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 2)
            .map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => props.onEditNote(note)} />
            ))
        ) : (
          <Pressable accessibilityRole="button" onPress={props.onCapture}>
            <View style={[styles.noteEmpty, { borderColor: colors.line }]}>
              <Icon name="leaf-outline" color={colors.muted} />
              <Copy muted size={14} style={{ flex: 1 }}>
                A passing thought can become something good. Save your first one.
              </Copy>
              <Icon name="add" size={20} color={colors.green} />
            </View>
          </Pressable>
        )}
      </View>
      <View style={[layout.row, { justifyContent: 'center', marginTop: 4 }]}>
        <Icon name="shield-checkmark-outline" size={13} color={colors.muted} />
        <Copy muted size={11}>
          {Platform.OS === 'web'
            ? 'Browser preview · Stored in this browser'
            : 'Your thoughts stay in your app’s local vault'}
        </Copy>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  hero: { padding: 26, borderRadius: 27, gap: 14, overflow: 'hidden', minHeight: 285 },
  heroButton: {
    backgroundColor: '#D9EF9E',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    minHeight: 48,
    marginTop: 4,
  },
  orb: {
    position: 'absolute',
    right: -65,
    top: 24,
    width: 230,
    height: 230,
    borderRadius: 120,
    backgroundColor: '#426746',
    opacity: 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-25deg' }],
  },
  ring: {
    width: 185,
    height: 185,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: '#83A271',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 140,
    height: 140,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: '#83A271',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  setup: { padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteEmpty: {
    padding: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
});
