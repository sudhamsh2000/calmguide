const KEYS = {
  PATIENT_NAME: 'calmguide_patient_name',
  ACCESS_CODE: 'calmguide_access_code',
  PREFERRED_LANGUAGE: 'calmguide_preferred_language',
  DISCLAIMER_ACCEPTED: 'calmguide_disclaimer_accepted',
  AUTO_SPEAK_REPLIES: 'calmguide_auto_speak_replies',
  SESSION_STARTED_AT: 'calmguide_session_started_at',
  SESSION_LAST_ACTIVE_AT: 'calmguide_session_last_active_at',
  SESSION_EXPIRED: 'calmguide_session_expired',
} as const;

/** Sign out after this long with no interaction. */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Sign out this long after sign-in, however active the session has been. */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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

// ── Session expiry ───────────────────────────────────────────────────────

/*
 * The access code is the only credential in B2C mode, and it lives in
 * localStorage — which never expires on its own. Without these timestamps,
 * anyone who picks up the device later (a shared family tablet, a phone
 * left unlocked) walks straight into the care profile.
 *
 * Expiry is enforced lazily on read, the same way getFacilityToken() drops
 * a stale staff token: every getter that could hand out a session goes
 * through enforceSessionExpiry() first, so no page can read a stale code
 * before SessionExpiryGuard has had a chance to run.
 */

let sessionJustExpired = false;

function hasStoredSession(): boolean {
  return getItem(KEYS.ACCESS_CODE) !== null || getItem(PROFILES_KEY) !== null;
}

function readTimestamp(key: string): number | null {
  const raw = getItem(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether the stored session is past its idle or absolute limit. A session
 * with no timestamps (stored before expiry existed) counts as expired: there
 * is no evidence it was used recently, so it gets one fresh sign-in.
 */
export function isSessionExpired(now: number = Date.now()): boolean {
  const startedAt = readTimestamp(KEYS.SESSION_STARTED_AT);
  const lastActiveAt = readTimestamp(KEYS.SESSION_LAST_ACTIVE_AT);
  if (startedAt === null || lastActiveAt === null) return true;
  return now - lastActiveAt > SESSION_IDLE_TIMEOUT_MS || now - startedAt > SESSION_MAX_AGE_MS;
}

function enforceSessionExpiry(): void {
  if (!hasStoredSession() || !isSessionExpired()) return;
  clearSession();
  sessionJustExpired = true;
  setItem(KEYS.SESSION_EXPIRED, 'true');
}

/** Record activity so the idle timer restarts. No-op without a live session. */
export function touchSession(now: number = Date.now()): void {
  enforceSessionExpiry();
  if (!hasStoredSession()) return;
  setItem(KEYS.SESSION_LAST_ACTIVE_AT, String(now));
}

/**
 * True once after a stale session was cleared, so the UI can send the
 * caregiver to the access-code screen instead of profile setup.
 */
export function consumeSessionExpired(): boolean {
  enforceSessionExpiry();
  const expired = sessionJustExpired;
  sessionJustExpired = false;
  return expired;
}

/**
 * Where a page with no session should send the caregiver: back to the
 * access-code screen if their session timed out, otherwise to profile
 * setup. Pages redirect before SessionExpiryGuard's effect runs (child
 * effects fire first), so they pick the target themselves — from a stored
 * marker rather than the one-shot flag, which the guard may already have
 * consumed (e.g. when Strict Mode re-runs effects).
 */
export function noSessionRedirectPath(): '/login' | '/profile/setup' {
  enforceSessionExpiry();
  return getItem(KEYS.SESSION_EXPIRED) === 'true' ? '/login' : '/profile/setup';
}

function markSessionActive(): void {
  const now = String(Date.now());
  if (getItem(KEYS.SESSION_STARTED_AT) === null) setItem(KEYS.SESSION_STARTED_AT, now);
  setItem(KEYS.SESSION_LAST_ACTIVE_AT, now);
}

/**
 * Drop the signed-in session but keep device preferences (language,
 * disclaimer, read-aloud) — those aren't the caregiver's credentials.
 */
function clearSession(): void {
  removeItem(KEYS.PATIENT_NAME);
  removeItem(KEYS.ACCESS_CODE);
  removeItem(PROFILES_KEY);
  removeItem(ACTIVE_PROFILE_INDEX_KEY);
  removeItem(KEYS.SESSION_STARTED_AT);
  removeItem(KEYS.SESSION_LAST_ACTIVE_AT);
}

export function getPatientName(): string | null {
  enforceSessionExpiry();
  return getItem(KEYS.PATIENT_NAME);
}

export function setPatientName(name: string): void {
  setItem(KEYS.PATIENT_NAME, name);
}

export function clearPatientName(): void {
  removeItem(KEYS.PATIENT_NAME);
}

export function getAccessCode(): string | null {
  enforceSessionExpiry();
  return getItem(KEYS.ACCESS_CODE);
}

/** Every sign-in path (login, setup wizard, profile switch) goes through here. */
export function setAccessCode(code: string): void {
  setItem(KEYS.ACCESS_CODE, code);
  removeItem(KEYS.SESSION_EXPIRED);
  markSessionActive();
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

/**
 * Sign out: drop the whole session, not just the legacy keys.
 *
 * The stored profile list has to go too. WelcomeGate treats a surviving
 * `getActiveProfile()` as a session to restore — it rewrites the access
 * code and name from it and redirects to /home — so leaving the list
 * behind silently undoes the sign-out on the very next render.
 */
export function clearAll(): void {
  clearSession();
  removeItem(KEYS.SESSION_EXPIRED);
  removeItem(KEYS.PREFERRED_LANGUAGE);
  removeItem(KEYS.DISCLAIMER_ACCEPTED);
}

// ── Multi-profile support ────────────────────────────────────────────────

/**
 * Which portrait stands in for the person on the profile card.
 *
 * The backend stores no name and no gender — profiles are deliberately
 * PII-free — so this can't be derived from anything the server knows, and
 * guessing it from a name would misgender people. It's an explicit choice
 * the caregiver makes, kept client-side next to the name. `monogram` is
 * the default and stays a first-class option, not a fallback.
 */
export type ProfileAvatar = 'monogram' | 'male' | 'female';

export const PROFILE_AVATARS: readonly ProfileAvatar[] = ['monogram', 'male', 'female'];

export function isProfileAvatar(value: unknown): value is ProfileAvatar {
  return typeof value === 'string' && (PROFILE_AVATARS as readonly string[]).includes(value);
}

export interface StoredProfile {
  access_code: string;
  patient_name: string;
  disease_stage: string;
  /** Absent on profiles created before avatars existed; treated as 'monogram'. */
  avatar?: ProfileAvatar;
}

const PROFILES_KEY = 'calmguide_profiles';
const ACTIVE_PROFILE_INDEX_KEY = 'calmguide_active_profile_index';

export function getProfiles(): StoredProfile[] {
  enforceSessionExpiry();
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

/**
 * Create or update the stored entry for a profile, and make it the active
 * one. Matches on access code, so calling it twice for the same profile
 * updates in place rather than adding a duplicate.
 *
 * The wizard used to write only the two legacy keys, which left
 * `getProfiles()` on its fallback path — and that path invents
 * `disease_stage: 'unknown'`, which ProfileSwitcher then displays. Writing
 * the real entry keeps the switcher honest and gives the avatar somewhere
 * to live.
 */
export function saveActiveProfile(profile: StoredProfile): void {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.access_code === profile.access_code);

  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile };
    setProfiles(profiles);
    setActiveProfileIndex(idx);
  } else {
    profiles.push(profile);
    setProfiles(profiles);
    setActiveProfileIndex(profiles.length - 1);
  }

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

/** The active profile's portrait, or 'monogram' when none was chosen. */
export function getActiveProfileAvatar(): ProfileAvatar {
  const avatar = getActiveProfile()?.avatar;
  return isProfileAvatar(avatar) ? avatar : 'monogram';
}

/** Set the active profile's portrait. No-op when there is no active profile. */
export function setActiveProfileAvatar(avatar: ProfileAvatar): void {
  const profiles = getProfiles();
  if (profiles.length === 0) return;
  const idx = Math.min(getActiveProfileIndex(), profiles.length - 1);
  const profile = profiles[idx];
  if (!profile) return;
  profiles[idx] = { ...profile, avatar };
  setProfiles(profiles);
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

/**
 * Whether Moment Coach / Check-In replies should be read aloud automatically
 * as soon as they finish streaming, instead of requiring a tap on each
 * section's speak button. Off by default: it starts audio (and, when the
 * neural voice is configured, a billed request) without an explicit action,
 * so a caregiver should opt in rather than have it start unexpectedly the
 * first time they open the app.
 */
export function getAutoSpeakReplies(): boolean {
  return getItem(KEYS.AUTO_SPEAK_REPLIES) === 'true';
}

export function setAutoSpeakReplies(enabled: boolean): void {
  setItem(KEYS.AUTO_SPEAK_REPLIES, enabled ? 'true' : 'false');
}

export { KEYS as STORAGE_KEYS };
