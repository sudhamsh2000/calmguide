import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { WelcomeGate } from '@/components/auth/WelcomeGate';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

export const metadata: Metadata = {
  title: 'Welcome | CalmGuide',
  description: 'CalmGuide — multilingual AI companion for dementia caregivers.',
};

export default async function WelcomePage() {
  const t = await getTranslations('common');

  return (
    <WelcomeGate>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 overflow-y-auto animate-page-enter">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-4xl tracking-tight text-primary" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="font-bold">Calm</span><span className="font-light">Guide</span>
          </h1>
          <p className="mt-3 text-lg text-foreground-muted leading-relaxed">
            {t('welcome.tagline')}
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/profile/setup"
              className="focus-ring inline-flex min-h-tap w-full items-center justify-center rounded-xl bg-primary px-6 py-5 text-xl font-semibold text-white shadow-lg transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              {t('welcome.get_started')}
            </Link>
            <Link
              href="/login"
              className="focus-ring inline-flex items-center justify-center py-2 text-sm font-medium text-primary hover:text-primary-light underline-offset-2 hover:underline transition-colors"
            >
              {t('welcome.have_access_code')}
            </Link>
            <Link
              href="/facility/login"
              className="focus-ring inline-flex items-center justify-center py-2 text-sm font-medium text-foreground-muted hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              {t('welcome.facility_login')}
            </Link>
          </div>

          <p className="mt-12 text-sm text-foreground-muted/70 leading-relaxed">
            {t('welcome.privacy_note')}
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm text-foreground-muted">
            <Link href="/terms" className="hover:text-foreground underline-offset-2 hover:underline transition-colors">{t('welcome.terms')}</Link>
            <span aria-hidden="true" className="text-foreground-muted/40">·</span>
            <Link href="/privacy" className="hover:text-foreground underline-offset-2 hover:underline transition-colors">{t('welcome.privacy')}</Link>
          </div>
          <div className="mt-4">
            <LocaleSwitcher />
          </div>
        </div>
      </main>
    </WelcomeGate>
  );
}
