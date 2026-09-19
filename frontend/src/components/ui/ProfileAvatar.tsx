import Image from 'next/image';
import type { ProfileAvatar as ProfileAvatarKind } from '@/lib/storage';

/**
 * The one human shape on a dashboard made of rectangles.
 *
 * Circular on purpose: the illustrated portraits are drawn inside a disc, so
 * a squircle would crop their edges, and the round form separates the person
 * from the cards and tiles around them at a glance.
 *
 * The monogram is a peer of the portraits rather than a fallback — a
 * caregiver who would rather not pick a gendered figure keeps a lettered
 * mark, tinted by stage, and loses nothing.
 */

const PORTRAITS: Record<Exclude<ProfileAvatarKind, 'monogram'>, string> = {
  male: '/brand/avatar-male.png',
  female: '/brand/avatar-female.png',
};

/* Stage tints for the monogram. The stage is already written out beside the
 * avatar, so this is reinforcement, not the only carrier of that fact.
 *
 * The fills are `color-mix` rather than Tailwind's `/20` opacity modifier:
 * these tokens are bare `var()` values, and Tailwind 3.4 compiles
 * `bg-success/20` on one of those to fully transparent — which is why the
 * early-stage monogram used to render as green type on a blank disc. */
const MONOGRAM_TINTS: Record<string, { fill: string; text: string }> = {
  early: { fill: 'color-mix(in srgb, var(--color-success) 20%, transparent)', text: 'text-success' },
  middle: { fill: 'var(--color-warning-bg)', text: 'text-warning-text' },
  /* Neutral, not red. PatientCard and ProfileView had drifted apart here —
   * one used `error`, the other a soft grey — so consolidating forced a
   * choice. Tinting someone's avatar red to mark late-stage dementia frames
   * the person as an error state, and this palette keeps red for actual
   * safety (911, emergency). The stage is spelled out in words beside it. */
  late: { fill: 'var(--color-primary-soft)', text: 'text-foreground-muted' },
};

const MONOGRAM_FALLBACK = {
  fill: 'color-mix(in srgb, var(--color-foreground) 10%, transparent)',
  text: 'text-foreground',
};

export interface ProfileAvatarProps {
  /** Drives the monogram letter, and names the portrait for screen readers. */
  name: string;
  avatar?: ProfileAvatarKind;
  diseaseStage?: string;
  /** Rendered size in px. Also what Next/Image is asked to serve. */
  size?: number;
  className?: string;
}

export function ProfileAvatar({
  name,
  avatar = 'monogram',
  diseaseStage,
  size = 44,
  className = '',
}: ProfileAvatarProps) {
  const box = `flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`;
  const style = { width: size, height: size };

  if (avatar !== 'monogram') {
    return (
      <div className={`${box} bg-accentSky-soft`} style={style}>
        <Image
          src={PORTRAITS[avatar]}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          /* Above the fold on the dashboard, and small — worth the priority
           * hint so the card doesn't pop in after everything else. */
          priority
        />
      </div>
    );
  }

  const tint = MONOGRAM_TINTS[diseaseStage ?? ''] ?? MONOGRAM_FALLBACK;
  return (
    <div
      className={`${box} ${tint.text} font-bold`}
      style={{ ...style, fontSize: Math.round(size * 0.41), background: tint.fill }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
