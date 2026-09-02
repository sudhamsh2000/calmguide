import { useTheme } from '@/components/ThemeContext';
import { TAG_LABELS, type CarePatternData } from '@/lib/api';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

interface CarePatternCardProps {
  carePattern: CarePatternData;
}

export function CarePatternCard({ carePattern }: CarePatternCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');

  const reasonText =
    carePattern.reason.type === 'cycle' &&
    carePattern.reason.avg_interval_days != null &&
    carePattern.reason.days_since_last != null
      ? t('care_patterns.reason_cycle', {
          interval: Math.round(carePattern.reason.avg_interval_days),
          days_since: carePattern.reason.days_since_last,
        })
      : t('care_patterns.reason_trend');

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        borderStartWidth: 4,
        borderStartColor: '#F59E0B',
        backgroundColor: colors.surface,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, flex: 1 }}>
          {t('care_patterns.title')}
        </Text>
      </View>

      <Text style={{ fontSize: 13, lineHeight: 19, color: '#78350F' }}>{reasonText}</Text>

      {carePattern.top_strategies.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#92400E' }}>
            {t('care_patterns.what_helps')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {carePattern.top_strategies.map((tag) => (
              <View
                key={tag}
                style={{
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: '#FCD34D99',
                  backgroundColor: '#FEF3C7',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: '#92400E' }}>{TAG_LABELS[tag] ?? tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {carePattern.cross_patient ? (
        <Text style={{ fontSize: 12, color: '#78350F', lineHeight: 17 }}>
          {t('care_patterns.cross_patient_hint', {
            count: carePattern.cross_patient.cohort_size,
            strategy:
              TAG_LABELS[carePattern.cross_patient.top_strategy] ??
              carePattern.cross_patient.top_strategy,
          })}
        </Text>
      ) : null}
    </View>
  );
}
