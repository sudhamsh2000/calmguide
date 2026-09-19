'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { getProfile } from '@/lib/api';
import { setAccessCode, setPatientName } from '@/lib/storage';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';

const CODE_LENGTH = 8;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('common');
  const { dispatch } = useProfile();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const codeValid = /^[A-Z0-9]{8}$/.test(code.toUpperCase());
  const nameValid = name.trim().length > 0;
  const canSubmit = codeValid && nameValid && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const normalizedCode = code.toUpperCase();

    try {
      const profile = await getProfile(normalizedCode);

      // Save to localStorage
      setAccessCode(normalizedCode);
      setPatientName(name.trim());

      // Update profile context
      dispatch({ type: 'FETCH_SUCCESS', payload: profile });

      router.push('/home');
    } catch {
      setError(t('login.error_not_found'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pt-4 pb-24 sm:gap-5 sm:px-5 sm:pt-5 sm:pb-8">
        <div className="flex items-center gap-3">
          <BackButton href="/" label={t('login.back')} />
          <h1
            className="text-xl font-medium leading-tight text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('login.title')}
          </h1>
        </div>

        <p className="text-base text-foreground-muted leading-relaxed">{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Access Code */}
          <div className="flex flex-col gap-2">
            <label htmlFor="access-code" className="text-sm font-semibold text-foreground">
              {t('login.code_label')}
            </label>
            <input
              id="access-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => {
                const clean = e.target.value
                  .replace(/[^A-Za-z0-9]/g, '')
                  .toUpperCase()
                  .slice(0, CODE_LENGTH);
                setCode(clean);
              }}
              placeholder="ABCD1234"
              className="field-shell w-full px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-foreground placeholder:tracking-[0.2em]"
              aria-describedby="access-code-hint"
            />
            <p id="access-code-hint" className="text-sm text-foreground-muted text-center">
              {t('login.code_hint')}
            </p>
          </div>

          {/* Patient Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="patient-name" className="text-sm font-semibold text-foreground">
              {t('login.name_label')}
            </label>
            <input
              id="patient-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('login.name_placeholder')}
              autoComplete="off"
              className="field-shell w-full px-4 py-3 text-base"
            />
            <p className="text-sm text-foreground-muted">{t('login.name_hint')}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-error/10 border border-error/30 p-3" role="alert">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="-mx-4 sticky bottom-0 border-t border-foreground/10 bg-background/95 px-4 pb-3 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-1 sm:backdrop-blur-0">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              loading={loading}
              className="w-full"
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </div>
        </form>

        <p className="pb-2 text-sm text-foreground-muted text-center leading-relaxed">
          {t('login.no_code')}{' '}
          <Link href="/profile/setup" className="text-accentSky hover:underline">
            {t('login.setup_new')}
          </Link>
        </p>
      </div>
    </main>
  );
}
