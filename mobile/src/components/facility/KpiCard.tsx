import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../ThemeContext';

type UrgencyLevel = 'alert' | 'warning' | 'positive' | undefined;

interface KpiCardProps {
  value: string;
  label: string;
  sublabel?: string;
  urgency?: UrgencyLevel;
}

const URGENCY_LIGHT = {
  alert:    { bg: '#FEF2F2', accentColor: '#EF4444', valueColor: '#DC2626' },
  warning:  { bg: '#FFF7ED', accentColor: '#F97316', valueColor: '#EA580C' },
  positive: { bg: '#F0FDF4', accentColor: '#22C55E', valueColor: '#16A34A' },
} as const;

const URGENCY_DARK = {
  alert:    { bg: '#2A1515', accentColor: '#F87171', valueColor: '#FCA5A5' },
  warning:  { bg: '#2A1A0A', accentColor: '#FB923C', valueColor: '#FDBA74' },
  positive: { bg: '#0A2A15', accentColor: '#4ADE80', valueColor: '#86EFAC' },
} as const;

export function KpiCard({ value, label, sublabel, urgency }: KpiCardProps) {
  const { colors } = useTheme();

  const urgencyStyle = urgency
    ? (colors.isDark ? URGENCY_DARK[urgency] : URGENCY_LIGHT[urgency])
    : null;

  return (
    <View
      style={{
        backgroundColor: urgencyStyle ? urgencyStyle.bg : colors.surface,
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        ...(urgencyStyle ? { borderStartWidth: 4, borderStartColor: urgencyStyle.accentColor } : {}),
        flex: 1,
        minWidth: 80,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color: urgencyStyle ? urgencyStyle.valueColor : colors.foreground }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginTop: 2 }}>
        {label}
      </Text>
      {sublabel ? (
        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}
