import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { I18nManager } from "react-native";

// Import all locale files
import enCommon from "../../locales/en/common.json";
import enCoach from "../../locales/en/coach.json";
import enHome from "../../locales/en/home.json";
import enCheckin from "../../locales/en/checkin.json";
import enLearn from "../../locales/en/learn.json";
import enProfile from "../../locales/en/profile.json";
import enImpact from "../../locales/en/impact.json";
import enJourney from "../../locales/en/journey.json";
import enIncidents from "../../locales/en/incidents.json";
import enFacility from "../../locales/en/facility.json";

import esCommon from "../../locales/es/common.json";
import esCoach from "../../locales/es/coach.json";
import esHome from "../../locales/es/home.json";
import esCheckin from "../../locales/es/checkin.json";
import esLearn from "../../locales/es/learn.json";
import esProfile from "../../locales/es/profile.json";
import esImpact from "../../locales/es/impact.json";
import esJourney from "../../locales/es/journey.json";
import esIncidents from "../../locales/es/incidents.json";
import esFacility from "../../locales/es/facility.json";


import hiCommon from "../../locales/hi/common.json";
import hiCoach from "../../locales/hi/coach.json";
import hiHome from "../../locales/hi/home.json";
import hiCheckin from "../../locales/hi/checkin.json";
import hiLearn from "../../locales/hi/learn.json";
import hiProfile from "../../locales/hi/profile.json";
import hiImpact from "../../locales/hi/impact.json";
import hiJourney from "../../locales/hi/journey.json";
import hiIncidents from "../../locales/hi/incidents.json";
import hiFacility from "../../locales/hi/facility.json";








const SUPPORTED_LOCALES = ["en-US", "es-ES", "hi-IN"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const BASE_LANGUAGE_TO_LOCALE = {
  en: "en-US",
  es: "es-ES",
  hi: "hi-IN",
} as const satisfies Record<string, SupportedLocale>;

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "en-US": "English (US)",
  "es-ES": "Español",
  "hi-IN": "हिन्दी",
};

function isRtlLocale(locale: string): boolean {
  return locale.split("-", 1)[0].toLowerCase() === "ar";
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

function resolveSupportedLocale(locale: string): SupportedLocale | null {
  const normalized = locale.replace(/_/g, "-").trim();
  const exactMatch = SUPPORTED_LOCALES.find(
    (supportedLocale) => supportedLocale.toLowerCase() === normalized.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const base = normalized.split("-", 1)[0].toLowerCase();
  return BASE_LANGUAGE_TO_LOCALE[base as keyof typeof BASE_LANGUAGE_TO_LOCALE] ?? null;
}

function getDeviceLocale(): string {
  const deviceLocales = Localization.getLocales();
  if (deviceLocales.length > 0) {
    const resolved = resolveSupportedLocale(deviceLocales[0].languageTag);
    if (resolved) return resolved;
  }
  return "en-US";
}

i18n.use(initReactI18next).init({
  lng: getDeviceLocale(),
  fallbackLng: "en-US",
  supportedLngs: SUPPORTED_LOCALES,
  ns: ["common", "coach", "home", "checkin", "learn", "profile", "impact", "journey", "incidents", "facility"],
  defaultNS: "common",
  resources: {
    "en-US": { common: enCommon, coach: enCoach, home: enHome, checkin: enCheckin, learn: enLearn, profile: enProfile, impact: enImpact, journey: enJourney, incidents: enIncidents, facility: enFacility },
    "es-ES": { common: esCommon, coach: esCoach, home: esHome, checkin: esCheckin, learn: esLearn, profile: esProfile, impact: esImpact, journey: esJourney, incidents: esIncidents, facility: esFacility },
    "hi-IN": { common: hiCommon, coach: hiCoach, home: hiHome, checkin: hiCheckin, learn: hiLearn, profile: hiProfile, impact: hiImpact, journey: hiJourney, incidents: hiIncidents, facility: hiFacility },
  },
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
});

export async function applyLocaleChange(locale: SupportedLocale): Promise<{ restartRequired: boolean }> {
  const { setPreferredLanguage } = await import("./storage");
  await setPreferredLanguage(locale);
  await i18n.changeLanguage(locale);

  const shouldUseRtl = isRtlLocale(locale);
  const restartRequired = I18nManager.isRTL !== shouldUseRtl;

  if (restartRequired) {
    I18nManager.allowRTL(shouldUseRtl);
    I18nManager.forceRTL(shouldUseRtl);
  }

  return { restartRequired };
}

export { i18n, SUPPORTED_LOCALES, LOCALE_LABELS, getDeviceLocale, resolveSupportedLocale, isRtlLocale };
export type { SupportedLocale };
