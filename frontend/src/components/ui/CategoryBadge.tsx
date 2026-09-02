'use client';

import { useTranslations } from 'next-intl';

export type ScenarioCategory =
  'behavioral' | 'daily_care' | 'safety' | 'communication' | 'self_care';

export interface CategoryBadgeProps {
  category: string;
  className?: string;
}

const categoryColors: Record<ScenarioCategory, { color: string; bg: string }> = {
  behavioral: { color: '#7C4DBA', bg: '#EDE4F7' },
  daily_care: { color: '#2B7A78', bg: '#D6F0EF' },
  safety: { color: '#B84C36', bg: '#F8E0DA' },
  communication: { color: '#3B82F6', bg: '#DBEAFE' },
  self_care: { color: '#3A7D5C', bg: '#E0F0E7' },
};

function isKnownCategory(cat: string): cat is ScenarioCategory {
  return cat in categoryColors;
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  const t = useTranslations('learn');
  const colors = isKnownCategory(category)
    ? categoryColors[category]
    : { color: '#636E72', bg: '#F0F0F0' };
  const label = isKnownCategory(category)
    ? t(`list.filter_${category}`)
    : category.replace(/_/g, ' ');

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ color: colors.color, backgroundColor: colors.bg }}
      data-category={category}
    >
      {label}
    </span>
  );
}
