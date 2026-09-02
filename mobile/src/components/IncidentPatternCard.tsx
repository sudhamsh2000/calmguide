import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';
import type { PatternResponse } from '../lib/api';

interface IncidentPatternCardProps {
  patterns: PatternResponse;
}

export function IncidentPatternCard({ patterns }: IncidentPatternCardProps) {
  const { t } = useTranslation('incidents');
  const { colors } = useTheme();
  const router = useRouter();

  const trends = patterns.frequency_trends as Record<
    string,
    { current_weekly?: number; previous_weekly?: number; direction?: string }
  >;
  const effective = patterns.effective_interventions as Array<{
    intervention?: string;
    count?: number;
  }>;

  const topTrend = Object.entries(trends).sort(
    (a, b) => (b[1].current_weekly ?? 0) - (a[1].current_weekly ?? 0),
  )[0];
  const topIntervention = effective[0];

  if (!topTrend) return null;

  const [category, data] = topTrend;

  return (
    <Pressable
      onPress={() => router.push('/incidents' as Href)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1,
          color: colors.mutedForeground,
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
      >
        {t('patterns.title')}
      </Text>

      <Text style={{ fontSize: 16, color: colors.foreground }}>
        <Text style={{ textTransform: 'capitalize' }}>{category.replace(/_/g, ' ')}</Text>
        {': '}
        <Text style={{ fontWeight: '700' }}>
          {data.current_weekly ?? 0}x {t('patterns.this_week')}
        </Text>
      </Text>

      {data.direction === 'increasing' && data.previous_weekly !== undefined && (
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}>
          {'↑ '}
          {t('patterns.up_from', { count: data.previous_weekly })}
        </Text>
      )}

      {topIntervention?.intervention && (
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}>
          {t('patterns.whats_helping')}: {topIntervention.intervention}
          {topIntervention.count ? ` (${topIntervention.count}x)` : ''}
        </Text>
      )}

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 12 }}>
        {t('patterns.see_details')}
      </Text>
    </Pressable>
  );
}
