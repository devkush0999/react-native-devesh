import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { Category, Note } from '../../domain/models';
import { useAppSelector } from '../../store/store';
import { Button, Card, Copy, Empty, Icon, Input, Pill, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';

export function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open note: ${note.title}`}
      onPress={onPress}
    >
      <Card style={{ gap: 10 }}>
        <View style={layout.between}>
          <View style={[layout.row, { gap: 6 }]}>
            <Icon
              name={
                note.category === 'Work'
                  ? 'briefcase-outline'
                  : note.category === 'Ideas'
                    ? 'bulb-outline'
                    : 'leaf-outline'
              }
              size={14}
              color={colors.green}
            />
            <Copy
              size={11}
              weight="600"
              style={{ color: colors.green, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              {note.category}
            </Copy>
          </View>
          <Copy muted size={11}>
            {new Date(note.updatedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </Copy>
        </View>
        <Copy serif size={21} numberOfLines={2}>
          {note.title}
        </Copy>
        <Copy muted size={14} numberOfLines={3}>
          {note.body}
        </Copy>
      </Card>
    </Pressable>
  );
}

export function NotesScreen({
  onCreate,
  onEdit,
}: {
  onCreate: () => void;
  onEdit: (note: Note) => void;
}) {
  const notes = useAppSelector((state) => state.data.notes);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const filtered = useMemo(
    () =>
      notes
        .filter(
          (note) =>
            (category === 'All' || note.category === category) &&
            `${note.title} ${note.body}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes, query, category],
  );
  return (
    <FlatList
      data={filtered}
      keyExtractor={(note) => note.id}
      contentContainerStyle={[layout.page, { gap: 14 }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 20, paddingBottom: 8 }}>
          <View style={layout.between}>
            <View>
              <Copy serif size={34} accessibilityRole="header">
                Your notebook
              </Copy>
              <Copy muted size={14}>
                A home for everything on your mind.
              </Copy>
            </View>
          </View>
          <Button label="Save a thought" icon="add" onPress={onCreate} />
          <Input
            accessibilityLabel="Search notes"
            value={query}
            onChangeText={setQuery}
            placeholder="Search your thoughts…"
          />
          <View style={layout.wrap}>
            {(['All', 'Personal', 'Work', 'Ideas'] as const).map((value) => (
              <Pill
                key={value}
                label={value}
                active={category === value}
                onPress={() => setCategory(value)}
              />
            ))}
          </View>
          <Copy muted size={12}>
            {filtered.length} {filtered.length === 1 ? 'THOUGHT' : 'THOUGHTS'}
          </Copy>
        </View>
      }
      renderItem={({ item }) => <NoteCard note={item} onPress={() => onEdit(item)} />}
      ListEmptyComponent={
        <Empty
          icon="book-outline"
          title={notes.length ? 'No matching thoughts' : 'Good ideas need a home'}
          body={
            notes.length
              ? 'Try a different word or category.'
              : 'Capture a plan, a passing idea, or something you want to remember.'
          }
        />
      }
    />
  );
}
