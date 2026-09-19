'use client';

import { useLocale, useTranslations } from 'next-intl';

/**
 * Emergency numbers per shipped locale, keyed by bare language code.
 *
 * Always read through localeNumbers(). useLocale() returns a full routing tag
 * ("es-ES", "hi-IN" — see i18n/routing.ts), so indexing this map with it
 * directly missed on every non-English locale and fell through to the English
 * entry: Spanish and Hindi caregivers were shown US 911 and the US helpline
 * instead of their own. Normalising to the base code is what prevents that.
 */
const EMERGENCY_NUMBERS: Record<
  string,
  { emergency: string; helpline: string; helplineName: string }
> = {
  en: {
    emergency: '911',
    helpline: '1-800-272-3900',
    helplineName: "Alzheimer's Association 24/7 Helpline",
  },
  es: {
    emergency: '911',
    helpline: '1-800-272-3900',
    helplineName: 'Línea de Ayuda de Alzheimer 24/7',
  },
  hi: { emergency: '112', helpline: '1800-11-0031', helplineName: 'ARDSI हेल्पलाइन' },
};

/** Resolve numbers for a full locale tag, falling back to English. */
export function localeNumbers(locale: string | undefined) {
  const base = (locale ?? 'en').toLowerCase().split('-')[0];
  return EMERGENCY_NUMBERS[base] ?? EMERGENCY_NUMBERS.en;
}

export function SafetyDisclosure() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const numbers = localeNumbers(locale);

  return (
    <details className="group rounded-lg border border-warning/20 bg-warning/10 dark:border-theme-soft dark:bg-warning/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.12)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-foreground list-none">
        <span aria-hidden="true">ⓘ</span>
        <span className="flex-1">
          <span className="font-semibold">{t('safety_disclosure.safety_headline')}</span>{' '}
          {t('safety_disclosure.safety_call_emergency', { number: numbers.emergency })}
        </span>
        <span
          className="text-foreground-muted underline shrink-0 group-open:hidden"
          aria-hidden="true"
        >
          {t('safety_disclosure.safety_info')}
        </span>
        <span
          className="text-foreground-muted underline shrink-0 hidden group-open:inline"
          aria-hidden="true"
        >
          {t('safety_disclosure.safety_hide')}
        </span>
      </summary>
      <div className="border-t border-warning/20 dark:border-white/[0.06] px-3 py-3 space-y-3 text-xs text-foreground leading-relaxed">
        <p>{t('honesty_disclaimer')}</p>
        <p>
          <span className="font-semibold">{t('safety_disclosure.safety_talking_to_ai')}</span>{' '}
          {t('safety_disclosure.safety_emergency_instruction', { number: numbers.emergency })}{' '}
          <a
            href={`tel:${numbers.helpline.replace(/[^+\d]/g, '')}`}
            className="underline font-semibold"
          >
            {t('safety_disclosure.safety_helpline', {
              phone: numbers.helpline,
              name: numbers.helplineName,
            })}
          </a>
        </p>
      </div>
    </details>
  );
}
