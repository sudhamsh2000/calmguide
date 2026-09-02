import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { getBehavioralCard, type BehavioralCard } from '@/lib/facility-api';
import { formatResidentLocation } from '@/lib/facility-utils';

export default function ResidentDetailScreen() {
  const { id, unit, room, bed, risk } = useLocalSearchParams<{
    id: string;
    unit?: string;
    room?: string;
    bed?: string;
    risk?: string;
  }>();
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const { t: ti } = useTranslation('incidents');
  const router = useRouter();

  const [card, setCard] = useState<BehavioralCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getBehavioralCard(id);
      setCard(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_ASSIGNED') {
        setError(t('residents.not_assigned', "You're not assigned to this resident. Check with your charge nurse."));
      } else {
        setError(t('residents.card_error', 'Behavioral profile unavailable. Try again or check another resident.'));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: colors.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          {error}
        </Text>
        <Button variant="secondary" onPress={() => router.back()}>
          {t('residents.back', 'Go Back')}
        </Button>
      </View>
    );
  }

  if (!card) return null;

  const location = formatResidentLocation(unit ?? null, room ?? null, bed ?? null);

  return (
    <>
      <Stack.Screen options={{ title: location, headerBackTitle: '' }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* What NOT to Do — always first, per spec */}
        <SectionCard
          title={t('residents.what_not_to_do')}
          items={card.what_not_to_do}
          colors={colors}
          variant="danger"
        />

        <SectionCard
          title={t('residents.what_works')}
          items={card.what_works}
          colors={colors}
          variant="success"
        />

        {card.escalation_pattern && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
              {t('residents.escalation_pattern')}
            </Text>
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
              {card.escalation_pattern}
            </Text>
          </View>
        )}

        {card.recent_incidents.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 }}>
              {t('residents.recent_incidents')}
            </Text>
            {card.recent_incidents.map((inc, idx) => (
              <View
                key={idx}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                    {ti(`logger.category.${inc.category}`).replace(/\n/g, ' ')}
                  </Text>
                  {inc.severity && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: inc.severity === 'severe' ? colors.error : colors.mutedForeground,
                      }}
                    >
                      {ti(`logger.severity.${inc.severity}`)}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {formatDate(inc.date)}
                  {inc.outcome ? ` · ${ti(`history.${inc.outcome}`)}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          padding: 16,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          variant="secondary"
          size="lg"
          style={{ flex: 1 }}
          onPress={() => {
            const params = new URLSearchParams({ profile_id: id! });
            if (unit) params.set('unit', unit);
            if (room) params.set('room', room);
            if (bed) params.set('bed', bed);
            if (risk) params.set('risk', risk);
            router.push(`/coach?${params.toString()}`);
          }}
        >
          {t('residents.ask_coach')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          style={{ flex: 1 }}
          onPress={() => {
            const params = new URLSearchParams({ profile_id: id! });
            if (unit) params.set('unit', unit);
            if (room) params.set('room', room);
            if (bed) params.set('bed', bed);
            if (risk) params.set('risk', risk);
            router.push(`/incidents/new?${params.toString()}`);
          }}
        >
          {t('residents.log_incident')}
        </Button>
      </View>
    </>
  );
}

function SectionCard({
  title,
  items,
  colors,
  variant,
}: {
  title: string;
  items: Array<Record<string, unknown>>;
  colors: { surface: string; border: string; foreground: string; error: string; success: string; mutedForeground: string };
  variant: 'danger' | 'success';
}) {
  const accentColor = variant === 'danger' ? colors.error : colors.success;
  const prefix = '';
  const emptyText = variant === 'danger'
    ? 'No contraindicated interventions recorded yet.'
    : 'No effective interventions recorded yet.';

  return (
    <View
      style={{
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: accentColor + '33',
        // Was declared twice — a `colors.surface` above this line was silently
        // overridden by the accent tint, so this is what already rendered.
        // Kept as-is deliberately: removing the dead key must not change how
        // the card looks.
        backgroundColor: accentColor + '08',
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: accentColor, marginBottom: 10 }}>
        {title}
      </Text>
      {items && items.length > 0 ? (
        items.map((item, idx) => {
          const desc = (item.description ?? item.intervention ?? '') as string;
          const detail = (item.count ? `(${item.count}x)` : '') as string;
          return (
            <View key={idx} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 15, color: accentColor, lineHeight: 22 }}>•</Text>
              <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22, flex: 1 }}>
                {desc}{detail ? ` ${detail}` : ''}
              </Text>
            </View>
          );
        })
      ) : (
        <Text style={{ fontSize: 14, color: colors.mutedForeground, fontStyle: 'italic' }}>
          {emptyText}
        </Text>
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}
