import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import type { ResidentCard as ResidentCardData } from '../../lib/facility-api';
import { formatResidentLocation } from '../../lib/facility-utils';

interface ResidentCardProps {
  resident: ResidentCardData;
  patientName?: string;
  onPress: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  aggression_anger: 'Aggression',
  confusion_disorientation: 'Confusion',
  wandering_exit_seeking: 'Wandering',
  refusing_care: 'Refusing care',
  sleep_problems: 'Sleep issues',
  hallucinations: 'Hallucinations',
  repetitive_behavior: 'Repetitive behavior',
  other: 'Other',
};

function formatSummary(raw: string): string {
  const match = raw.match(/^(\w+)\s*\((\w+)\)$/);
  if (match) {
    const cat = CATEGORY_LABELS[match[1]] ?? match[1].replace(/_/g, ' ');
    const outcome = match[2].replace(/_/g, ' ');
    return `${cat} (${outcome})`;
  }
  return raw.replace(/_/g, ' ');
}

const RISK_DOT: Record<string, string> = {
  high: '#EF4444',
  moderate: '#F97316',
  low: '#22C55E',
};

export function ResidentCard({ resident, patientName, onPress }: ResidentCardProps) {
  const { colors } = useTheme();
  const dotColor = RISK_DOT[resident.risk_level] ?? RISK_DOT.low;
  const riskLabel = resident.risk_level.charAt(0).toUpperCase() + resident.risk_level.slice(1);

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${patientName ?? 'Resident'}, ${formatResidentLocation(resident.unit, resident.room, resident.bed)}, Risk ${resident.risk_level}`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Header: location + risk badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, flex: 1 }}
          numberOfLines={1}
        >
          {formatResidentLocation(resident.unit, resident.room, resident.bed)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground }}>
            {riskLabel}
          </Text>
        </View>
      </View>

      {/* Key info — plain text, no colored cards */}
      {resident.top_effective && (
        <Text style={{ fontSize: 13, color: colors.foreground, marginBottom: 6, lineHeight: 18 }} numberOfLines={2}>
          {resident.top_effective}
        </Text>
      )}

      {resident.last_incident_summary && (
        <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
          Last: {formatSummary(resident.last_incident_summary)}
        </Text>
      )}
    </Pressable>
  );
}
