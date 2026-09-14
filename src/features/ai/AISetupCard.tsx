import { Platform, View } from 'react-native';
import { Button, Card, Copy, Icon, Notice, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { engine } from './engine';
import { useAI } from './useAI';

export function AISetupCard() {
  const ai = useAI();
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 16 }}>
      <View style={layout.row}>
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.soft }}>
          <Icon name="hardware-chip-outline" color={colors.green} size={25} />
        </View>
        <View style={{ flex: 1 }}>
          <Copy weight="600">A small AI. A personal space.</Copy>
          <Copy muted size={12}>
            Qwen3 · 0.6B · Quantized CPU model
          </Copy>
        </View>
      </View>
      <Copy muted size={14}>
        {ai.available
          ? 'Model files are ready on this device. Saathi loads the model when you ask, then frees its memory.'
          : 'Download the model once to turn notes into actions, make a daily plan, and ask about your notes. No account or API key.'}
      </Copy>
      {!ai.available && (
        <Copy muted size={12}>
          Roughly 0.5–0.8 GB download. Keep at least 2 GB free storage; a phone with 4 GB+ RAM is
          recommended for testing. Use Wi-Fi for setup.
        </Copy>
      )}
      {Platform.OS === 'web' ? (
        <Notice>
          AI runs in the iOS / Android development build. This browser preview supports notes and
          tasks; it does not run or simulate AI.
        </Notice>
      ) : ai.status === 'downloading' ? (
        <View style={{ gap: 12 }}>
          <Copy size={13}>Downloading model · {Math.round(ai.progress * 100)}%</Copy>
          <View style={{ height: 6, backgroundColor: colors.soft, borderRadius: 4 }}>
            <View
              style={{
                width: `${ai.progress * 100}%`,
                height: 6,
                borderRadius: 4,
                backgroundColor: colors.green,
              }}
            />
          </View>
          <Button label="Cancel download" variant="ghost" onPress={engine.cancel} />
        </View>
      ) : ai.available ? (
        <View style={layout.row}>
          <Icon name="checkmark-circle" size={19} color={colors.green} />
          <Copy size={13} weight="600" style={{ color: colors.green }}>
            Ready for offline requests
          </Copy>
        </View>
      ) : (
        <Button
          label={ai.status === 'error' ? 'Retry AI setup' : 'Download / load private AI'}
          icon="download-outline"
          onPress={() => {
            void engine.prepare();
          }}
        />
      )}
      {ai.error && <Notice error>{ai.error}</Notice>}
      <Copy muted size={11}>
        Setup contacts the model host. Your notes are never sent to it. ExecuTorch download
        analytics are disabled.
      </Copy>
    </Card>
  );
}
