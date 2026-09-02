import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeContext';
import { Button } from '@/components/Button';
import { getTrends, type TrendsData } from '@/lib/facility-api';
import { useFacilitySessionGuard } from '../../hooks/useFacilitySessionGuard';

type Period = '7d' | '30d' | '90d';

const TIME_SLOTS = ['overnight', 'morning', 'afternoon', 'evening'] as const;

export default function TrendsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('facility');
  const { recordActivity } = useFacilitySessionGuard();

  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');

  const loadTrends = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const json = await getTrends(p);
      setData(json);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends(period);
  }, [period, loadTrends]);

  const periods: Period[] = ['7d', '30d', '90d'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        onScrollBeginDrag={recordActivity}
      >
        {/* Header + Period selector */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
            {t('trends.title')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {periods.map((p) => (
              <Button
                key={p}
                variant={period === p ? 'primary' : 'ghost'}
                size="sm"
                onPress={() => setPeriod(p)}
                style={{ borderRadius: 0, minWidth: 50 }}
              >
                {t(`trends.period_${p}` as 'trends.period_7d')}
              </Button>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : data ? (
          <>
            {/* Time of Day Distribution */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
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
                {t('trends.time_distribution')}
              </Text>
              {TIME_SLOTS.map((slot) => {
                const total = Object.values(data.time_distribution).reduce((a, b) => a + b, 0) || 1;
                const count = data.time_distribution[slot] ?? 0;
                const pct = Math.round((count / total) * 100);
                const isMax = count === Math.max(...Object.values(data.time_distribution));
                return (
                  <View
                    key={slot}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}
                  >
                    <Text style={{ width: 80, fontSize: 13, color: colors.foreground }}>
                      {t(`trends.${slot}` as 'trends.overnight')}
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        height: 18,
                        backgroundColor: `${colors.foreground}0D`,
                        borderRadius: 9,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: colors.primary,
                          borderRadius: 9,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        width: 36,
                        fontSize: 12,
                        color: colors.mutedForeground,
                        textAlign: 'right',
                      }}
                    >
                      {pct}%
                    </Text>
                    {isMax && (
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                        ← {t('trends.peak')}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Intervention Effectiveness */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
                overflow: 'hidden',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.foreground,
                  padding: 16,
                  paddingBottom: 12,
                }}
              >
                {t('trends.intervention_effectiveness')}
              </Text>

              {/* Table header */}
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: `${colors.foreground}06`,
                }}
              >
                <Text
                  style={{
                    flex: 2,
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.mutedForeground,
                  }}
                >
                  {t('trends.intervention')}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.mutedForeground,
                    textAlign: 'right',
                  }}
                >
                  {t('trends.success_rate')}
                </Text>
                <Text
                  style={{
                    width: 50,
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.mutedForeground,
                    textAlign: 'right',
                  }}
                >
                  {t('trends.tried')}
                </Text>
              </View>

              {data.intervention_effectiveness.map((item, i) => {
                const isContraindicated = item.success_rate < 20;
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: isContraindicated ? '#FEF2F218' : 'transparent',
                    }}
                  >
                    <View style={{ flex: 2 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: isContraindicated ? colors.error : colors.foreground,
                        }}
                      >
                        {item.intervention}
                        {isContraindicated ? ' (avoid!)' : ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: colors.foreground,
                        textAlign: 'right',
                      }}
                    >
                      {item.success_rate}%
                    </Text>
                    <Text
                      style={{
                        width: 50,
                        fontSize: 13,
                        color: colors.mutedForeground,
                        textAlign: 'right',
                      }}
                    >
                      {item.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
