import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  SAMPLE_INTERVAL_MS,
  type PerformancePhase,
  type PerformanceSession,
} from '../../domain/performance';
import { Copy, IconButton, layout } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { chartRange, chartSegments, elapsedLabel, metrics, type MetricKey } from './chart';

export const phaseColors: Record<PerformancePhase, string> = {
  baseline: '#94A1B0',
  download: '#7995C5',
  loading: '#D6A652',
  generating: '#488E6A',
  releasing: '#A994C4',
  cooldown: '#80B8C4',
  manual: '#94A1B0',
};

export function PerformanceChart({
  session,
  metric,
}: {
  session: PerformanceSession;
  metric: MetricKey;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => setSelected(null), [session.id, metric]);
  const samples = session.samples;
  const index = selected === null ? samples.length - 1 : Math.min(selected, samples.length - 1);
  const sample = samples[index];
  const [min, max] = chartRange(samples, metric);
  const firstTime = samples[0]?.elapsedMs ?? 0;
  const span = Math.max(SAMPLE_INTERVAL_MS, (samples.at(-1)?.elapsedMs ?? 0) - firstTime);
  const x = (time: number) => 44 + ((time - firstTime) / span) * 278;
  const y = (value: number) => 151 - ((value - min) / (max - min)) * 131;
  const info = metrics[metric];
  const segments = chartSegments(samples, metric);
  const available = segments.length > 0;
  const value = sample?.[metric];
  return (
    <View style={{ gap: 12 }}>
      <View style={layout.between}>
        <View>
          <Copy size={12} muted>
            {selected === null
              ? 'LATEST SAMPLE'
              : `SAMPLE AT ${elapsedLabel(sample?.elapsedMs ?? 0)}`}
          </Copy>
          <Copy size={28} weight="600">
            {value == null
              ? 'Unavailable'
              : `${value.toFixed(metric === 'thermalLevel' ? 0 : 1)}${info.unit ? ` ${info.unit}` : ''}`}
          </Copy>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Copy size={12} muted>
            {sample?.phase ?? 'Waiting'}
          </Copy>
          {metric === 'thermalLevel' && (
            <Copy size={13}>{sample?.thermalLabel ?? 'No reading'}</Copy>
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${info.label} chart. ${available ? 'Use the previous and next sample buttons below for individual readings.' : 'This sensor is unavailable.'}`}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          const position = (event.nativeEvent.locationX / width) * 340;
          const time = firstTime + ((position - 44) / 278) * span;
          const nearest = samples.reduce(
            (best, item, i) =>
              Math.abs(item.elapsedMs - time) < Math.abs((samples[best]?.elapsedMs ?? 0) - time)
                ? i
                : best,
            0,
          );
          setSelected(nearest);
        }}
      >
        <Svg width="100%" height={195} viewBox="0 0 340 195" accessible={false}>
          {samples.slice(0, -1).map((item, i) => {
            const next = samples[i + 1];
            if (!next || next.elapsedMs - item.elapsedMs > SAMPLE_INTERVAL_MS * 2.5) return null;
            return (
              <Rect
                key={`phase-${i}`}
                x={x(item.elapsedMs)}
                y={18}
                width={Math.max(0, x(next.elapsedMs) - x(item.elapsedMs))}
                height={134}
                fill={phaseColors[item.phase]}
                opacity={0.12}
              />
            );
          })}
          {[min, (min + max) / 2, max].map((tick) => (
            <ViewGrid
              key={tick}
              tick={tick}
              y={y(tick)}
              color={colors.line}
              textColor={colors.muted}
            />
          ))}
          {segments.map((segment, i) => {
            const path = segment
              .map((item, j) => {
                const value = item[metric]!;
                const previous = segment[j - 1];
                return j === 0
                  ? `M ${x(item.elapsedMs)} ${y(value)}`
                  : metric === 'thermalLevel' && previous
                    ? `L ${x(item.elapsedMs)} ${y(previous[metric]!)} L ${x(item.elapsedMs)} ${y(value)}`
                    : `L ${x(item.elapsedMs)} ${y(value)}`;
              })
              .join(' ');
            return <Path key={i} d={path} stroke={colors.green} strokeWidth={2.5} fill="none" />;
          })}
          {segments
            .filter((segment) => segment.length === 1)
            .map((segment, i) => (
              <Circle
                key={`point-${i}`}
                cx={x(segment[0]!.elapsedMs)}
                cy={y(segment[0]![metric]!)}
                r={3}
                fill={colors.green}
              />
            ))}
          {sample && value != null && (
            <>
              <Line
                x1={x(sample.elapsedMs)}
                x2={x(sample.elapsedMs)}
                y1={18}
                y2={154}
                stroke={colors.muted}
                strokeDasharray="3,4"
              />
              <Circle
                cx={x(sample.elapsedMs)}
                cy={y(value)}
                r={4.5}
                fill={colors.green}
                stroke={colors.surface}
                strokeWidth={2}
              />
            </>
          )}
          {!available && (
            <SvgText x={180} y={90} textAnchor="middle" fill={colors.muted} fontSize={13}>
              No supported readings
            </SvgText>
          )}
          <SvgText x={44} y={179} fill={colors.muted} fontSize={11}>
            {elapsedLabel(firstTime)}
          </SvgText>
          <SvgText x={322} y={179} fill={colors.muted} fontSize={11} textAnchor="end">
            {elapsedLabel(firstTime + span)}
          </SvgText>
        </Svg>
      </Pressable>
      <View style={layout.between}>
        <IconButton
          name="chevron-back"
          label="Previous graph sample"
          onPress={() => setSelected(Math.max(0, index - 1))}
        />
        <Copy muted size={12}>
          Tap graph · {index + 1} / {samples.length}
        </Copy>
        <IconButton
          name="chevron-forward"
          label="Next graph sample"
          onPress={() => setSelected(index + 1 >= samples.length - 1 ? null : index + 1)}
        />
      </View>
      <Copy muted size={12}>
        {info.description}
      </Copy>
      <View style={layout.wrap}>
        {[...new Set(samples.map((item) => item.phase))].map((phase) => (
          <View key={phase} style={[layout.row, { gap: 5 }]}>
            <View
              style={{ height: 7, width: 7, borderRadius: 2, backgroundColor: phaseColors[phase] }}
            />
            <Copy muted size={10}>
              {phase}
            </Copy>
          </View>
        ))}
      </View>
    </View>
  );
}

function ViewGrid({
  tick,
  y,
  color,
  textColor,
}: {
  tick: number;
  y: number;
  color: string;
  textColor: string;
}) {
  return (
    <>
      <Line x1={44} y1={y} x2={322} y2={y} stroke={color} strokeDasharray="4,4" />
      <SvgText x={37} y={y + 4} textAnchor="end" fill={textColor} fontSize={10}>
        {Math.round(tick)}
      </SvgText>
    </>
  );
}
