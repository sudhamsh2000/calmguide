import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DiseaseStage } from '@/lib/api';
import { useTheme } from './ThemeContext';
import { useTranslation } from 'react-i18next';

interface PatientCardProps {
  patientName: string;
  diseaseStage: DiseaseStage;
  behavioralPatternsCount: number;
  onEditPress?: () => void;
}

const avatarBg: Record<DiseaseStage, string> = {
  early: '#00B89418',
  middle: '#FDCB6E22',
  late: '#7B8FA118',
};

const avatarText: Record<DiseaseStage, string> = {
  early: '#00B894',
  middle: '#C8973A',
  late: '#7B8FA1',
};

export function PatientCard({
  patientName,
  diseaseStage,
  behavioralPatternsCount,
  onEditPress,
}: PatientCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const initial = patientName.charAt(0).toUpperCase();
  const stageLabel = t(`view.${diseaseStage}_stage`, diseaseStage);
  const behaviorsLabel =
    behavioralPatternsCount > 0
      ? t('card.behaviors_tracked', {
          count: behavioralPatternsCount,
          defaultValue: `${behavioralPatternsCount} behaviors tracked`,
        })
      : null;
  const meta = [stageLabel, behaviorsLabel].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: avatarBg[diseaseStage],
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ color: avatarText[diseaseStage], fontSize: 18, fontWeight: '700' }}>
          {initial}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {patientName}
        </Text>
        <Text
          style={{ fontSize: 13, color: colors.mutedForeground, flexShrink: 1 }}
          numberOfLines={2}
        >
          {meta}
        </Text>
      </View>
      {onEditPress ? (
        <Pressable
          onPress={onEditPress}
          style={{ padding: 8, flexShrink: 0 }}
          accessibilityRole="button"
          accessibilityLabel={tc('accessibility.edit_profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            aria-hidden
            style={{ fontSize: 18, fontWeight: '700', color: colors.primary, lineHeight: 20 }}
          >
            ✎
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
