import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  // Native module unavailable (Expo Go / web) — falls back to AsyncStorage
}

const ACCESS_CODE_KEY = 'calmguide_access_code';
const PATIENT_NAME_KEY = 'calmguide_patient_name';
const DISCLAIMER_ACCEPTED_KEY = 'calmguide_disclaimer_accepted';

export async function getAccessCode(): Promise<string | null> {
  try {
    if (SecureStore) {
      const secure = await SecureStore.getItemAsync(ACCESS_CODE_KEY);
      if (secure) return secure;
      const legacy = await AsyncStorage.getItem(ACCESS_CODE_KEY);
      if (legacy) {
        await SecureStore.setItemAsync(ACCESS_CODE_KEY, legacy);
        await AsyncStorage.removeItem(ACCESS_CODE_KEY);
        return legacy;
      }
      return null;
    }
    return AsyncStorage.getItem(ACCESS_CODE_KEY);
  } catch {
    return AsyncStorage.getItem(ACCESS_CODE_KEY);
  }
}

export async function setAccessCode(code: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(ACCESS_CODE_KEY, code);
      await AsyncStorage.removeItem(ACCESS_CODE_KEY);
    } else {
      await AsyncStorage.setItem(ACCESS_CODE_KEY, code);
    }
  } catch (err) {
    if (__DEV__) console.warn('SecureStore unavailable — falling back to AsyncStorage:', err);
    await AsyncStorage.setItem(ACCESS_CODE_KEY, code);
  }
}

export async function getPatientName(): Promise<string | null> {
  try {
    if (SecureStore) {
      const secure = await SecureStore.getItemAsync(PATIENT_NAME_KEY);
      if (secure) return secure;
      const legacy = await AsyncStorage.getItem(PATIENT_NAME_KEY);
      if (legacy) {
        await SecureStore.setItemAsync(PATIENT_NAME_KEY, legacy);
        await AsyncStorage.removeItem(PATIENT_NAME_KEY);
        return legacy;
      }
      return null;
    }
    return AsyncStorage.getItem(PATIENT_NAME_KEY);
  } catch {
    return AsyncStorage.getItem(PATIENT_NAME_KEY);
  }
}

export async function setPatientName(name: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(PATIENT_NAME_KEY, name);
      await AsyncStorage.removeItem(PATIENT_NAME_KEY);
    } else {
      await AsyncStorage.setItem(PATIENT_NAME_KEY, name);
    }
  } catch (err) {
    if (__DEV__) console.warn('SecureStore unavailable — falling back to AsyncStorage:', err);
    await AsyncStorage.setItem(PATIENT_NAME_KEY, name);
  }
}

export async function getDisclaimerAccepted(): Promise<boolean> {
  return (await AsyncStorage.getItem(DISCLAIMER_ACCEPTED_KEY)) === 'true';
}

export async function setDisclaimerAccepted(): Promise<void> {
  await AsyncStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true');
}

export async function clearAll(): Promise<void> {
  if (SecureStore) {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(ACCESS_CODE_KEY),
      SecureStore.deleteItemAsync(PATIENT_NAME_KEY),
      SecureStore.deleteItemAsync(PROFILES_KEY),
    ]);
  }
  await AsyncStorage.multiRemove([
    ACCESS_CODE_KEY,
    PATIENT_NAME_KEY,
    DISCLAIMER_ACCEPTED_KEY,
    PROFILES_KEY,
  ]);
}

const PREFERRED_LANGUAGE_KEY = 'calmguide_preferred_language';

export async function getPreferredLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
}

export async function setPreferredLanguage(locale: string): Promise<void> {
  await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, locale);
}

// ── Multi-profile support ────────────────────────────────────────────────

export interface StoredProfile {
  access_code: string;
  patient_name: string;
  disease_stage: string;
}

const PROFILES_KEY = 'calmguide_profiles';
const ACTIVE_PROFILE_INDEX_KEY = 'calmguide_active_profile_index';

export async function getProfiles(): Promise<StoredProfile[]> {
  try {
    if (SecureStore) {
      const secure = await SecureStore.getItemAsync(PROFILES_KEY);
      if (secure) {
        try {
          return JSON.parse(secure) as StoredProfile[];
        } catch {
          return [];
        }
      }
      // Migration: read from AsyncStorage and promote to SecureStore
      const legacy = await AsyncStorage.getItem(PROFILES_KEY);
      if (legacy) {
        await SecureStore.setItemAsync(PROFILES_KEY, legacy);
        await AsyncStorage.removeItem(PROFILES_KEY);
        try {
          return JSON.parse(legacy) as StoredProfile[];
        } catch {
          return [];
        }
      }
    } else {
      const raw = await AsyncStorage.getItem(PROFILES_KEY);
      if (raw) {
        try {
          return JSON.parse(raw) as StoredProfile[];
        } catch {
          return [];
        }
      }
    }
  } catch {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as StoredProfile[];
      } catch {
        return [];
      }
    }
  }

  // No profiles found in any store — check for legacy single-profile values
  const legacyCode = await getAccessCode();
  const legacyName = await getPatientName();
  if (legacyCode && legacyName) {
    return [{ access_code: legacyCode, patient_name: legacyName, disease_stage: 'unknown' }];
  }
  return [];
}

export async function setProfiles(profiles: StoredProfile[]): Promise<void> {
  const serialised = JSON.stringify(profiles);
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(PROFILES_KEY, serialised);
      await AsyncStorage.removeItem(PROFILES_KEY);
    } else {
      await AsyncStorage.setItem(PROFILES_KEY, serialised);
    }
  } catch (err) {
    if (__DEV__) console.warn('SecureStore unavailable — falling back to AsyncStorage:', err);
    await AsyncStorage.setItem(PROFILES_KEY, serialised);
  }
}

export async function getActiveProfileIndex(): Promise<number> {
  const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_INDEX_KEY);
  if (!raw) return 0;
  const idx = parseInt(raw, 10);
  return isNaN(idx) ? 0 : idx;
}

export async function setActiveProfileIndex(index: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_PROFILE_INDEX_KEY, String(index));
}

export async function getActiveProfile(): Promise<StoredProfile | null> {
  const profiles = await getProfiles();
  if (profiles.length === 0) return null;
  const idx = Math.min(await getActiveProfileIndex(), profiles.length - 1);
  return profiles[idx] ?? null;
}

export async function addProfile(profile: StoredProfile): Promise<void> {
  const profiles = await getProfiles();
  profiles.push(profile);
  await setProfiles(profiles);
  await setActiveProfileIndex(profiles.length - 1);
  await setAccessCode(profile.access_code);
  await setPatientName(profile.patient_name);
}

export async function removeProfile(index: number): Promise<void> {
  const profiles = await getProfiles();
  if (index < 0 || index >= profiles.length) return;
  profiles.splice(index, 1);
  await setProfiles(profiles);
  const activeIdx = await getActiveProfileIndex();
  if (profiles.length === 0) {
    await setActiveProfileIndex(0);
    await clearAll();
  } else {
    const newIdx = Math.min(activeIdx, profiles.length - 1);
    await setActiveProfileIndex(newIdx);
    const active = profiles[newIdx];
    if (active) {
      await setAccessCode(active.access_code);
      await setPatientName(active.patient_name);
    }
  }
}

export async function switchProfile(index: number): Promise<void> {
  const profiles = await getProfiles();
  if (index < 0 || index >= profiles.length) return;
  await setActiveProfileIndex(index);
  const profile = profiles[index];
  if (profile) {
    await setAccessCode(profile.access_code);
    await setPatientName(profile.patient_name);
  }
}
