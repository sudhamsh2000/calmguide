'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export interface PatientCardProps {
  patientName: string;
  diseaseStage: string;
  behaviorCount?: number;
  className?: string;
}

const avatarColors: Record<string, string> = {
  early: 'bg-success/20 text-success',
  middle: 'bg-[#F5E0D4] text-[#C4724E]',
  late: 'bg-error/15 text-error',
};

export function PatientCard({
  patientName,
  diseaseStage,
  behaviorCount = 0,
  className = '',
}: PatientCardProps) {
  const t = useTranslations('profile');
  const stageLabel = t.has(`view.${diseaseStage}_stage`)
    ? t(`view.${diseaseStage}_stage`)
    : diseaseStage;
  const avatarStyle = avatarColors[diseaseStage] ?? 'bg-foreground/10 text-foreground';
  const initial = patientName.charAt(0).toUpperCase();

  const meta = [
    stageLabel,
    behaviorCount > 0 ? t('card.behaviors_tracked', { count: behaviorCount }) : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-foreground/10 bg-surface px-4 py-3.5 sm:items-center ${className}`}
    >
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold ${avatarStyle}`}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground truncate">
          {t('card.title', { name: patientName })}
        </p>
        <p className="text-[13px] text-foreground-muted mt-0.5">{meta}</p>
      </div>
      <Link
        href="/profile"
        className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-primary hover:underline focus-ring rounded px-1"
      >
        {t('actions.edit')}
      </Link>
    </div>
  );
}
