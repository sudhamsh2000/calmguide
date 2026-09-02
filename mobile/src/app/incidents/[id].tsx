import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../components/ThemeContext';
import { getAccessCode } from '../../lib/storage';
import { getIncident } from '../../lib/api';
import type { IncidentResponse } from '../../lib/api';

function DetailRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | null | undefined;
  color: string;
}) {
  if (!value) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1,
          color,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 16, color }}>{value}</Text>
    </View>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('incidents');
  const { colors } = useTheme();
  const [incident, setIncident] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const code = await getAccessCode();
      if (!code || !id) return;
      try {
        const data = await getIncident(code, id);
        setIncident(data);
      } catch {
        /* silent */
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
        <Text style={{ color: colors.error, fontSize: 16 }}>{t('detail.not_found')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t(`logger.category.${incident.behavior_category}`).replace(/\n/g, ' '),
          headerBackTitle: '',
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 16 }}>
          <DetailRow
            label={t('detail.when')}
            value={formatDate(incident.incident_time)}
            color={colors.mutedForeground}
          />
          <DetailRow
            label={t('detail.what_happened')}
            value={incident.behavior_description}
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.severity')}
            value={incident.severity ? t(`logger.severity.${incident.severity}`) : null}
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.duration')}
            value={
              incident.duration_category ? t(`logger.duration.${incident.duration_category}`) : null
            }
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.what_before')}
            value={incident.antecedent_description}
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.what_tried')}
            value={incident.intervention_description}
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.outcome')}
            value={
              incident.intervention_outcome
                ? t(`logger.outcome.${incident.intervention_outcome}`)
                : null
            }
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.location')}
            value={incident.location}
            color={colors.foreground}
          />
          <DetailRow
            label={t('detail.source')}
            value={
              incident.source === 'auto_extracted'
                ? t('history.auto_extracted')
                : t('history.manual')
            }
            color={colors.foreground}
          />
        </View>
      </ScrollView>
    </>
  );
}
