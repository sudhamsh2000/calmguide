'use client';

import { useTranslations } from 'next-intl';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { PROFILE_AVATARS, type ProfileAvatar as ProfileAvatarKind } from '@/lib/storage';

/**
 * Choose the portrait that stands in for the person.
 *
 * A radio group, not a dropdown: there are three options, all of them
 * visual, and the whole point is to see them side by side. The selected
 * one is marked by a ring in the sky accent — the same affordance the
 * check-in chips use — so the control reads as part of the same family.
 */

export interface AvatarPickerProps {
  name: string;
  value: ProfileAvatarKind;
  diseaseStage?: string;
  onChange: (avatar: ProfileAvatarKind) => void;
  className?: string;
}

export function AvatarPicker({
  name,
  value,
  diseaseStage,
  onChange,
  className = '',
}: AvatarPickerProps) {
  const t = useTranslations('profile');

  return (
    <fieldset className={className}>
      <legend className="text-base font-semibold text-foreground">{t('avatar.title')}</legend>
      <p className="mt-1 text-sm text-foreground-muted">{t('avatar.description')}</p>

      <div className="mt-4 flex gap-3">
        {PROFILE_AVATARS.map((option) => {
          const selected = option === value;
          return (
            <label
              key={option}
              className={[
                'flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-3 py-3 transition-colors',
                // `hover:bg-foreground/5` would compile to transparent here
                // (bare-var token + Tailwind 3.4 opacity modifier), so the
                // unselected hover uses the soft surface token instead.
                selected ? 'bg-accentSky-soft' : 'hover:bg-primary-soft',
              ].join(' ')}
            >
              <input
                type="radio"
                name="profile-avatar"
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only peer"
              />
              <ProfileAvatar
                name={name || '?'}
                avatar={option}
                diseaseStage={diseaseStage}
                size={56}
                /* Selection and keyboard focus are separate signals, so they
                 * get separate colours and both must be able to show at
                 * once — focus overrides the ring colour, never the ring. */
                className={[
                  'ring-offset-2 ring-offset-surface',
                  selected ? 'ring-2 ring-accentSky' : 'ring-0',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-foreground',
                ].join(' ')}
              />
              <span
                className={`text-xs ${selected ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}
              >
                {t(`avatar.option.${option}`)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
