import { useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  MAX_NOTES,
  MAX_NOTE_LENGTH,
  MAX_TASKS,
  noteSchema,
  taskDraftSchema,
  type Category,
  type Note,
  type TaskDraft,
} from '../../domain/models';
import { actions, useAppDispatch, useAppSelector } from '../../store/store';
import { Button, Card, Copy, Input, Notice, Pill, Sheet, layout } from '../../ui/components';
import { engine } from '../ai/engine';
import { extractionPrompt, parseTaskDrafts, systemPrompt } from '../ai/prompts';
import { useAI } from '../ai/useAI';
import { LiveHealthButton } from '../performance/PerformancePanel';

const example =
  'Tomorrow I need to send the project update to my team. Also buy groceries and call Mum this weekend. I have an idea for a small balcony garden.';

export function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.data);
  const ai = useAI();
  const [id] = useState(note?.id ?? randomUUID());
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [category, setCategory] = useState<Category>(note?.category ?? 'Personal');
  const [drafts, setDrafts] = useState<(TaskDraft & { selected: boolean })[] | null>(null);
  const [error, setError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = drafts?.filter((draft) => draft.selected) ?? [];
  const dirty =
    body !== (note?.body ?? '') ||
    title !== (note?.title ?? '') ||
    category !== (note?.category ?? 'Personal');

  function close() {
    if (extracting) {
      engine.cancel();
      return;
    }
    if (dirty && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }
  function save() {
    setError('');
    const now = new Date().toISOString();
    const result = noteSchema.safeParse({
      id,
      title: title.trim() || body.trim().split('\n')[0]?.slice(0, 70) || 'Untitled thought',
      body,
      category,
      createdAt: note?.createdAt ?? now,
      updatedAt: now,
    });
    if (!result.success) {
      setError('Write a thought before saving.');
      return;
    }
    if (!note && data.notes.length >= MAX_NOTES) {
      setError('Your notebook is full. Remove an older note first.');
      return;
    }
    const taskResults = selected.map((draft) => taskDraftSchema.safeParse(draft));
    if (taskResults.some((draft) => !draft.success)) {
      setError('Check task titles and dates before saving.');
      return;
    }
    if (data.tasks.length + selected.length > MAX_TASKS) {
      setError('Your planner is full. Remove older tasks first.');
      return;
    }
    dispatch(actions.saveNote(result.data));
    dispatch(
      actions.addTasks(
        taskResults.flatMap((draft) =>
          draft.success
            ? [
                {
                  ...draft.data,
                  id: randomUUID(),
                  sourceNoteId: id,
                  completed: false,
                  createdAt: now,
                },
              ]
            : [],
        ),
      ),
    );
    onClose();
  }
  async function extract() {
    if (!ai.available) {
      setError(
        'Save your thought, then open Settings to download the AI model. Your note will be here when you return.',
      );
      return;
    }
    setExtracting(true);
    setError('');
    setDrafts(null);
    try {
      const raw = await engine.generate(
        systemPrompt(data.preferences.language),
        extractionPrompt(body),
        () => {},
      );
      setDrafts(parseTaskDrafts(raw).map((draft) => ({ ...draft, selected: true })));
    } catch (cause) {
      setError(
        cause instanceof SyntaxError || (cause instanceof Error && cause.name === 'ZodError')
          ? 'AI returned an incomplete task list. Your note is safe; retry or save it and add tasks manually.'
          : cause instanceof Error
            ? cause.message
            : 'Could not extract tasks.',
      );
    } finally {
      setExtracting(false);
    }
  }
  return (
    <Sheet visible title={note ? 'Your thought' : 'Clear a little space'} onClose={close}>
      <Copy muted>Plans, ideas, the things on your mind. Start anywhere.</Copy>
      {confirmClose && (
        <Card>
          <Copy>Discard your unsaved changes?</Copy>
          <View style={layout.row}>
            <Button label="Keep writing" variant="soft" onPress={() => setConfirmClose(false)} />
            <Button label="Discard" variant="danger" onPress={onClose} />
          </View>
        </Card>
      )}
      <Input
        accessibilityLabel="Note title"
        placeholder="Give it a title (optional)"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        editable={!extracting}
      />
      <Input
        accessibilityLabel="Your thought"
        placeholder="What's on your mind?"
        value={body}
        onChangeText={(value) => {
          setBody(value);
          setDrafts(null);
        }}
        multiline
        maxLength={MAX_NOTE_LENGTH}
        editable={!extracting}
        style={{ minHeight: 190, textAlignVertical: 'top' }}
      />
      <View style={layout.between}>
        <Copy size={12} muted>
          {body.length} / {MAX_NOTE_LENGTH}
        </Copy>
        {!note && !body && (
          <Button
            label="Try an example"
            variant="ghost"
            onPress={() => setBody(example)}
            style={{ minHeight: 44 }}
          />
        )}
      </View>
      <View style={layout.wrap}>
        {(['Personal', 'Work', 'Ideas'] as const).map((value) => (
          <Pill
            key={value}
            label={value}
            active={category === value}
            onPress={() => setCategory(value)}
          />
        ))}
      </View>
      <Card>
        <Copy weight="600">Turn thoughts into small steps</Copy>
        <Copy muted size={13}>
          Saathi finds possible action items. You choose what goes into your planner.
        </Copy>
        {extracting ? (
          <>
            <Button label="Finding action items…" loading onPress={() => {}} />
            <Button label="Stop generating" variant="ghost" onPress={engine.cancel} />
          </>
        ) : (
          <Button
            label={ai.available ? 'Find action items' : 'How to enable AI actions'}
            icon="sparkles-outline"
            variant="soft"
            disabled={!body.trim()}
            onPress={() => {
              void extract();
            }}
          />
        )}
      </Card>
      {drafts !== null && (
        <View style={{ gap: 12 }}>
          <Copy weight="600">
            {drafts.length ? 'Review your suggested tasks' : 'No action items found'}
          </Copy>
          {drafts.map((draft, index) => (
            <Card key={index}>
              <Pill
                label={draft.selected ? '✓ Add this task' : 'Skip this task'}
                active={draft.selected}
                onPress={() =>
                  setDrafts(
                    (items) =>
                      items?.map((item, i) =>
                        i === index ? { ...item, selected: !item.selected } : item,
                      ) ?? null,
                  )
                }
              />
              <Input
                accessibilityLabel={`Suggested task ${index + 1}`}
                value={draft.title}
                maxLength={160}
                onChangeText={(value) =>
                  setDrafts(
                    (items) =>
                      items?.map((item, i) => (i === index ? { ...item, title: value } : item)) ??
                      null,
                  )
                }
              />
              <Input
                accessibilityLabel={`Suggested date ${index + 1}`}
                value={draft.dueDate ?? ''}
                placeholder="YYYY-MM-DD (optional)"
                maxLength={10}
                onChangeText={(value) =>
                  setDrafts(
                    (items) =>
                      items?.map((item, i) =>
                        i === index ? { ...item, dueDate: value || null } : item,
                      ) ?? null,
                  )
                }
              />
              <View style={layout.wrap}>
                {(['low', 'medium', 'high'] as const).map((priority) => (
                  <Pill
                    key={priority}
                    label={priority}
                    active={draft.priority === priority}
                    onPress={() =>
                      setDrafts(
                        (items) =>
                          items?.map((item, i) => (i === index ? { ...item, priority } : item)) ??
                          null,
                      )
                    }
                  />
                ))}
              </View>
            </Card>
          ))}
          {!!drafts.length && (
            <Copy muted size={12}>
              Check dates and priorities. AI can make mistakes.
            </Copy>
          )}
        </View>
      )}
      {extracting && <LiveHealthButton />}
      {!!error && <Notice error>{error}</Notice>}
      <Button
        label={selected.length ? `Save note + ${selected.length} tasks` : 'Save thought'}
        icon="checkmark"
        onPress={save}
        disabled={!body.trim() || extracting}
      />
      {note && (
        <Button
          label={confirmDelete ? 'Confirm delete note' : 'Delete note'}
          icon="trash-outline"
          variant="danger"
          disabled={extracting}
          onPress={() => {
            if (!confirmDelete) setConfirmDelete(true);
            else {
              dispatch(actions.deleteNote(note.id));
              onClose();
            }
          }}
        />
      )}
    </Sheet>
  );
}
