export const SUPPORTED_LOCALES = ['en-US', 'es-ES', 'hi-IN'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

const BASE_LANGUAGE_TO_LOCALE = {
  en: 'en-US',
  es: 'es-ES',
  hi: 'hi-IN',
} as const satisfies Record<string, SupportedLocale>;

export const LOCALE_MESSAGE_DIRS: Record<SupportedLocale, string> = {
  'en-US': 'en',
  'es-ES': 'es',
  'hi-IN': 'hi',
};

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  'en-US': 'English (US)',
  'es-ES': 'Español',
  'hi-IN': 'हिन्दी',
};

export function resolveSupportedLocale(locale: string | null | undefined): SupportedLocale | null {
  if (!locale) return null;

  const normalized = locale.replace('_', '-').trim();
  const exactMatch = SUPPORTED_LOCALES.find(
    (supportedLocale) => supportedLocale.toLowerCase() == normalized.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  const baseLanguage = normalized.split('-', 1)[0].toLowerCase();
  return BASE_LANGUAGE_TO_LOCALE[baseLanguage as keyof typeof BASE_LANGUAGE_TO_LOCALE] ?? null;
}

export function resolveLocaleMessageDir(locale: string): string {
  const supportedLocale = resolveSupportedLocale(locale) ?? DEFAULT_LOCALE;
  return LOCALE_MESSAGE_DIRS[supportedLocale];
}

export function isRtl(locale: string): boolean {
  return locale.split('-', 1)[0].toLowerCase() === 'ar';
}
