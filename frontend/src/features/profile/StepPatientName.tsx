'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { AvatarPicker } from './AvatarPicker';
import type { ProfileAvatar } from '@/lib/storage';

export interface StepPatientNameProps {
  patientName: string;
  avatar: ProfileAvatar;
  onChange: (name: string) => void;
  onAvatarChange: (avatar: ProfileAvatar) => void;
  className?: string;
}

/**
 * Name and portrait, on one step rather than two.
 *
 * Both answer "who is this?", and the setup flow is already six steps —
 * a seventh for a one-tap cosmetic choice would be padding. Keeping them
 * together also makes the monogram option live: it shows the initial of
 * whatever has been typed, so the choice is between three things you can
 * actually see rather than three labels.
 */
export function StepPatientName({
  patientName,
  avatar,
  onChange,
  onAvatarChange,
  className = '',
}: StepPatientNameProps) {
  const t = useTranslations('profile');

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-ink"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('setup.heading')}
        </h2>
        <p className="mt-3 text-base text-foreground-muted leading-relaxed">
          {t('setup.subtitle')}
        </p>
      </div>

      <Input
        label={t('setup.name_label')}
        placeholder={t('setup.name_placeholder')}
        value={patientName}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />

      <AvatarPicker name={patientName} value={avatar} onChange={onAvatarChange} />

      <div className="card-shell p-4">
        <p className="text-sm text-foreground-muted leading-relaxed">{t('setup.name_privacy')}</p>
      </div>
    </div>
  );
}
