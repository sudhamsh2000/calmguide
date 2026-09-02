import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { KpiCard } from '@/components/facility/KpiCard';
import { getExecutiveOverview, type ExecutiveOverview } from '@/lib/facility-api';
import { useFacilitySessionGuard } from '../../hooks/useFacilitySessionGuard';

export default function ExecutiveScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const { recordActivity } = useFacilitySessionGuard();

  const [data, setData] = useState<ExecutiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const json = await getExecutiveOverview();
      setData(json);
      setError(null);
    } catch {
      setError(t('executive.unavailable', 'Executive overview unavailable right now.'));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onScrollBeginDrag={recordActivity}
      >
        <Text
          style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}
        >
          {t('executive.title')}
        </Text>

        {error && (
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 16,
              borderRadius: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.error,
            }}
          >
            <Text style={{ color: colors.error, fontSize: 14, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {data && (
          <>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 20 }}>
              {t('executive.since_implementing', { days: data.days_active })}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <KpiCard
                value={`${data.incident_rate.change_pct > 0 ? '+' : ''}${data.incident_rate.change_pct}%`}
                label={t('executive.incident_reduction')}
                urgency={
                  data.incident_rate.change_pct < 0
                    ? 'positive'
                    : data.incident_rate.change_pct > 0
                      ? 'alert'
                      : undefined
                }
              />
              <KpiCard
                value={`${data.adoption_rate.staff_pct}%`}
                label={t('executive.staff_adoption')}
                urgency={
                  data.adoption_rate.staff_pct >= 80
                    ? 'positive'
                    : data.adoption_rate.staff_pct < 50
                      ? 'warning'
                      : undefined
                }
              />
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.foreground,
                  marginBottom: 12,
                }}
              >
                {t('executive.monthly_impact')}
              </Text>
              {[
                {
                  label: t('executive.survey_readiness'),
                  value: '✓',
                },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 14, color: colors.foreground }}>{row.label}</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: row.value === '—' ? colors.mutedForeground : '#16A34A',
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
