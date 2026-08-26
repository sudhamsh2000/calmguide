const KEYS = {
  PATIENT_NAME: 'calmguide_patient_name',
  ACCESS_CODE: 'calmguide_access_code',
  PREFERRED_LANGUAGE: 'calmguide_preferred_language',
  DISCLAIMER_ACCEPTED: 'calmguide_disclaimer_accepted',
} as const;

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__calmguide_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getItem(key: string): string | null {
  if (!isLocalStorageAvailable()) return null;
  return window.localStorage.getItem(key);
}

function setItem(key: string, value: string): void {
  if (!isLocalStorageAvailable()) return;
  window.localStorage.setItem(key, value);
}

function removeItem(key: string): void {
  if (!isLocalStorageAvailable()) return;
  window.localStorage.removeItem(key);
}

export function getPatientName(): string | null {
  return getItem(KEYS.PATIENT_NAME);
}

export function setPatientName(name: string): void {
  setItem(KEYS.PATIENT_NAME, name);
}

export function clearPatientName(): void {
  removeItem(KEYS.PATIENT_NAME);
}

export function getAccessCode(): string | null {
  return getItem(KEYS.ACCESS_CODE);
}

export function setAccessCode(code: string): void {
  setItem(KEYS.ACCESS_CODE, code);
}

export function clearAccessCode(): void {
  removeItem(KEYS.ACCESS_CODE);
}

export function getPreferredLanguage(): string | null {
  return getItem(KEYS.PREFERRED_LANGUAGE);
}

export function setPreferredLanguage(locale: string): void {
  setItem(KEYS.PREFERRED_LANGUAGE, locale);
}

export function clearPreferredLanguage(): void {
  removeItem(KEYS.PREFERRED_LANGUAGE);
}

export function getDisclaimerAccepted(): boolean {
  return getItem(KEYS.DISCLAIMER_ACCEPTED) === 'true';
}

export function setDisclaimerAccepted(): void {
  setItem(KEYS.DISCLAIMER_ACCEPTED, 'true');
}

export function clearAll(): void {
  removeItem(KEYS.PATIENT_NAME);
  removeItem(KEYS.ACCESS_CODE);
  removeItem(KEYS.PREFERRED_LANGUAGE);
  removeItem(KEYS.DISCLAIMER_ACCEPTED);
}

// ── Multi-profile support ────────────────────────────────────────────────

export interface StoredProfile {
  access_code: string;
  patient_name: string;
  disease_stage: string;
}

const PROFILES_KEY = 'calmguide_profiles';
const ACTIVE_PROFILE_INDEX_KEY = 'calmguide_active_profile_index';

export function getProfiles(): StoredProfile[] {
  const raw = getItem(PROFILES_KEY);
  if (!raw) {
    const legacyCode = getAccessCode();
    const legacyName = getPatientName();
    if (legacyCode && legacyName) {
      return [{ access_code: legacyCode, patient_name: legacyName, disease_stage: 'unknown' }];
    }
    return [];
  }
  try {
    return JSON.parse(raw) as StoredProfile[];
  } catch {
    return [];
  }
}

export function setProfiles(profiles: StoredProfile[]): void {
  setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileIndex(): number {
  const raw = getItem(ACTIVE_PROFILE_INDEX_KEY);
  if (!raw) return 0;
  const idx = parseInt(raw, 10);
  return isNaN(idx) ? 0 : idx;
}

export function setActiveProfileIndex(index: number): void {
  setItem(ACTIVE_PROFILE_INDEX_KEY, String(index));
}

export function getActiveProfile(): StoredProfile | null {
  const profiles = getProfiles();
  if (profiles.length === 0) return null;
  const idx = Math.min(getActiveProfileIndex(), profiles.length - 1);
  return profiles[idx] ?? null;
}

export function addProfile(profile: StoredProfile): void {
  const profiles = getProfiles();
  profiles.push(profile);
  setProfiles(profiles);
  setActiveProfileIndex(profiles.length - 1);
  setAccessCode(profile.access_code);
  setPatientName(profile.patient_name);
}

export function removeProfile(index: number): void {
  const profiles = getProfiles();
  if (index < 0 || index >= profiles.length) return;
  profiles.splice(index, 1);
  setProfiles(profiles);
  const activeIdx = getActiveProfileIndex();
  if (profiles.length === 0) {
    setActiveProfileIndex(0);
    clearAccessCode();
    clearPatientName();
  } else {
    const newIdx = Math.min(activeIdx, profiles.length - 1);
    setActiveProfileIndex(newIdx);
    const active = profiles[newIdx];
    if (active) {
      setAccessCode(active.access_code);
      setPatientName(active.patient_name);
    }
  }
}

export function switchProfile(index: number): void {
  const profiles = getProfiles();
  if (index < 0 || index >= profiles.length) return;
  setActiveProfileIndex(index);
  const profile = profiles[index];
  if (profile) {
    setAccessCode(profile.access_code);
    setPatientName(profile.patient_name);
  }
}

export { KEYS as STORAGE_KEYS };
