import { useState } from 'react';
import { Platform, ScrollView, Share, Switch, View } from 'react-native';
import { MAX_PERFORMANCE_SESSIONS, SAMPLE_INTERVAL_MS, sessionSummary, thermalDescription, type PerformanceSession } from '../../domain/performance';
import { actions, useAppDispatch, useAppSelector } from '../../store/store';
import { Button, Card, Copy, Empty, Icon, Notice, Pill, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { elapsedLabel, metrics, type MetricKey } from './chart';
import { PerformanceChart } from './PerformanceChart';
import { performanceMonitor, usePerformanceMonitor } from './monitor';

const kindLabels = { setup: 'Model setup', inference: 'AI request', manual: 'Manual recording' };
function title(session: PerformanceSession) { return `${kindLabels[session.kind]} · ${new Date(session.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`; }
function reading(value: number | null | undefined, unit: string) { return value == null ? 'Unavailable' : `${value.toFixed(1)} ${unit}`; }

export function PerformancePanel() {
  const monitor = usePerformanceMonitor();
  const history = useAppSelector((state) => state.data.performanceSessions);
  const protection = useAppSelector((state) => state.data.preferences.thermalProtection);
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const [selection, setSelection] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('appCpuPercent');
  const [confirmClear, setConfirmClear] = useState(false);
  const [shareError, setShareError] = useState('');
  const session = selection ? history.find((item) => item.id === selection) ?? monitor.active ?? history[0] : monitor.active ?? history[0];
  const summary = session ? sessionSummary(session) : null;
  const latest = session?.samples.at(-1);
  const live = session?.id === monitor.active?.id && monitor.recording;

  async function share() {
    if (!session) return;
    try {
      await Share.share({ title: 'Saathi device health session', message: JSON.stringify({ app: 'Saathi', formatVersion: 1, sampleIntervalMs: SAMPLE_INTERVAL_MS, cpuConvention: 'One core = 100%; app process only', note: 'Observed metrics are not proof of safety or causation. Android battery temperature is not CPU temperature. No prompts or note content included.', session }, null, 2) });
    } catch { setShareError('The report could not be shared. Your saved session is still available here.'); }
  }

  return <View style={{ gap: 16 }}>
    <Card>
      <View style={layout.row}><View style={{ backgroundColor: colors.soft, padding: 12, borderRadius: 16 }}><Icon name="pulse-outline" color={colors.green} size={24} /></View><View style={{ flex: 1 }}><Copy weight="600">See what AI asks of your phone.</Copy><Copy muted size={12}>{monitor.recording ? `Recording · ${monitor.phase} · every 3 seconds` : 'Automatic during model setup and AI requests'}</Copy></View>{monitor.recording && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />}</View>
      <Copy muted size={13}>App CPU and RAM, OS thermal state, battery and JS timer delay. A short cooldown is recorded after AI finishes. Sessions stay on this device.</Copy>
      {!monitor.supported && <Notice>{Platform.OS === 'web' ? 'Phone sensors are unavailable in the browser. Install the iOS or Android development build to record real readings.' : 'This installed build does not include Device Health. Rebuild the native app; a Metro refresh alone cannot add the module.'}</Notice>}
      <View style={layout.between}><View style={{ flex: 1, gap: 4 }}><Copy weight="600" size={14}>Stop AI on high thermal pressure</Copy><Copy muted size={12}>Uses the OS warning, not an arbitrary temperature.</Copy></View><Switch accessibilityLabel="Stop AI when the OS reports high thermal pressure" value={protection} onValueChange={(thermalProtection) => { dispatch(actions.setPreferences({ thermalProtection })); }} disabled={!monitor.supported} trackColor={{ true: colors.green }} /></View>
      <Copy muted size={11}>iOS serious/critical or Android severe and above triggers a stop request. This helps reduce load; it cannot guarantee device safety or instant cancellation.</Copy>
      {monitor.recording ? <Button label="Stop recording and save" variant="soft" icon="stop-circle-outline" onPress={performanceMonitor.stopAndSave} /> : <Button label="Record a baseline / test session" icon="pulse-outline" disabled={!monitor.supported} onPress={() => { setSelection(null); void performanceMonitor.startManual(); }} />}
      <Copy muted size={11}>{monitor.recording ? 'Stopping also cancels an active AI request. Samples are finalized when recording stops.' : 'For a useful comparison, record 15 seconds idle, run an AI request, wait briefly, then stop. This does not launch a stress test.'}</Copy>
    </Card>
    {!!monitor.error && <Notice error>{monitor.error}</Notice>}
    {!!monitor.thermalNotice && <Notice error>{monitor.thermalNotice}</Notice>}
    {session ? <>
      <View style={layout.between}><View style={{ flex: 1 }}><Copy serif size={23}>{live ? 'Live device readings' : title(session)}</Copy><Copy size={12} muted>{elapsedLabel(session.durationMs)} · {session.platform.toUpperCase()} · {live ? monitor.phase : session.outcome}</Copy></View>{monitor.active && <Button label="Live" variant="soft" onPress={() => setSelection(null)} />}</View>
      {!session.isPhysicalDevice && <Notice>Simulator / emulator session. CPU and RAM describe the simulated app process. Battery and thermal sensors are unavailable; these readings cannot predict phone heating.</Notice>}
      <View style={[layout.wrap, { gap: 10 }]}>{[
        { label: 'Peak app CPU', value: reading(summary?.peakCpu, '%') },
        { label: 'Peak app RAM', value: reading(summary?.peakMemory, 'MB') },
        { label: 'Peak battery heat', value: reading(summary?.peakTemperature, '°C') },
        { label: 'Battery change', value: summary?.batteryChange == null ? 'Not comparable' : `${summary.batteryChange > 0 ? '+' : ''}${summary.batteryChange.toFixed(1)} pp` },
      ].map((item) => <Card key={item.label} style={{ width: '48%', flexGrow: 1, padding: 14 }}><Copy muted size={11}>{item.label}</Copy><Copy weight="600" size={17}>{item.value}</Copy></Card>)}</View>
      <Card>
        <View style={layout.row}><Icon name="thermometer-outline" color={summary?.worstThermal != null && summary.worstThermal >= 3 ? colors.danger : colors.green} /><Copy size={14} weight="600" style={{ flex: 1 }}>{thermalDescription(summary?.worstThermal ?? null)}</Copy></View>
        <Copy muted size={12}>A lack of warnings is not proof of no impact. Battery change includes the whole device and is hidden if charging is reported or unknown. Compare equal-duration sessions on the same phone.</Copy>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{(Object.keys(metrics) as MetricKey[]).map((key) => <Pill key={key} label={metrics[key].label} active={metric === key} onPress={() => setMetric(key)} />)}</ScrollView>
        <PerformanceChart session={session} metric={metric} />
        <Copy muted size={11}>{session.sampleCount} samples collected · {session.samples.length} retained{session.sampleCount > session.samples.length ? '. Showing the first and latest samples; gaps are not interpolated. Peaks refer to retained samples.' : ''}</Copy>
      </Card>
      <Card><Copy weight="600" size={14}>Reading context</Copy><Copy muted size={12}>Device RAM: {reading(latest?.deviceTotalMemoryMb, 'MB')} · App memory measure: {session.memoryMetric}{'\n'}Battery: {latest?.charging === true ? 'Charging / powered' : latest?.charging === false ? 'On battery' : 'Unknown'} · Power-saving mode: {latest?.lowPowerMode === null ? 'Unknown' : latest?.lowPowerMode ? 'On' : 'Off'}{'\n'}Sampling also has a small cost. Other apps, ambient heat and screen usage affect these readings.</Copy></Card>
      {!live && <Button label="Share this session as JSON" icon="share-outline" variant="soft" onPress={() => { void share(); }} />}
      {!!shareError && <Notice error>{shareError}</Notice>}
    </> : <Empty icon="analytics-outline" title="Your first graph starts with a run" body="Set up the model or use an AI feature. You can also record an idle baseline first. Unsupported sensors will stay empty." />}
    {history.length > 0 && <View style={{ gap: 10 }}><Copy serif size={22}>Recent sessions</Copy><Copy muted size={12}>Last {MAX_PERFORMANCE_SESSIONS} recordings. No prompts, notes, device identifiers or external upload.</Copy>{history.map((item) => <Button key={item.id} label={`${title(item)} · ${elapsedLabel(item.durationMs)}`} variant={session?.id === item.id ? 'soft' : 'ghost'} icon={item.outcome === 'thermal-stop' ? 'thermometer-outline' : 'analytics-outline'} onPress={() => setSelection(item.id)} />)}<Button label={confirmClear ? 'Confirm clear saved recordings' : 'Clear saved recordings'} variant="danger" disabled={monitor.recording} onPress={() => { if (!confirmClear) setConfirmClear(true); else { dispatch(actions.clearPerformanceSessions()); setSelection(null); setConfirmClear(false); } }} /></View>}
  </View>;
}

export function PerformanceShortcut({ onPress }: { onPress: () => void }) {
  const monitor = usePerformanceMonitor();
  return <Button label={monitor.recording ? 'Recording' : 'Health'} icon="pulse-outline" variant="ghost" onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 8 }} />;
}

export function ThermalNotice() {
  const { thermalNotice } = usePerformanceMonitor();
  if (!thermalNotice) return null;
  return <View style={{ paddingHorizontal: 24 }}><Notice error>{thermalNotice}</Notice><Button label="Dismiss thermal notice" variant="ghost" onPress={performanceMonitor.dismissNotice} /></View>;
}
