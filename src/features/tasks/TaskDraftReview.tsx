import { View } from 'react-native';
import type { TaskDraft } from '../../domain/models';
import { Card, Input, Pill, layout } from '../../ui/components';

export type SelectableTaskDraft = TaskDraft & { selected: boolean };
export function TaskDraftReview({ drafts, onChange }: { drafts: SelectableTaskDraft[]; onChange: (drafts: SelectableTaskDraft[]) => void }) {
  function patch(index: number, change: Partial<SelectableTaskDraft>) { onChange(drafts.map((draft, i) => i === index ? { ...draft, ...change } : draft)); }
  return <View style={{ gap: 12 }}>{drafts.map((draft, index) => <Card key={index}>
    <Pill label={draft.selected ? '✓ Add this task' : 'Skip this task'} active={draft.selected} onPress={() => patch(index, { selected: !draft.selected })} />
    <Input accessibilityLabel={`Suggested task ${index + 1}`} value={draft.title} maxLength={160} onChangeText={(title) => patch(index, { title })} />
    <Input accessibilityLabel={`Suggested date ${index + 1}`} value={draft.dueDate ?? ''} placeholder="YYYY-MM-DD (optional)" maxLength={10} onChangeText={(dueDate) => patch(index, { dueDate: dueDate || null })} />
    <View style={layout.wrap}>{(['low', 'medium', 'high'] as const).map((priority) => <Pill key={priority} label={priority} active={draft.priority === priority} onPress={() => patch(index, { priority })} />)}</View>
  </Card>)}</View>;
}
