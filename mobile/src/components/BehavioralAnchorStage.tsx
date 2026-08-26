import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeContext';

export type BehavioralStage = 'early' | 'middle' | 'late' | 'unknown';

interface BehavioralAnchorStageProps {
  selectedStage: BehavioralStage | null;
  onSelect: (stage: BehavioralStage) => void;
}

const ANCHORS: { stage: BehavioralStage; key: string }[] = [
  { stage: 'early', key: 'anchor_early' },
  { stage: 'middle', key: 'anchor_middle' },
  { stage: 'late', key: 'anchor_late' },
  { stage: 'unknown', key: 'anchor_unsure' },
];

export function BehavioralAnchorStage({ selectedStage, onSelect }: BehavioralAnchorStageProps) {
  const { t } = useTranslation('profile');
  const { colors } = useTheme();

  return (
    <View style={{ gap: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground }}>
        {t('setup.behavioral_stage_heading')}
      </Text>

      <View style={{ gap: 12 }}>
        {ANCHORS.map(({ stage, key }) => {
          const isSelected = selectedStage === stage;
          return (
            <Pressable
              key={stage}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onSelect(stage);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 20,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? colors.primary : colors.border,
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.mutedForeground,
                backgroundColor: isSelected ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}>
                {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />}
              </View>
              <Text style={{ flex: 1, fontSize: 16, color: colors.foreground, lineHeight: 24 }}>
                {t(`disease_stage.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
