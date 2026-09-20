'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import type { ProfileAvatar as ProfileAvatarKind } from '@/lib/storage';

export interface PatientCardProps {
  patientName: string;
  diseaseStage: string;
  behaviorCount?: number;
  avatar?: ProfileAvatarKind;
  className?: string;
}

export function PatientCard({
  patientName,
  diseaseStage,
  behaviorCount = 0,
  avatar = 'monogram',
  className = '',
}: PatientCardProps) {
  const t = useTranslations('profile');
  const stageLabel = t.has(`view.${diseaseStage}_stage`)
    ? t(`view.${diseaseStage}_stage`)
    : diseaseStage;

  const meta = [
    stageLabel,
    behaviorCount > 0 ? t('card.behaviors_tracked', { count: behaviorCount }) : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  return (
    <div
      className={`glass-panel flex items-start gap-3 px-5 py-4 sm:items-center ${className}`}
    >
      <ProfileAvatar
        name={patientName}
        avatar={avatar}
        diseaseStage={diseaseStage}
        size={44}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground truncate">
          {t('card.title', { name: patientName })}
        </p>
        <p className="text-[13px] text-foreground-muted mt-0.5">{meta}</p>
      </div>
      <Link
        href="/profile"
        className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-accentSky hover:underline focus-ring rounded px-1"
      >
        {t('actions.edit')}
      </Link>
    </div>
  );
}
