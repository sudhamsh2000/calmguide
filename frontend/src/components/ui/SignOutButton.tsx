'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { clearAll, getAccessCode } from '@/lib/storage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * Sign out, clearing the stored access code and returning to the landing page.
 *
 * This is also the only way to *reach* the landing page once signed in:
 * WelcomeGate redirects anyone with a stored session straight to /home, so a
 * plain "back to landing page" link would bounce right back. Signing out is
 * the honest version of that action, and the confirm dialog already explains
 * that the care profile survives and the access code gets you back in.
 *
 * Always behind a confirmation. This app is used at 3am by exhausted people;
 * an accidental tap that made them hunt for an access code would be a bad
 * failure, even though nothing is permanently lost.
 *
 * `variant="icon"` is the compact header affordance; `variant="button"` is the
 * full-width labelled control in Profile.
 */
export function SignOutButton({
  variant = 'button',
  className = '',
}: {
  variant?: 'button' | 'icon';
  className?: string;
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The header (icon variant) renders on every locale page, including
  // /login before an access code is entered — with no signed-in session to
  // sign out of there, the icon read as unexplained chrome and sat right
  // next to the access-code flow, so a caregiver tapping near it landed on
  // this confirmation instead. Hide it until a session actually exists.
  // Starts false (not derived from localStorage) so server and first client
  // render match; the effect flips it right after mount, before paint.
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(!!getAccessCode());
  }, []);

  const handleSignOut = () => {
    clearAll();
    router.push('/');
  };

  if (variant === 'icon' && !signedIn) return null;

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('sign_out.title')}
          title={t('sign_out.title')}
          className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${className}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`danger-outline-button flex min-h-tap items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold focus-ring cursor-pointer ${className}`}
        >
          {t('sign_out.title')}
        </button>
      )}

      <ConfirmDialog
        open={open}
        title={t('sign_out.title')}
        message={t('sign_out.message')}
        confirmLabel={t('sign_out.confirm')}
        cancelLabel={t('sign_out.cancel')}
        variant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
