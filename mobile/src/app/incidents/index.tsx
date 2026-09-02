import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../components/ThemeContext';
import { getAccessCode } from '../../lib/storage';
import { getIncidents } from '../../lib/api';
import type { BehaviorCategory, IncidentResponse, SeverityLevel } from '../../lib/api';

const CATEGORY_ICONS: Record<BehaviorCategory, string> = {
  aggression_anger: '\u{1F620}',
  confusion_disorientation: '\u{1F635}',
  wandering_exit_seeking: '\u{1F6B6}',
  refusing_care: '\u{1F6AB}',
  sleep_problems: '\u{1F634}',
  hallucinations: '\u{1F441}️',
  repetitive_behavior: '\u{1F504}',
  other: '\u{2753}',
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function IncidentHistoryScreen() {
  const { t } = useTranslation('incidents');
  const { colors } = useTheme();
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const code = await getAccessCode();
      if (!code) return;
      try {
        const result = await getIncidents(code, { limit: 50 });
        setIncidents(result.incidents);
      } catch {
        /* silent */
      }
      setLoading(false);
    })();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: IncidentResponse }) => (
      <Pressable
        onPress={() => router.push(`/incidents/${item.id}` as Href)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <Text style={{ fontSize: 20, marginTop: 2 }}>
          {CATEGORY_ICONS[item.behavior_category] ?? '\u{2753}'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            {formatDate(item.incident_time)}
          </Text>
          <Text style={{ fontSize: 16, color: colors.foreground, marginTop: 4 }} numberOfLines={2}>
            {item.behavior_description}
          </Text>
          {item.intervention_outcome && (
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}>
              {t(`history.${item.intervention_outcome}`)}
            </Text>
          )}
        </View>
      </Pressable>
    ),
    [colors, router, t],
  );

  return (
    <>
      <Stack.Screen options={{ title: t('history.title'), headerBackTitle: '' }} />
      <FlatList
        data={incidents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        style={{ flex: 1, backgroundColor: colors.background }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontSize: 18, color: colors.mutedForeground }}>
                {t('history.no_incidents')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 4 }}>
                {t('history.no_incidents_subtitle')}
              </Text>
            </View>
          ) : null
        }
      />
    </>
  );
}
