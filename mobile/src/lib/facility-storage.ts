import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  // Native module unavailable — falls back to AsyncStorage
}

const FACILITY_CODE_KEY = 'calmguide_facility_code';
const FACILITY_NAME_KEY = 'calmguide_facility_name';
const JWT_TOKEN_KEY = 'calmguide_facility_jwt';
const JWT_EXPIRY_KEY = 'calmguide_facility_jwt_expiry';
const STAFF_KEY = 'calmguide_facility_staff';

export interface StoredStaff {
  id: string;
  name: string;
  role: 'staff' | 'admin' | 'owner';
  language_preference: string;
}

/**
 * Read a sensitive value from SecureStore, falling back to a legacy plaintext
 * AsyncStorage value written by older app versions. When a legacy value is
 * found it is promoted into SecureStore and removed from AsyncStorage so the
 * migration is one-time and transparent (MOB-2/MOB-6).
 */
async function getSecureWithLegacyFallback(key: string): Promise<string | null> {
  try {
    if (SecureStore) {
      const secure = await SecureStore.getItemAsync(key);
      if (secure !== null) return secure;
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  } catch {
    // SecureStore failure — fall back to plaintext so reads never hard-fail.
    return AsyncStorage.getItem(key);
  }
}

async function setSecureValue(key: string, value: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    if (__DEV__) console.warn('SecureStore unavailable — falling back to AsyncStorage:', err);
    await AsyncStorage.setItem(key, value);
  }
}

// Facility code is a tenant identifier used to scope staff/resident data —
// stored in SecureStore (MOB-6), with a legacy AsyncStorage read-fallback.
export async function getFacilityCode(): Promise<string | null> {
  return getSecureWithLegacyFallback(FACILITY_CODE_KEY);
}

export async function setFacilityCode(code: string): Promise<void> {
  await setSecureValue(FACILITY_CODE_KEY, code);
}

// Facility name is a display-only label (not a credential), so it stays in
// AsyncStorage — keeping non-sensitive prefs out of the secure keychain.
export async function getFacilityName(): Promise<string | null> {
  return AsyncStorage.getItem(FACILITY_NAME_KEY);
}

export async function setFacilityName(name: string): Promise<void> {
  await AsyncStorage.setItem(FACILITY_NAME_KEY, name);
}

export async function getToken(): Promise<string | null> {
  try {
    const expiry = await AsyncStorage.getItem(JWT_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      await clearToken();
      return null;
    }
    if (SecureStore) return await SecureStore.getItemAsync(JWT_TOKEN_KEY);
    return AsyncStorage.getItem(JWT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string, expiresAt?: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(JWT_TOKEN_KEY, token);
    } else {
      await AsyncStorage.setItem(JWT_TOKEN_KEY, token);
    }
    if (expiresAt) {
      const expiryMs = new Date(expiresAt).getTime();
      await AsyncStorage.setItem(JWT_EXPIRY_KEY, String(expiryMs));
    }
  } catch (err) {
    if (__DEV__) console.warn('SecureStore unavailable for JWT, using AsyncStorage:', err);
    await AsyncStorage.setItem(JWT_TOKEN_KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (SecureStore) await SecureStore.deleteItemAsync(JWT_TOKEN_KEY);
    await AsyncStorage.removeItem(JWT_TOKEN_KEY);
    await AsyncStorage.removeItem(JWT_EXPIRY_KEY);
  } catch { /* ignore */ }
}

// Staff name + role identify a real person — stored in SecureStore (MOB-2/MOB-3),
// with a legacy AsyncStorage read-fallback for existing installs.
export async function getStoredStaff(): Promise<StoredStaff | null> {
  const raw = await getSecureWithLegacyFallback(STAFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredStaff;
  } catch {
    return null;
  }
}

export async function setStoredStaff(staff: StoredStaff): Promise<void> {
  await setSecureValue(STAFF_KEY, JSON.stringify(staff));
}

/** Remove keys from both SecureStore and AsyncStorage so migrated-but-secure
 * items (facility code, staff) and any legacy plaintext copies are both wiped. */
async function purgeKeys(keys: string[]): Promise<void> {
  if (SecureStore) {
    await Promise.allSettled(keys.map((k) => SecureStore!.deleteItemAsync(k)));
  }
  await AsyncStorage.multiRemove(keys);
}

export async function clearFacilitySession(): Promise<void> {
  await clearToken();
  await purgeKeys([STAFF_KEY, FACILITY_CODE_KEY, FACILITY_NAME_KEY]);
}

export async function clearAllFacilityData(): Promise<void> {
  await clearToken();
  await purgeKeys([
    FACILITY_CODE_KEY,
    FACILITY_NAME_KEY,
    STAFF_KEY,
  ]);
}
