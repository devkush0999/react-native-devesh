import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { actions, persistCurrent, useAppDispatch, useAppSelector } from '../../store/store';
import {
  Button,
  Card,
  Copy,
  Icon,
  Input,
  Notice,
  Pill,
  Section,
  layout,
} from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { AISetupCard } from '../ai/AISetupCard';

export function SettingsScreen() {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.data);
  const storageError = useAppSelector((state) => state.storageError);
  const saving = useAppSelector((state) => state.saving);
  const { colors } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  return (
    <ScrollView contentContainerStyle={layout.page} keyboardShouldPersistTaps="handled">
      <View>
        <Copy serif size={34} accessibilityRole="header">
          Make yourself at home.
        </Copy>
        <Copy muted size={14}>
          Your AI, your preferences, your data.
        </Copy>
      </View>
      <Section title="Your on-device AI" />
      <AISetupCard />
      <Section title="A space that feels like you" />
      <Card>
        <Copy weight="600">Appearance</Copy>
        <View style={layout.wrap}>
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <Pill
              key={theme}
              label={theme.charAt(0).toUpperCase() + theme.slice(1)}
              active={data.preferences.theme === theme}
              onPress={() => dispatch(actions.setPreferences({ theme }))}
            />
          ))}
        </View>
        <Copy weight="600" style={{ marginTop: 8 }}>
          AI response language
        </Copy>
        <View style={layout.wrap}>
          {(['English', 'Hinglish'] as const).map((language) => (
            <Pill
              key={language}
              label={language}
              active={data.preferences.language === language}
              onPress={() => dispatch(actions.setPreferences({ language }))}
            />
          ))}
        </View>
        <Copy muted size={12}>
          Hinglish uses Hindi in Latin script. Quality varies with the model; the app interface
          stays in English.
        </Copy>
      </Card>
      <Section title="Private by design" />
      <Card>
        <View style={layout.row}>
          <Icon name="shield-checkmark-outline" color={colors.green} />
          <Copy weight="600">Your personal vault</Copy>
        </View>
        <Copy muted size={14}>
          {Platform.OS === 'web'
            ? 'This preview saves notes and tasks in browser local storage without encryption. Use the native app for an encrypted vault.'
            : 'Notes and tasks are stored in a SQLCipher encrypted database. Its key stays in the device Keychain / Keystore. There is no account, cloud sync, or note upload.'}
        </Copy>
        <Copy muted size={12}>
          Deleting the app can remove your data. There is no recovery or cross-device sync in this
          version. Device backups are controlled by the operating system.
        </Copy>
        <View style={[layout.between, { paddingTop: 10 }]}>
          <Copy size={13}>
            {data.notes.length} thoughts · {data.tasks.length} tasks
          </Copy>
          <Copy size={12} muted>
            {saving ? 'Saving…' : storageError ? 'Save failed' : 'Saved locally'}
          </Copy>
        </View>
      </Card>
      {storageError && <Notice error>{storageError}</Notice>}
      {storageError && (
        <Button
          label="Retry saving"
          variant="soft"
          onPress={() => {
            void persistCurrent();
          }}
        />
      )}
      {deleting ? (
        <Card>
          <Copy weight="600">Delete all your notes and tasks?</Copy>
          <Copy muted size={13}>
            This clears your personal vault on this device. Model files and appearance preferences
            stay. Type DELETE to continue.
          </Copy>
          <Input
            accessibilityLabel="Type DELETE to erase personal data"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            placeholder="DELETE"
          />
          <Button
            label="Delete my notes and tasks"
            variant="danger"
            disabled={confirmation !== 'DELETE'}
            onPress={() => {
              dispatch(actions.clearVault());
              setDeleting(false);
              setConfirmation('');
            }}
          />
          <Button
            label="Keep my data"
            variant="soft"
            onPress={() => {
              setDeleting(false);
              setConfirmation('');
            }}
          />
        </Card>
      ) : (
        <Button
          label="Erase personal data"
          variant="danger"
          icon="trash-outline"
          onPress={() => setDeleting(true)}
        />
      )}
      <View style={{ alignItems: 'center', gap: 5, paddingVertical: 18 }}>
        <Icon name="leaf-outline" size={23} color={colors.green} />
        <Copy serif size={25}>
          saathi
        </Copy>
        <Copy muted size={11}>
          A little less on your mind. · v1.0.0
        </Copy>
      </View>
    </ScrollView>
  );
}
