import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import { formatResidentLocation } from '../../lib/facility-utils';

type RiskLevel = 'high' | 'moderate' | 'low';

interface ResidentContextBannerProps {
  unit: string | null;
  room: string | null;
  bed: string | null;
  riskLevel: RiskLevel;
}

const RISK_LIGHT: Record<
  RiskLevel,
  { bg: string; border: string; badgeBg: string; badgeText: string }
> = {
  high: { bg: '#FFFBFB', border: '#EF4444', badgeBg: '#FDECEA', badgeText: '#B84C36' },
  moderate: { bg: '#FFFDF8', border: '#F97316', badgeBg: '#FFF7ED', badgeText: '#C2410C' },
  low: { bg: '#FBFFFC', border: '#22C55E', badgeBg: '#E8F5E9', badgeText: '#2E7D32' },
};

const RISK_DARK: Record<
  RiskLevel,
  { bg: string; border: string; badgeBg: string; badgeText: string }
> = {
  high: { bg: '#2A1515', border: '#F87171', badgeBg: '#3D1A18', badgeText: '#F0937F' },
  moderate: { bg: '#2A1A0A', border: '#FB923C', badgeBg: '#431407', badgeText: '#FB923C' },
  low: { bg: '#0A2A15', border: '#4ADE80', badgeBg: '#0F2D14', badgeText: '#86EFAC' },
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export function ResidentContextBanner({ unit, room, bed, riskLevel }: ResidentContextBannerProps) {
  const { colors } = useTheme();
  const palette = colors.isDark ? RISK_DARK : RISK_LIGHT;
  const risk = palette[riskLevel] ?? palette.low;
  const location = formatResidentLocation(unit, room, bed, true);

  return (
    <View
      style={{
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: risk.bg,
        borderBottomWidth: 2,
        borderBottomColor: risk.border,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Documenting for ${formatResidentLocation(unit, room, bed)}, ${RISK_LABELS[riskLevel]} risk`}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>{location}</Text>
      <View
        style={{
          backgroundColor: risk.badgeBg,
          paddingHorizontal: 10,
          paddingVertical: 2,
          borderRadius: 6,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: risk.badgeText }}>
          {RISK_LABELS[riskLevel]}
        </Text>
      </View>
    </View>
  );
}
