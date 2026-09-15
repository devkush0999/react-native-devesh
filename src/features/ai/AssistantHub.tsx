import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Note } from '../../domain/models';
import { Pill, layout } from '../../ui/components';
import { AssistantScreen } from './AssistantScreen';
import type { AssistantMode } from './prompts';
import { VoiceScreen } from '../voice/VoiceScreen';

export function AssistantHub({
  initialMode,
  onOpenNote,
  voiceRequest,
}: {
  initialMode: AssistantMode;
  onOpenNote: (note: Note) => void;
  voiceRequest: number;
}) {
  const [section, setSection] = useState<'text' | 'voice'>('voice');
  useEffect(() => {
    if (initialMode === 'plan') setSection('text');
  }, [initialMode]);
  useEffect(() => {
    if (voiceRequest) setSection('voice');
  }, [voiceRequest]);
  return (
    <View style={{ flex: 1 }}>
      <View style={[layout.wrap, { paddingHorizontal: 24, paddingTop: 10 }]}>
        <Pill
          label="Voice studio"
          active={section === 'voice'}
          onPress={() => setSection('voice')}
        />
        <Pill
          label="Text assistant"
          active={section === 'text'}
          onPress={() => setSection('text')}
        />
      </View>
      <View style={{ flex: 1, display: section === 'voice' ? 'flex' : 'none' }}>
        <VoiceScreen />
      </View>
      <View style={{ flex: 1, display: section === 'text' ? 'flex' : 'none' }}>
        <AssistantScreen initialMode={initialMode} onOpenNote={onOpenNote} />
      </View>
    </View>
  );
}
