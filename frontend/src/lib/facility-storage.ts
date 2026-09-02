const KEYS = {
  FACILITY_CODE: 'calmguide_facility_code',
  FACILITY_NAME: 'calmguide_facility_name',
  FACILITY_LOGIN_MODE: 'calmguide_facility_login_mode',
  FACILITY_TOKEN: 'calmguide_facility_token',
  FACILITY_TOKEN_EXPIRES: 'calmguide_facility_token_expires',
} as const;

export type StoredFacilityLoginMode = 'facility-code' | 'staff-select' | 'email';

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__calmguide_fac_test__';
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

export function getFacilityCode(): string | null {
  return getItem(KEYS.FACILITY_CODE);
}

export function setFacilityCode(code: string): void {
  setItem(KEYS.FACILITY_CODE, code);
}

export function clearFacilityCode(): void {
  removeItem(KEYS.FACILITY_CODE);
  removeItem(KEYS.FACILITY_NAME);
  removeItem(KEYS.FACILITY_LOGIN_MODE);
}

export function getFacilityName(): string | null {
  return getItem(KEYS.FACILITY_NAME);
}

export function setFacilityName(name: string): void {
  setItem(KEYS.FACILITY_NAME, name);
}

export function getFacilityLoginMode(): StoredFacilityLoginMode | null {
  const mode = getItem(KEYS.FACILITY_LOGIN_MODE);
  if (mode === 'facility-code' || mode === 'staff-select' || mode === 'email') {
    return mode;
  }
  return null;
}

export function setFacilityLoginMode(mode: StoredFacilityLoginMode): void {
  setItem(KEYS.FACILITY_LOGIN_MODE, mode);
}

export function clearFacilityLoginMode(): void {
  removeItem(KEYS.FACILITY_LOGIN_MODE);
}

export function getFacilityToken(): string | null {
  const expires = getItem(KEYS.FACILITY_TOKEN_EXPIRES);
  if (expires && Date.now() > Number(expires)) {
    removeFacilityToken();
    return null;
  }
  return getItem(KEYS.FACILITY_TOKEN);
}

export function getRawFacilityToken(): string | null {
  return getItem(KEYS.FACILITY_TOKEN);
}

export function setFacilityToken(token: string, expiresAt: string): void {
  setItem(KEYS.FACILITY_TOKEN, token);
  setItem(KEYS.FACILITY_TOKEN_EXPIRES, String(new Date(expiresAt).getTime()));
}

export function removeFacilityToken(): void {
  removeItem(KEYS.FACILITY_TOKEN);
  removeItem(KEYS.FACILITY_TOKEN_EXPIRES);
}

export function clearFacilitySession(): void {
  removeFacilityToken();
  clearFacilityCode();
}

const STAFF_KEY = 'calmguide_facility_staff';

export function getStoredStaff(): import('@/lib/facility-api').StaffInfo | null {
  const raw = getItem(STAFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredStaff(staff: import('@/lib/facility-api').StaffInfo): void {
  setItem(STAFF_KEY, JSON.stringify(staff));
}

export function clearStoredStaff(): void {
  removeItem(STAFF_KEY);
}

export { KEYS as FACILITY_STORAGE_KEYS };
