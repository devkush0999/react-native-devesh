import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { MAX_NOTES, MAX_NOTE_LENGTH, type Note } from '../../domain/models';
import { actions, useAppDispatch, useAppSelector } from '../../store/store';
import { Button, Card, Copy, Icon, Input, Notice, Pill, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { AISetupCard } from './AISetupCard';
import { engine } from './engine';
import { assistantPrompt, systemPrompt, visibleAnswer, type AssistantMode } from './prompts';
import { useAI } from './useAI';
import { LiveHealthButton } from '../performance/PerformancePanel';

export function AssistantScreen({
  initialMode = 'ask',
  onOpenNote,
}: {
  initialMode?: AssistantMode;
  onOpenNote: (note: Note) => void;
}) {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.data);
  const ai = useAI();
  const { colors } = useTheme();
  const [mode, setMode] = useState(initialMode);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Note[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [working, setWorking] = useState(false);
  const [finished, setFinished] = useState(false);
  const mounted = useRef(true);
  const raw = useRef('');
  const lastFlush = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      engine.cancel();
    };
  }, []);

  useEffect(() => { if (!working) setMode(initialMode); }, [initialMode]);

  async function run() {
    if (working) return;
    setError('');
    setAnswer('');
    setSaved(false);
    setFinished(false);
    raw.current = '';
    const request = assistantPrompt(mode, question, data.notes, data.tasks);
    setSources(request.sources);
    if (mode === 'ask' && !request.sources.length) {
      setError('No notes matched those keywords. Try a name or phrase from a saved note.');
      return;
    }
    if (mode === 'plan' && !data.tasks.some((task) => !task.completed)) {
      setError('Add a task to your planner first, then I can help you prioritize.');
      return;
    }
    setWorking(true);
    try {
      const result = await engine.generate(
        systemPrompt(data.preferences.language),
        request.prompt,
        (token) => {
          raw.current += token;
          if (mounted.current && Date.now() - lastFlush.current > 80) {
            setAnswer(visibleAnswer(raw.current));
            lastFlush.current = Date.now();
          }
        },
      );
      if (mounted.current) {
        const visible = visibleAnswer(result);
        if (!visible)
          throw new Error('The model did not produce an answer. Try a shorter request.');
        setAnswer(visible);
        setFinished(true);
      }
    } catch (cause) {
      if (mounted.current) {
        setAnswer('');
        setError(cause instanceof Error ? cause.message : 'Please try again.');
      }
    } finally {
      if (mounted.current) setWorking(false);
    }
  }
  function saveAnswer() {
    if (data.notes.length >= MAX_NOTES) {
      setError('Your notebook is full. Remove an older note first.');
      return;
    }
    const now = new Date().toISOString();
    dispatch(
      actions.saveNote({
        id: randomUUID(),
        title:
          mode === 'plan'
            ? `A plan for ${new Date().toLocaleDateString('en-IN')}`
            : question.slice(0, 80) || 'A little clarity',
        body: answer.slice(0, MAX_NOTE_LENGTH),
        category: 'Personal',
        createdAt: now,
        updatedAt: now,
      }),
    );
    setSaved(true);
  }
  const modeInfo = {
    ask: {
      title: 'Ask your notebook',
      body: 'Find the little details you saved.',
      placeholder: 'What did I note about the project deadline?',
      label: 'Find some clarity',
    },
    plan: {
      title: 'Make room for today',
      body: 'A realistic plan from your open tasks.',
      placeholder: 'Optional: I have two free hours this evening…',
      label: 'Help me plan',
    },
    rewrite: {
      title: 'Untangle a thought',
      body: 'The same meaning, a little more clearly.',
      placeholder: 'Paste a thought you want to make clearer…',
      label: 'Make it clearer',
    },
  }[mode];
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.page}>
      <View>
        <Copy serif size={34} accessibilityRole="header">
          A little clarity.
        </Copy>
        <Copy muted size={14}>
          Your own space to think things through.
        </Copy>
      </View>
      <View style={layout.wrap}>
        {(
          [
            { key: 'ask', label: 'Ask my notes' },
            { key: 'plan', label: 'Plan my day' },
            { key: 'rewrite', label: 'Rewrite' },
          ] as const
        ).map((item) => (
          <Pill
            key={item.key}
            label={item.label}
            active={mode === item.key}
            onPress={() => {
              if (!working) {
                setMode(item.key);
                setAnswer('');
                setSources([]);
                setError('');
                setSaved(false);
                setFinished(false);
              }
            }}
          />
        ))}
      </View>
      {!ai.available && <AISetupCard />}
      <Card style={{ gap: 16 }}>
        <View style={layout.row}>
          <Icon name="sparkles-outline" color={colors.green} />
          <Copy serif size={23}>
            {modeInfo.title}
          </Copy>
        </View>
        <Copy muted size={14}>
          {modeInfo.body}
        </Copy>
        <Input
          accessibilityLabel={modeInfo.title}
          value={question}
          onChangeText={setQuestion}
          placeholder={modeInfo.placeholder}
          maxLength={1200}
          multiline
          editable={!working}
          style={{ minHeight: 130, textAlignVertical: 'top' }}
        />
        {mode === 'ask' && (
          <Copy size={12} muted>
            Uses up to 4 notes selected by matching keywords. Each request starts fresh.
          </Copy>
        )}
        {working ? (
          <>
            <Button label="Thinking on your device…" loading onPress={() => {}} />
            <Button label="Stop generating" variant="ghost" onPress={engine.cancel} />
          </>
        ) : (
          <Button
            label={modeInfo.label}
            icon="sparkles-outline"
            disabled={!ai.available || (mode !== 'plan' && !question.trim())}
            onPress={() => {
              void run();
            }}
          />
        )}
      </Card>
      {working && <LiveHealthButton />}
      {!!error && <Notice error>{error}</Notice>}
      {(answer || working) && (
        <Card>
          <View style={layout.row}>
            <Icon name="leaf-outline" size={18} color={colors.green} />
            <Copy weight="600">Saathi</Copy>
            <Copy muted size={11}>
              ON DEVICE
            </Copy>
          </View>
          <Copy selectable size={15}>
            {answer || 'Finding a helpful place to start…'}
          </Copy>
          {finished && (
            <>
              <Copy muted size={12}>
                A suggestion to review. Nothing in your planner has changed.
              </Copy>
              <Button
                label={saved ? 'Saved to notebook' : 'Save this thought'}
                icon={saved ? 'checkmark' : 'bookmark-outline'}
                variant="soft"
                onPress={saveAnswer}
                disabled={saved}
              />
            </>
          )}
        </Card>
      )}
      {sources.length > 0 && (
        <View style={{ gap: 8 }}>
          <Copy size={12} weight="600" muted>
            NOTES SHARED WITH THE LOCAL MODEL
          </Copy>
          {sources.map((note) => (
            <Button
              key={note.id}
              label={note.title}
              icon="document-text-outline"
              variant="soft"
              onPress={() => onOpenNote(note)}
              disabled={working}
            />
          ))}
        </View>
      )}
      <Copy muted size={12} style={{ textAlign: 'center' }}>
        AI can miss details. Check important names, dates and suggestions.
      </Copy>
    </ScrollView>
  );
}
