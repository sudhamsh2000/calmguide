import { useTheme } from '@/components/ThemeContext';
import type { InsightsPayload } from '@/lib/api';
import { TAG_LABELS } from '@/lib/api';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const TREND_CONFIG: Record<string, { icon: string; labelKey: string; color: string }> = {
  increasing: { icon: '\u2191', labelKey: 'patterns.trend_rising', color: '#D97706' },
  decreasing: { icon: '\u2193', labelKey: 'patterns.trend_falling', color: '#059669' },
  stable: { icon: '\u2192', labelKey: 'patterns.trend_steady', color: '#6B7280' },
};

export function PatternInsights({ insights }: { insights: InsightsPayload }) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');
  const trend = TREND_CONFIG[insights.crisis_frequency.trend] ?? TREND_CONFIG.stable;

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
        {t('patterns.title')}
      </Text>

      {/* Drift alert */}
      {insights.drift_alert ? (
        <View
          style={{
            borderRadius: 12,
            backgroundColor: '#FEF3C7',
            borderWidth: 1,
            borderColor: '#FCD34D66',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 18, color: '#92400E' }}>
            {t('patterns.drift_alert', {
              last_count: insights.drift_alert.last_count,
              this_count: insights.drift_alert.this_count,
            })}
          </Text>
        </View>
      ) : null}

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            {t('patterns.this_week')}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>
            {insights.crisis_frequency.this_week}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: trend.color, marginTop: 1 }}>
            {trend.icon} {t(trend.labelKey)}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            {t('patterns.last_week')}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>
            {insights.crisis_frequency.last_week}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            {t('patterns.peak_time')}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginTop: 4 }}>
            {t(`patterns.peak_${insights.peak_time}`)}
          </Text>
        </View>
      </View>

      {/* Top triggers */}
      {insights.top_triggers.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            {t('patterns.recurring_themes')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {insights.top_triggers.map((trigger) => (
              <View
                key={trigger}
                style={{
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{trigger}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Episode cycle */}
      {insights.episode_cycle?.detected && insights.episode_cycle.avg_interval_days != null ? (
        <View
          style={{
            borderRadius: 12,
            backgroundColor: '#F0FDF4',
            borderWidth: 1,
            borderColor: '#86EFAC66',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#166534', marginBottom: 2 }}>
            {t('patterns.cycle_detected')}
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: '#166534' }}>
            {t('patterns.cycle_interval', {
              days: Math.round(insights.episode_cycle.avg_interval_days),
            })}
          </Text>
        </View>
      ) : null}

      {/* Cross-patient boost */}
      {insights.cross_patient_boost && insights.cross_patient_boost.strategies.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            {t('patterns.cross_patient_title')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {insights.cross_patient_boost.strategies.map((s) => (
              <View
                key={s.tag}
                style={{
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: '#93C5FD66',
                  backgroundColor: '#EFF6FF',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: '#1E40AF' }}>{TAG_LABELS[s.tag] ?? s.tag}</Text>
                <Text style={{ fontSize: 11, color: '#3B82F6' }}>{s.helped}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
