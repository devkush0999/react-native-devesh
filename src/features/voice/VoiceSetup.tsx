import { View } from 'react-native';
import { Button, Card, Copy, Icon, Notice, layout } from '../../ui/components';
import { useAI } from '../ai/useAI';
import { voice, useVoice } from './service';
import type { VoicePack } from '../../domain/voice';

const packs: { key: VoicePack; title: string; detail: string }[] = [
  { key: 'speech', title: 'Voice notes & dictation', detail: 'Whisper Tiny multilingual + FSMN speech detector · English and Hindi input' },
  { key: 'en', title: 'English read-aloud', detail: 'Kokoro · Heart voice · English text' },
  { key: 'hi', title: 'Hindi read-aloud', detail: 'Kokoro · Alpha voice · Hindi in Devanagari script' },
];
export function VoiceSetup() {
  const state = useVoice(); const ai = useAI();
  const busy = state.status !== 'idle' || ai.status === 'generating' || ai.status === 'downloading';
  return <Card>
    <View style={layout.row}><Icon name="mic-outline" /><Copy weight="600">Offline voice packs</Copy></View>
    <Copy muted size={13}>Download only the packs you need. Speech and voices use separate model files, which can take hundreds of MB. Use Wi-Fi and keep room for the download and model memory.</Copy>
    {!state.supported && <Notice>Microphone AI and read-aloud require the native development build. They are unavailable in this browser preview.</Notice>}
    {packs.map((pack) => <View key={pack.key} style={{ gap: 6, paddingVertical: 8 }}>
      <Copy weight="600" size={14}>{pack.title}</Copy><Copy muted size={12}>{pack.detail}</Copy>
      <Button label={state.ready[pack.key] ? 'Files ready on this device' : `Download / load ${pack.key === 'speech' ? 'speech pack' : pack.key === 'en' ? 'English voice' : 'Hindi voice'}`} icon={state.ready[pack.key] ? 'checkmark-circle-outline' : 'download-outline'} variant="soft" disabled={!state.supported || busy || state.ready[pack.key]} onPress={() => { void voice.prepare(pack.key); }} />
    </View>)}
    {state.status === 'downloading' && <><Copy size={13}>{state.stage} · {Math.round(state.progress * 100)}%</Copy><Button label="Cancel voice download" variant="ghost" onPress={voice.cancel} /></>}
    {state.error && <Notice error>{state.error}</Notice>}
    <Copy muted size={12}>After restarting, “Download / load” reuses cached files. Runtime model memory is released after each operation. Download analytics are disabled.</Copy>
  </Card>;
}
