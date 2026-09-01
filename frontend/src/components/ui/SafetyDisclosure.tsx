'use client';

import { useLocale, useTranslations } from 'next-intl';

const EMERGENCY_NUMBERS: Record<string, { emergency: string; helpline: string; helplineName: string }> = {
  en: { emergency: '911', helpline: '1-800-272-3900', helplineName: "Alzheimer's Association 24/7 Helpline" },
  es: { emergency: '911', helpline: '1-800-272-3900', helplineName: 'Línea de Ayuda de Alzheimer 24/7' },
  hi: { emergency: '112', helpline: '1800-11-0031', helplineName: 'ARDSI हेल्पलाइन' },
};

export function SafetyDisclosure() {
  const t = useTranslations('coach');
  const locale = useLocale();
  const numbers = EMERGENCY_NUMBERS[locale] || EMERGENCY_NUMBERS.en;

  return (
    <details className="group rounded-lg border border-warning/20 bg-warning/10 dark:border-[#31445f] dark:bg-warning/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_0_0_1px_rgba(26,35,50,0.12)] [&_summary::-webkit-details-marker]:hidden">
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
          <a href={`tel:${numbers.helpline.replace(/[^+\d]/g, '')}`} className="underline font-semibold">
            {t('safety_disclosure.safety_helpline', { phone: numbers.helpline, name: numbers.helplineName })}
          </a>
        </p>
      </div>
    </details>
  );
}
