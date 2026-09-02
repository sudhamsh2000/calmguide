import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type ScenarioCategory =
  'behavioral' | 'daily_care' | 'safety' | 'communication' | 'self_care';

interface CategoryConfig {
  color: string;
  bg: string;
}

const categoryConfig: Record<ScenarioCategory, CategoryConfig> = {
  behavioral: { color: '#7C4DBA', bg: '#EDE4F7' },
  daily_care: { color: '#2B7A78', bg: '#D6F0EF' },
  safety: { color: '#B84C36', bg: '#F8E0DA' },
  communication: { color: '#3B82F6', bg: '#DBEAFE' },
  self_care: { color: '#3A7D5C', bg: '#E0F0E7' },
};

function isKnown(cat: string): cat is ScenarioCategory {
  return cat in categoryConfig;
}

export function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation('learn');

  const config = isKnown(category) ? categoryConfig[category] : { color: '#636E72', bg: '#F0F0F0' };

  const label = isKnown(category)
    ? t(`list.filter_${category}`, category.replace(/_/g, ' '))
    : category.replace(/_/g, ' ');

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        backgroundColor: config.bg,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: config.color,
          textTransform: 'capitalize',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
