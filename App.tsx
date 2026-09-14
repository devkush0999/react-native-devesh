import { Component, useEffect, useState, type ErrorInfo, type PropsWithChildren } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Note, Task } from './src/domain/models';
import { hydrateVault, persistCurrent, store, useAppSelector } from './src/store/store';
import { Button, Copy, Icon, Notice, Sheet, type IconName, layout } from './src/ui/components';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { engine } from './src/features/ai/engine';
import { useAI } from './src/features/ai/useAI';
import { HomeScreen } from './src/features/home/HomeScreen';
import { NotesScreen } from './src/features/notes/NotesScreen';
import { NoteEditor } from './src/features/notes/NoteEditor';
import { TaskEditor } from './src/features/tasks/TaskEditor';
import { TasksScreen } from './src/features/tasks/TasksScreen';
import { AssistantScreen } from './src/features/ai/AssistantScreen';
import type { AssistantMode } from './src/features/ai/prompts';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import {
  PerformancePanel,
  PerformanceShortcut,
  ThermalNotice,
} from './src/features/performance/PerformancePanel';
import { performanceMonitor } from './src/features/performance/monitor';

type Tab = 'today' | 'notes' | 'tasks' | 'assistant' | 'settings';
const tabs: { key: Tab; label: string; icon: IconName; active: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'sunny-outline', active: 'sunny' },
  { key: 'notes', label: 'Notes', icon: 'book-outline', active: 'book' },
  { key: 'tasks', label: 'Planner', icon: 'checkmark-circle-outline', active: 'checkmark-circle' },
  { key: 'assistant', label: 'Saathi AI', icon: 'sparkles-outline', active: 'sparkles' },
  { key: 'settings', label: 'Settings', icon: 'options-outline', active: 'options' },
];

function Shell() {
  const { colors, isDark } = useTheme();
  const hydrated = useAppSelector((state) => state.hydrated);
  const storageError = useAppSelector((state) => state.storageError);
  const saving = useAppSelector((state) => state.saving);
  const ai = useAI();
  const [tab, setTab] = useState<Tab>('today');
  const [noteEditor, setNoteEditor] = useState<{ note?: Note } | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ task?: Task } | null>(null);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('ask');
  const [background, setBackground] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  useEffect(() => {
    void hydrateVault();
    const subscription = AppState.addEventListener('change', (state) => {
      setBackground(state !== 'active');
      if (state !== 'active') performanceMonitor.background();
    });
    return () => {
      subscription.remove();
      performanceMonitor.background();
    };
  }, []);
  const openNote = (note: Note) => setNoteEditor({ note });
  const openTask = (task: Task) => setTaskEditor({ task });
  function plan() {
    setAssistantMode('plan');
    setTab('assistant');
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.frame, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={styles.header}>
          <View style={layout.row}>
            <View style={[styles.logo, { backgroundColor: colors.green }]}>
              <Icon name="leaf" size={22} color={isDark ? '#24382E' : '#EFF6D9'} />
            </View>
            <Copy serif size={28} style={{ letterSpacing: -1 }}>
              saathi
            </Copy>
          </View>
          <View
            style={[
              layout.row,
              { gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
            ]}
          >
            <PerformanceShortcut onPress={() => setHealthOpen(true)} />
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.green }} />
            <Copy size={9} weight="600" style={{ color: colors.green, letterSpacing: 1.2 }}>
              {Platform.OS === 'web'
                ? 'BROWSER PREVIEW'
                : ai.available
                  ? 'AI READY'
                  : 'LOCAL FIRST'}
            </Copy>
          </View>
        </View>
        {!hydrated ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 30, gap: 20 }}>
            <Icon name="lock-closed-outline" size={40} color={colors.green} />
            <Copy serif size={30}>
              Your own little space.
            </Copy>
            {storageError ? (
              <>
                <Notice error>{storageError}</Notice>
                <Button
                  label="Retry opening vault"
                  onPress={() => {
                    void hydrateVault();
                  }}
                />
              </>
            ) : (
              <Copy muted>Opening your local notebook…</Copy>
            )}
          </View>
        ) : (
          <>
            <ThermalNotice />
            {storageError && (
              <View style={{ paddingHorizontal: 24, gap: 4 }}>
                <Notice error>{storageError}</Notice>
                <Button
                  label="Retry saving changes"
                  variant="ghost"
                  onPress={() => {
                    void persistCurrent();
                  }}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {tab === 'today' && (
                <HomeScreen
                  onCapture={() => setNoteEditor({})}
                  onPlan={plan}
                  onSetup={() => setTab('settings')}
                  onTasks={() => setTab('tasks')}
                  onNotes={() => setTab('notes')}
                  onAddTask={() => setTaskEditor({})}
                  onEditNote={openNote}
                  onEditTask={openTask}
                />
              )}
              {tab === 'notes' && (
                <NotesScreen onCreate={() => setNoteEditor({})} onEdit={openNote} />
              )}
              {tab === 'tasks' && (
                <TasksScreen onCreate={() => setTaskEditor({})} onEdit={openTask} />
              )}
              <View style={{ flex: 1, display: tab === 'assistant' ? 'flex' : 'none' }}>
                <AssistantScreen initialMode={assistantMode} onOpenNote={openNote} />
              </View>
              {tab === 'settings' && <SettingsScreen />}
            </View>
            {saving && (
              <Copy size={10} muted style={{ textAlign: 'center' }}>
                Saving locally…
              </Copy>
            )}
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
              <View style={[styles.tabs, { borderColor: colors.line }]}>
                {tabs.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="tab"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: tab === item.key }}
                    onPress={() => {
                      setTab(item.key);
                      if (item.key === 'assistant') setAssistantMode('ask');
                    }}
                    style={styles.tab}
                  >
                    <View
                      style={[
                        styles.tabIcon,
                        { backgroundColor: tab === item.key ? colors.soft : 'transparent' },
                      ]}
                    >
                      <Icon
                        name={tab === item.key ? item.active : item.icon}
                        size={21}
                        color={tab === item.key ? colors.green : colors.muted}
                      />
                    </View>
                    <Copy
                      size={10}
                      weight={tab === item.key ? '600' : '400'}
                      style={{ color: tab === item.key ? colors.green : colors.muted }}
                    >
                      {item.label}
                    </Copy>
                  </Pressable>
                ))}
              </View>
            </SafeAreaView>
          </>
        )}
      </View>
      <Sheet visible={healthOpen} title="Device health" onClose={() => setHealthOpen(false)}>
        <PerformancePanel />
      </Sheet>
      {noteEditor && <NoteEditor note={noteEditor.note} onClose={() => setNoteEditor(null)} />}
      {taskEditor && <TaskEditor task={taskEditor.task} onClose={() => setTaskEditor(null)} />}
      {background && Platform.OS !== 'web' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
          ]}
        >
          <Icon name="leaf" size={40} color={colors.green} />
          <Copy serif size={32}>
            saathi
          </Copy>
        </View>
      )}
    </SafeAreaView>
  );
}

class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    engine.cancel();
  }
  render() {
    return this.state.failed ? (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 30,
          backgroundColor: '#F8F8F2',
          gap: 18,
        }}
      >
        <Copy serif size={30}>
          Let’s take a breath.
        </Copy>
        <Copy>
          Saathi couldn’t open this screen. Close and reopen the app. For native features, use a
          development build.
        </Copy>
      </View>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabs: { borderTopWidth: 1, paddingVertical: 8, paddingHorizontal: 8, flexDirection: 'row' },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: {
    width: 47,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
