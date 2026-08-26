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

import zhCommon from "../../locales/zh/common.json";
import zhCoach from "../../locales/zh/coach.json";
import zhHome from "../../locales/zh/home.json";
import zhCheckin from "../../locales/zh/checkin.json";
import zhLearn from "../../locales/zh/learn.json";
import zhProfile from "../../locales/zh/profile.json";
import zhImpact from "../../locales/zh/impact.json";
import zhJourney from "../../locales/zh/journey.json";
import zhIncidents from "../../locales/zh/incidents.json";
import zhFacility from "../../locales/zh/facility.json";

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

import taCommon from "../../locales/ta/common.json";
import taCoach from "../../locales/ta/coach.json";
import taHome from "../../locales/ta/home.json";
import taCheckin from "../../locales/ta/checkin.json";
import taLearn from "../../locales/ta/learn.json";
import taProfile from "../../locales/ta/profile.json";
import taImpact from "../../locales/ta/impact.json";
import taJourney from "../../locales/ta/journey.json";
import taIncidents from "../../locales/ta/incidents.json";
import taFacility from "../../locales/ta/facility.json";

import arCommon from "../../locales/ar/common.json";
import arCoach from "../../locales/ar/coach.json";
import arHome from "../../locales/ar/home.json";
import arCheckin from "../../locales/ar/checkin.json";
import arLearn from "../../locales/ar/learn.json";
import arProfile from "../../locales/ar/profile.json";
import arImpact from "../../locales/ar/impact.json";
import arJourney from "../../locales/ar/journey.json";
import arIncidents from "../../locales/ar/incidents.json";
import arFacility from "../../locales/ar/facility.json";

import frCommon from "../../locales/fr/common.json";
import frCoach from "../../locales/fr/coach.json";
import frHome from "../../locales/fr/home.json";
import frCheckin from "../../locales/fr/checkin.json";
import frLearn from "../../locales/fr/learn.json";
import frProfile from "../../locales/fr/profile.json";
import frImpact from "../../locales/fr/impact.json";
import frJourney from "../../locales/fr/journey.json";
import frIncidents from "../../locales/fr/incidents.json";
import frFacility from "../../locales/fr/facility.json";

import ptBRCommon from "../../locales/pt-BR/common.json";
import ptBRCoach from "../../locales/pt-BR/coach.json";
import ptBRHome from "../../locales/pt-BR/home.json";
import ptBRCheckin from "../../locales/pt-BR/checkin.json";
import ptBRLearn from "../../locales/pt-BR/learn.json";
import ptBRProfile from "../../locales/pt-BR/profile.json";
import ptBRImpact from "../../locales/pt-BR/impact.json";
import ptBRJourney from "../../locales/pt-BR/journey.json";
import ptBRIncidents from "../../locales/pt-BR/incidents.json";
import ptBRFacility from "../../locales/pt-BR/facility.json";

import jaCommon from "../../locales/ja/common.json";
import jaCoach from "../../locales/ja/coach.json";
import jaHome from "../../locales/ja/home.json";
import jaCheckin from "../../locales/ja/checkin.json";
import jaLearn from "../../locales/ja/learn.json";
import jaProfile from "../../locales/ja/profile.json";
import jaImpact from "../../locales/ja/impact.json";
import jaJourney from "../../locales/ja/journey.json";
import jaIncidents from "../../locales/ja/incidents.json";
import jaFacility from "../../locales/ja/facility.json";

import deCommon from "../../locales/de/common.json";
import deCoach from "../../locales/de/coach.json";
import deHome from "../../locales/de/home.json";
import deCheckin from "../../locales/de/checkin.json";
import deLearn from "../../locales/de/learn.json";
import deProfile from "../../locales/de/profile.json";
import deImpact from "../../locales/de/impact.json";
import deJourney from "../../locales/de/journey.json";
import deIncidents from "../../locales/de/incidents.json";
import deFacility from "../../locales/de/facility.json";

import koCommon from "../../locales/ko/common.json";
import koCoach from "../../locales/ko/coach.json";
import koHome from "../../locales/ko/home.json";
import koCheckin from "../../locales/ko/checkin.json";
import koLearn from "../../locales/ko/learn.json";
import koProfile from "../../locales/ko/profile.json";
import koImpact from "../../locales/ko/impact.json";
import koJourney from "../../locales/ko/journey.json";
import koIncidents from "../../locales/ko/incidents.json";
import koFacility from "../../locales/ko/facility.json";

const SUPPORTED_LOCALES = ["en-US", "es-ES", "zh-CN", "hi-IN", "ta-IN", "ar-SA", "fr-FR", "pt-BR", "ja-JP", "de-DE", "ko-KR"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

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

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "en-US": "English (US)",
  "es-ES": "Español",
  "zh-CN": "中文(简体)",
  "hi-IN": "हिन्दी",
  "ta-IN": "தமிழ்",
  "ar-SA": "العربية",
  "fr-FR": "Français",
  "pt-BR": "Português (Brasil)",
  "ja-JP": "日本語",
  "de-DE": "Deutsch",
  "ko-KR": "한국어",
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
    "zh-CN": { common: zhCommon, coach: zhCoach, home: zhHome, checkin: zhCheckin, learn: zhLearn, profile: zhProfile, impact: zhImpact, journey: zhJourney, incidents: zhIncidents, facility: zhFacility },
    "hi-IN": { common: hiCommon, coach: hiCoach, home: hiHome, checkin: hiCheckin, learn: hiLearn, profile: hiProfile, impact: hiImpact, journey: hiJourney, incidents: hiIncidents, facility: hiFacility },
    "ta-IN": { common: taCommon, coach: taCoach, home: taHome, checkin: taCheckin, learn: taLearn, profile: taProfile, impact: taImpact, journey: taJourney, incidents: taIncidents, facility: taFacility },
    "ar-SA": { common: arCommon, coach: arCoach, home: arHome, checkin: arCheckin, learn: arLearn, profile: arProfile, impact: arImpact, journey: arJourney, incidents: arIncidents, facility: arFacility },
    "fr-FR": { common: frCommon, coach: frCoach, home: frHome, checkin: frCheckin, learn: frLearn, profile: frProfile, impact: frImpact, journey: frJourney, incidents: frIncidents, facility: frFacility },
    "pt-BR": { common: ptBRCommon, coach: ptBRCoach, home: ptBRHome, checkin: ptBRCheckin, learn: ptBRLearn, profile: ptBRProfile, impact: ptBRImpact, journey: ptBRJourney, incidents: ptBRIncidents, facility: ptBRFacility },
    "ja-JP": { common: jaCommon, coach: jaCoach, home: jaHome, checkin: jaCheckin, learn: jaLearn, profile: jaProfile, impact: jaImpact, journey: jaJourney, incidents: jaIncidents, facility: jaFacility },
    "de-DE": { common: deCommon, coach: deCoach, home: deHome, checkin: deCheckin, learn: deLearn, profile: deProfile, impact: deImpact, journey: deJourney, incidents: deIncidents, facility: deFacility },
    "ko-KR": { common: koCommon, coach: koCoach, home: koHome, checkin: koCheckin, learn: koLearn, profile: koProfile, impact: koImpact, journey: koJourney, incidents: koIncidents, facility: koFacility },
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
