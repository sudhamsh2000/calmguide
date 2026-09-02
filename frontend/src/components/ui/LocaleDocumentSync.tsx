'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { isRtl } from '@/lib/locale';

export function LocaleDocumentSync() {
  const locale = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  return null;
}
