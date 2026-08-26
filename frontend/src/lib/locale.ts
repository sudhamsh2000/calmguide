export const SUPPORTED_LOCALES = [
  "en-US",
  "es-ES",
  "zh-CN",
  "hi-IN",
  "ta-IN",
  "ar-SA",
  "fr-FR",
  "pt-BR",
  "ja-JP",
  "de-DE",
  "ko-KR",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

const BASE_LANGUAGE_TO_LOCALE = {
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  hi: "hi-IN",
  ta: "ta-IN",
  ar: "ar-SA",
  fr: "fr-FR",
  pt: "pt-BR",
  ja: "ja-JP",
  de: "de-DE",
  ko: "ko-KR",
} as const satisfies Record<string, SupportedLocale>;

export const LOCALE_MESSAGE_DIRS: Record<SupportedLocale, string> = {
  "en-US": "en",
  "es-ES": "es",
  "zh-CN": "zh",
  "hi-IN": "hi",
  "ta-IN": "ta",
  "ar-SA": "ar",
  "fr-FR": "fr",
  "pt-BR": "pt-BR",
  "ja-JP": "ja",
  "de-DE": "de",
  "ko-KR": "ko",
};

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  "en-US": "English (US)",
  "es-ES": "Español",
  "zh-CN": "中文(简体)",
  "hi-IN": "हिन्दी",
  "ta-IN": "தமிழ்",
  "ar-SA": "العربية",
  "fr-FR": "Français",
  "pt-BR": "Português",
  "ja-JP": "日本語",
  "de-DE": "Deutsch",
  "ko-KR": "한국어",
};

export function resolveSupportedLocale(locale: string | null | undefined): SupportedLocale | null {
  if (!locale) return null;

  const normalized = locale.replace("_", "-").trim();
  const exactMatch = SUPPORTED_LOCALES.find(
    (supportedLocale) => supportedLocale.toLowerCase() == normalized.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const baseLanguage = normalized.split("-", 1)[0].toLowerCase();
  return BASE_LANGUAGE_TO_LOCALE[baseLanguage as keyof typeof BASE_LANGUAGE_TO_LOCALE] ?? null;
}

export function resolveLocaleMessageDir(locale: string): string {
  const supportedLocale = resolveSupportedLocale(locale) ?? DEFAULT_LOCALE;
  return LOCALE_MESSAGE_DIRS[supportedLocale];
}

export function isRtl(locale: string): boolean {
  return locale.split("-", 1)[0].toLowerCase() === "ar";
}
