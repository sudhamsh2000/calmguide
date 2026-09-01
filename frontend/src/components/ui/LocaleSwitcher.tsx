'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, LOCALE_NAMES, isRtl, type SupportedLocale } from '@/lib/locale';

export function LocaleSwitcher({ triggerClassName = 'text-foreground-muted hover:text-foreground' }: { triggerClassName?: string }) {
  const currentLocale = useLocale() as SupportedLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rtl = isRtl(currentLocale);

  const currentLabel = LOCALE_NAMES[currentLocale] ?? currentLocale;

  function handleSelect(locale: SupportedLocale) {
    setOpen(false);
    router.replace(pathname, { locale });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`text-sm transition-colors !min-h-0 ${triggerClassName}`}
      >
        <span dir="auto">{currentLabel}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute bottom-full mb-2 z-50 w-48 overflow-hidden rounded-xl border border-foreground/10 bg-surface shadow-lg ${
              rtl ? 'left-0' : 'right-0'
            }`}
          >
            {SUPPORTED_LOCALES.map((locale) => {
              const isActive = locale === currentLocale;
              return (
                <button
                  key={locale}
                  type="button"
                  onClick={() => handleSelect(locale)}
                  className={`w-full px-4 py-2.5 text-sm transition-colors !min-h-0 ${
                    isActive
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-foreground hover:bg-foreground/5'
                  }`}
                  style={{ textAlign: 'start' }}
                >
                  <span dir="auto">{LOCALE_NAMES[locale]}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
