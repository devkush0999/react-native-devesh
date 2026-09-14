import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { serif, useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.ink} accessible={false} />;
}
export function Copy({
  children,
  size = 15,
  muted,
  weight,
  style,
  serif: elegant,
  ...rest
}: PropsWithChildren<{
  size?: number;
  muted?: boolean;
  weight?: TextStyle['fontWeight'];
  style?: StyleProp<TextStyle>;
  serif?: boolean;
  numberOfLines?: number;
  selectable?: boolean;
  accessibilityRole?: 'header';
}>) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        {
          color: muted ? colors.muted : colors.ink,
          fontSize: size,
          lineHeight: size * 1.45,
          fontWeight: weight,
          fontFamily: elegant ? serif : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  const backgroundColor =
    variant === 'primary' ? colors.green : variant === 'soft' ? colors.soft : 'transparent';
  const color =
    variant === 'primary'
      ? isDark
        ? '#203628'
        : '#FFFFFF'
      : variant === 'danger'
        ? colors.danger
        : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.4 : pressed ? 0.72 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : icon ? (
        <Icon name={icon} size={18} color={color} />
      ) : null}
      <Copy weight="600" style={{ color }}>
        {label}
      </Copy>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
    >
      {children}
    </View>
  );
}
export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.soft : 'transparent',
          borderColor: active ? colors.green : colors.line,
        },
      ]}
    >
      <Copy
        size={13}
        weight={active ? '600' : '400'}
        style={{ color: active ? colors.green : colors.muted }}
      >
        {label}
      </Copy>
    </Pressable>
  );
}
export function Input({ style, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        styles.input,
        { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line },
        style,
      ]}
    />
  );
}
export function Empty({
  icon,
  title,
  body,
  children,
}: PropsWithChildren<{ icon: IconName; title: string; body: string }>) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.soft }]}>
        <Icon name={icon} size={28} color={colors.green} />
      </View>
      <Copy serif size={23} style={{ textAlign: 'center' }}>
        {title}
      </Copy>
      <Copy muted size={14} style={{ textAlign: 'center', maxWidth: 300 }}>
        {body}
      </Copy>
      {children}
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.section}>
      <Copy size={20} serif accessibilityRole="header">
        {title}
      </Copy>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Copy size={13} weight="600">
            {action} →
          </Copy>
        </Pressable>
      ) : null}
    </View>
  );
}
export function Notice({ children, error }: PropsWithChildren<{ error?: boolean }>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: error ? colors.peach : colors.soft }]}
    >
      <Icon
        name={error ? 'alert-circle-outline' : 'information-circle-outline'}
        size={18}
        color={error ? colors.danger : colors.green}
      />
      <Copy size={13} style={{ flex: 1, color: error ? colors.danger : colors.muted }}>
        {children}
      </Copy>
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheetHeader, { borderColor: colors.line }]}>
            <Copy serif size={26}>
              {title}
            </Copy>
            <IconButton name="close" label="Close dialog" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              gap: 18,
              width: '100%',
              maxWidth: 680,
              alignSelf: 'center',
              paddingBottom: 48,
            }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export const layout = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 28, gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  card: { padding: 18, borderWidth: 1, borderRadius: 22, gap: 12 },
  pill: {
    paddingHorizontal: 16,
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 12 },
  emptyIcon: {
    height: 62,
    width: 62,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  notice: { padding: 14, borderRadius: 14, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
