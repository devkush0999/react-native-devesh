import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  MAX_VOICE_NOTES,
  MAX_TRANSCRIPT_LENGTH,
  voiceNoteSchema,
  type VoiceLanguage,
  type VoiceMode,
  type VoiceNote,
} from '../../domain/voice';
import { MAX_TASKS, taskDraftSchema } from '../../domain/models';
import { actions, store, useAppDispatch, useAppSelector } from '../../store/store';
import {
  Button,
  Card,
  Copy,
  Empty,
  Icon,
  Input,
  Notice,
  Pill,
  Sheet,
  layout,
} from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { useAI } from '../ai/useAI';
import { LiveHealthButton } from '../performance/PerformancePanel';
import { elapsedLabel } from '../performance/chart';
import { TaskDraftReview, type SelectableTaskDraft } from '../tasks/TaskDraftReview';
import { VoiceSetup } from './VoiceSetup';
import { voice, useVoice } from './service';

const modes: { key: VoiceMode; label: string; detail: string }[] = [
  {
    key: 'note',
    label: 'Voice note',
    detail: 'Speak a thought, review its transcript, and save it privately.',
  },
  {
    key: 'dictation',
    label: 'Live dictation',
    detail: 'Text updates after pauses or roughly 8 seconds of speech, plus processing time.',
  },
  {
    key: 'meeting',
    label: 'Meeting',
    detail:
      'Record up to 10 minutes, then review the transcript, summary and action items. No speaker identification.',
  },
  {
    key: 'activity',
    label: 'Speech / silence',
    detail:
      'Detect voice activity without transcribing. Indicators describe the latest processed audio, not who is speaking.',
  },
  {
    key: 'assistant',
    label: 'Voice assistant',
    detail:
      'Tap to speak, finish your question, and hear an offline answer. One turn at a time; microphone closes before playback.',
  },
];
function LanguagePicker({
  value,
  onChange,
}: {
  value: VoiceLanguage;
  onChange: (value: VoiceLanguage) => void;
}) {
  return (
    <View style={layout.wrap}>
      {(['en', 'hi'] as const).map((language) => (
        <Pill
          key={language}
          label={language === 'en' ? 'English' : 'Hindi'}
          active={value === language}
          onPress={() => onChange(language)}
        />
      ))}
    </View>
  );
}

export function VoiceScreen() {
  const state = useVoice();
  const ai = useAI();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const notes = useAppSelector((s) => s.data.voiceNotes);
  const notebook = useAppSelector((s) => s.data.notes);
  const [space, setSpace] = useState<'record' | 'read' | 'saved'>('record');
  const [mode, setMode] = useState<VoiceMode>('note');
  const [language, setLanguage] = useState<VoiceLanguage>('en');
  const [title, setTitle] = useState('');
  const [draftId, setDraftId] = useState(randomUUID);
  const [saved, setSaved] = useState(false);
  const [readText, setReadText] = useState('');
  const [speed, setSpeed] = useState(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<VoiceNote | null>(null);
  const [error, setError] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const busy = state.status !== 'idle';
  const locked = busy || ai.status === 'generating' || ai.status === 'downloading';
  useEffect(() => {
    setSaved(false);
  }, [state.transcript, state.summary]);
  function start() {
    if (state.transcript && !saved && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setConfirmNew(false);
    setTitle('');
    setDraftId(randomUUID());
    setSaved(false);
    setError('');
    void voice.record(mode, language);
  }
  function save() {
    const now = new Date().toISOString();
    if (
      store.getState().data.voiceNotes.length >= MAX_VOICE_NOTES &&
      !store.getState().data.voiceNotes.some((note) => note.id === draftId)
    ) {
      setError('Voice notebook is full. Remove a saved transcript first.');
      return;
    }
    const result = voiceNoteSchema.safeParse({
      id: draftId,
      title: title.trim() || `Voice note · ${new Date().toLocaleDateString('en-IN')}`,
      transcript: state.transcript,
      summary: state.summary,
      language: state.language,
      durationSeconds: state.durationSeconds,
      createdAt: now,
    });
    if (!result.success) {
      setError('Check the title and transcript before saving.');
      return;
    }
    dispatch(actions.saveVoiceNote(result.data));
    setSaved(true);
    setError('');
  }
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.page}>
      <View>
        <Copy serif size={34} accessibilityRole="header">
          A voice, a little clarity.
        </Copy>
        <Copy muted size={14}>
          Listen. Remember. Make a little room.
        </Copy>
      </View>
      <View style={layout.wrap}>
        {(
          [
            { key: 'record', label: 'Capture' },
            { key: 'read', label: 'Read aloud' },
            { key: 'saved', label: `Saved (${notes.length})` },
          ] as const
        ).map((item) => (
          <Pill
            key={item.key}
            label={item.label}
            active={space === item.key}
            onPress={() => setSpace(item.key)}
          />
        ))}
      </View>
      {!state.supported && (
        <Notice>
          Voice runs on iOS / Android with a native development build. This preview lets you explore
          the screens; it does not simulate audio or AI.
        </Notice>
      )}
      {busy && (
        <Card>
          <View style={layout.row}>
            <Icon
              name={state.status === 'recording' ? 'mic' : 'radio-outline'}
              color={colors.green}
            />
            <Copy weight="600">{state.stage || 'Requesting microphone access…'}</Copy>
          </View>
          {state.status === 'recording' && (
            <Button label="Finish recording" icon="stop-circle-outline" onPress={voice.finish} />
          )}
          <Button
            label={state.status === 'permission' ? 'Cancel' : 'Stop voice operation'}
            variant="ghost"
            onPress={voice.cancel}
          />
          <LiveHealthButton />
        </Card>
      )}
      {state.error && <Notice error>{state.error}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {state.notice && <Notice>{state.notice}</Notice>}
      {space === 'record' && (
        <>
          <View style={layout.wrap}>
            {modes.map((item) => (
              <Pill
                key={item.key}
                label={item.label}
                active={mode === item.key}
                onPress={() => {
                  if (!busy) setMode(item.key);
                }}
              />
            ))}
          </View>
          <Card>
            <Copy serif size={23}>
              {modes.find((item) => item.key === mode)!.label}
            </Copy>
            <Copy muted size={14}>
              {modes.find((item) => item.key === mode)!.detail}
            </Copy>
            <LanguagePicker
              value={language}
              onChange={(value) => {
                if (!busy) setLanguage(value);
              }}
            />
            <Copy muted size={12}>
              Hindi transcription can use Devanagari. Mixed Hindi/English accuracy varies. Audio is
              processed in memory; saved notes contain text, not replayable recordings.
            </Copy>
            <View
              accessible
              accessibilityLabel={`Microphone input level, ${elapsedLabel(state.durationSeconds * 1000)} captured`}
              style={{ flexDirection: 'row', height: 48, gap: 3, alignItems: 'center' }}
            >
              {Array.from({ length: 32 }, (_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: Math.max(3, (state.levels[index] ?? 0) * 48),
                    borderRadius: 4,
                    backgroundColor: state.levels.length ? colors.green : colors.line,
                  }}
                />
              ))}
            </View>
            <Copy size={13}>
              {elapsedLabel(state.durationSeconds * 1000)} captured ·{' '}
              {elapsedLabel(state.speechSeconds * 1000)} detected speech
            </Copy>
            <Copy muted size={12}>
              {state.speechDetected === null
                ? 'Speech detector is waiting for audio.'
                : state.speechDetected
                  ? 'Speech detected in the last processed window.'
                  : 'No speech detected in the last processed window.'}{' '}
              {state.queuedSeconds > 1
                ? `${Math.ceil(state.queuedSeconds)}s queued for processing.`
                : ''}
            </Copy>
            {confirmNew && (
              <Notice>
                Starting a new clip will replace the unsaved transcript below. Save it first, or tap
                “Start new clip” to discard it.
              </Notice>
            )}
            {!busy && (
              <Button
                label={confirmNew ? 'Start new clip' : 'Start recording'}
                icon="mic-outline"
                disabled={
                  !state.supported ||
                  locked ||
                  !state.ready.speech ||
                  (mode === 'assistant' && (!ai.available || !state.ready[language]))
                }
                onPress={start}
              />
            )}
            {confirmNew && (
              <Button
                label="Keep current transcript"
                variant="ghost"
                onPress={() => setConfirmNew(false)}
              />
            )}
            <Copy muted size={12}>
              Recording stops when you leave the app, at the clip limit, or when thermal protection
              triggers. Ask everyone’s permission before recording a meeting.
            </Copy>
          </Card>
          {(!state.ready.speech || (mode === 'assistant' && !state.ready[language])) && (
            <VoiceSetup />
          )}
          {mode === 'assistant' && !ai.available && (
            <Notice>Set up the text AI model in Settings to generate voice answers.</Notice>
          )}
          {(state.transcript || state.draft) && (
            <Card>
              <Copy weight="600">Review transcript</Copy>
              <Input
                accessibilityLabel="Voice note title"
                placeholder="A title for this recording"
                value={title}
                maxLength={100}
                editable={!busy}
                onChangeText={(value) => {
                  setTitle(value);
                  setSaved(false);
                }}
              />
              <Input
                accessibilityLabel="Voice transcript"
                multiline
                value={state.transcript}
                editable={!busy}
                onChangeText={voice.editTranscript}
                maxLength={MAX_TRANSCRIPT_LENGTH}
                style={{ minHeight: 160, textAlignVertical: 'top' }}
              />
              {!!state.draft && (
                <Copy muted selectable>
                  {state.draft} …
                </Copy>
              )}
              <Copy muted size={12}>
                {state.transcript.length} / {MAX_TRANSCRIPT_LENGTH} characters · Edit misheard
                names, amounts and dates.
              </Copy>
              <Button
                label={saved ? 'Transcript saved' : 'Save transcript'}
                icon="bookmark-outline"
                disabled={busy || saved || !state.transcript.trim()}
                onPress={save}
              />
              <Button
                label="Summarize & find action items"
                variant="soft"
                disabled={locked || !ai.available || !state.transcript.trim()}
                onPress={() => {
                  void voice.summarize(state.transcript, state.language);
                }}
              />
              {!ai.available && (
                <Copy muted size={12}>
                  Meeting summaries require the text AI model in Settings.
                </Copy>
              )}
            </Card>
          )}
          {!!state.summary && (
            <Card>
              <Copy weight="600">Meeting summary</Copy>
              <Copy selectable>{state.summary}</Copy>
              <Copy muted size={12}>
                Generated from all transcript chunks. Verify against your transcript before saving.
              </Copy>
              <MeetingActions />
            </Card>
          )}
          {!!state.answer && (
            <Card>
              <Copy weight="600">Saathi’s reply</Copy>
              <Copy selectable>{state.answer}</Copy>
              <Button
                label="Read reply again"
                variant="soft"
                disabled={locked}
                onPress={() => {
                  void voice.speak(state.answer, state.language, 1);
                }}
              />
            </Card>
          )}
        </>
      )}
      {space === 'read' && (
        <Card>
          <Copy serif size={23}>
            Give your eyes a rest.
          </Copy>
          <Copy muted size={13}>
            Paste an article or choose a saved note. Read-aloud uses downloaded Kokoro voices
            locally.
          </Copy>
          <LanguagePicker
            value={language}
            onChange={(value) => {
              if (!busy) setLanguage(value);
            }}
          />
          {language === 'hi' && (
            <Copy muted size={12}>
              Use Hindi in Devanagari for the Hindi voice. Roman-script Hinglish pronunciation is
              not reliable.
            </Copy>
          )}
          <Input
            accessibilityLabel="Text to read aloud"
            placeholder="Paste text to listen to…"
            multiline
            value={readText}
            editable={!busy}
            maxLength={MAX_TRANSCRIPT_LENGTH}
            onChangeText={setReadText}
            style={{ minHeight: 180, textAlignVertical: 'top' }}
          />
          <View style={layout.wrap}>
            {[0.75, 1, 1.25, 1.5].map((value) => (
              <Pill
                key={value}
                label={`${value}×`}
                active={speed === value}
                onPress={() => {
                  if (!busy) setSpeed(value);
                }}
              />
            ))}
          </View>
          <Button
            label="Read aloud"
            icon="volume-high-outline"
            disabled={!state.supported || locked || !readText.trim() || !state.ready[language]}
            onPress={() => {
              void voice.speak(readText, language, speed);
            }}
          />
          {!state.ready[language] && (
            <Copy muted size={12}>
              Download the {language === 'en' ? 'English' : 'Hindi'} voice in Settings first.
            </Copy>
          )}
          {!!state.transcript && (
            <Button
              label="Use current transcript"
              variant="ghost"
              disabled={busy}
              onPress={() => setReadText(state.transcript)}
            />
          )}
          <Input
            accessibilityLabel="Find a saved note to read"
            placeholder="Find a notebook note…"
            value={query}
            onChangeText={setQuery}
          />
          {notebook
            .filter((note) =>
              `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 8)
            .map((note) => (
              <Button
                key={note.id}
                label={note.title}
                icon="document-text-outline"
                variant="soft"
                disabled={busy}
                onPress={() => setReadText(note.body)}
              />
            ))}
        </Card>
      )}
      {space === 'saved' && (
        <>
          {!notes.length && (
            <Empty
              icon="mic-outline"
              title="Your voice, remembered."
              body="Reviewed transcripts you save will appear here."
            />
          )}
          {notes.map((note) => (
            <Card key={note.id}>
              <Copy serif size={22}>
                {note.title}
              </Copy>
              <Copy muted size={12}>
                {new Date(note.createdAt).toLocaleDateString('en-IN')} ·{' '}
                {elapsedLabel(note.durationSeconds * 1000)} ·{' '}
                {note.language === 'hi' ? 'Hindi' : 'English'}
              </Copy>
              <Copy muted numberOfLines={3}>
                {note.transcript}
              </Copy>
              <Button label="Open transcript" variant="soft" onPress={() => setSelected(note)} />
            </Card>
          ))}
        </>
      )}
      {selected && (
        <SavedVoiceNote
          note={selected}
          onClose={() => setSelected(null)}
          onRead={(text, lang) => {
            setReadText(text);
            setLanguage(lang);
            setSelected(null);
            setSpace('read');
          }}
        />
      )}
    </ScrollView>
  );
}

function MeetingActions() {
  const state = useVoice();
  const [drafts, setDrafts] = useState<SelectableTaskDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();
  useEffect(() => {
    setDrafts(state.tasks.map((task) => ({ ...task, selected: false })));
    setAdded(false);
    setError('');
  }, [state.tasks]);
  const selected = drafts.filter((draft) => draft.selected);
  function add() {
    const results = selected.map((draft) => taskDraftSchema.safeParse(draft));
    if (!selected.length || results.some((result) => !result.success)) {
      setError('Check the selected task titles and dates.');
      return;
    }
    if (store.getState().data.tasks.length + selected.length > MAX_TASKS) {
      setError('The planner is full. Remove older tasks first.');
      return;
    }
    const now = new Date().toISOString();
    dispatch(
      actions.addTasks(
        results.flatMap((result) =>
          result.success
            ? [{ ...result.data, id: randomUUID(), completed: false, createdAt: now }]
            : [],
        ),
      ),
    );
    setAdded(true);
    setOpen(false);
  }
  return (
    <>
      <Copy muted size={12}>
        {state.tasks.length
          ? `${state.tasks.length} suggested action items. Nothing has been added to your planner.`
          : 'No explicit action items found.'}
      </Copy>
      {!!state.tasks.length && (
        <Button
          label={added ? 'Selected tasks added' : 'Review action items'}
          variant="soft"
          disabled={added || state.status !== 'idle'}
          onPress={() => setOpen(true)}
        />
      )}
      <Sheet visible={open} title="Review action items" onClose={() => setOpen(false)}>
        <Copy muted>Select the tasks to add. Check their wording, priority and dates.</Copy>
        <TaskDraftReview drafts={drafts} onChange={setDrafts} />
        {error && <Notice error>{error}</Notice>}
        <Button
          label={`Add ${selected.length} tasks to planner`}
          disabled={!selected.length || added}
          onPress={add}
        />
      </Sheet>
    </>
  );
}

function SavedVoiceNote({
  note,
  onClose,
  onRead,
}: {
  note: VoiceNote;
  onClose: () => void;
  onRead: (text: string, language: VoiceLanguage) => void;
}) {
  const dispatch = useAppDispatch();
  const [deleting, setDeleting] = useState(false);
  return (
    <Sheet visible title="Saved voice note" onClose={onClose}>
      <Copy serif size={25}>
        {note.title}
      </Copy>
      <Copy selectable>{note.transcript}</Copy>
      {!!note.summary && (
        <Card>
          <Copy weight="600">Summary</Copy>
          <Copy selectable>{note.summary}</Copy>
        </Card>
      )}
      <Button
        label="Use in read-aloud"
        icon="volume-high-outline"
        onPress={() => onRead(note.transcript, note.language)}
      />
      {deleting && (
        <Notice error>This removes the saved transcript and summary from this device.</Notice>
      )}
      <Button
        label={deleting ? 'Confirm delete transcript' : 'Delete transcript'}
        variant="danger"
        onPress={() => {
          if (!deleting) setDeleting(true);
          else {
            dispatch(actions.deleteVoiceNote(note.id));
            onClose();
          }
        }}
      />
    </Sheet>
  );
}

export function VoiceShortcut({ onPress }: { onPress: () => void }) {
  const state = useVoice();
  if (state.status === 'idle') return null;
  return (
    <Button
      label={state.status === 'recording' ? 'Mic on' : 'Voice active'}
      icon="mic-outline"
      variant="soft"
      onPress={onPress}
      style={{ minHeight: 38, paddingVertical: 6, paddingHorizontal: 8 }}
    />
  );
}
