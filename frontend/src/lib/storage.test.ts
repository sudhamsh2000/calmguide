import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPatientName,
  setPatientName,
  clearPatientName,
  getAccessCode,
  setAccessCode,
  clearAccessCode,
  clearAll,
  STORAGE_KEYS,
  addProfile,
  saveActiveProfile,
  getActiveProfile,
  getActiveProfileAvatar,
  setActiveProfileAvatar,
  getProfiles,
  setPreferredLanguage,
  getPreferredLanguage,
  touchSession,
  consumeSessionExpired,
  noSessionRedirectPath,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_MAX_AGE_MS,
} from './storage';

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('patient name', () => {
    it('returns null when no patient name is set', () => {
      expect(getPatientName()).toBeNull();
    });

    it('stores and retrieves patient name', () => {
      setPatientName('Margaret');
      expect(getPatientName()).toBe('Margaret');
    });

    it('clears patient name', () => {
      setPatientName('Margaret');
      clearPatientName();
      expect(getPatientName()).toBeNull();
    });

    it('uses the correct storage key', () => {
      setPatientName('Margaret');
      expect(window.localStorage.getItem(STORAGE_KEYS.PATIENT_NAME)).toBe('Margaret');
    });
  });

  describe('access code', () => {
    it('returns null when no access code is set', () => {
      expect(getAccessCode()).toBeNull();
    });

    it('stores and retrieves access code', () => {
      setAccessCode('ABC12345');
      expect(getAccessCode()).toBe('ABC12345');
    });

    it('clears access code', () => {
      setAccessCode('ABC12345');
      clearAccessCode();
      expect(getAccessCode()).toBeNull();
    });

    it('uses the correct storage key', () => {
      setAccessCode('ABC12345');
      expect(window.localStorage.getItem(STORAGE_KEYS.ACCESS_CODE)).toBe('ABC12345');
    });
  });

  describe('clearAll', () => {
    it('clears all CalmGuide storage keys', () => {
      setPatientName('Margaret');
      setAccessCode('ABC12345');

      clearAll();

      expect(getPatientName()).toBeNull();
      expect(getAccessCode()).toBeNull();
    });

    it('does not clear unrelated window.localStorage keys', () => {
      window.localStorage.setItem('other_key', 'value');
      setPatientName('Margaret');

      clearAll();

      expect(window.localStorage.getItem('other_key')).toBe('value');
    });
  });

  describe('profile avatar', () => {
    it('defaults to the monogram when no profile exists', () => {
      expect(getActiveProfileAvatar()).toBe('monogram');
    });

    it('defaults to the monogram for profiles saved before avatars existed', () => {
      addProfile({ access_code: 'ABC123', patient_name: 'Tarun', disease_stage: 'early' });
      expect(getActiveProfileAvatar()).toBe('monogram');
    });

    it('stores and retrieves the chosen avatar', () => {
      addProfile({ access_code: 'ABC123', patient_name: 'Tarun', disease_stage: 'early' });
      setActiveProfileAvatar('male');
      expect(getActiveProfileAvatar()).toBe('male');
      expect(getProfiles()[0].avatar).toBe('male');
    });

    it('leaves the rest of the profile untouched', () => {
      addProfile({ access_code: 'ABC123', patient_name: 'Tarun', disease_stage: 'early' });
      setActiveProfileAvatar('female');
      expect(getProfiles()[0]).toMatchObject({
        access_code: 'ABC123',
        patient_name: 'Tarun',
        disease_stage: 'early',
      });
    });

    it('does nothing when there is no active profile', () => {
      expect(() => setActiveProfileAvatar('male')).not.toThrow();
      expect(getProfiles()).toHaveLength(0);
    });

    it('only changes the active profile in a multi-profile list', () => {
      addProfile({ access_code: 'AAA', patient_name: 'Tarun', disease_stage: 'early' });
      addProfile({ access_code: 'BBB', patient_name: 'Asha', disease_stage: 'late' });
      // addProfile makes the newly added one active.
      setActiveProfileAvatar('female');
      expect(getProfiles()[0].avatar).toBeUndefined();
      expect(getProfiles()[1].avatar).toBe('female');
    });
  });

  describe('clearAll', () => {
    it('leaves no session behind for WelcomeGate to restore', () => {
      // WelcomeGate rebuilds the access code and name from a surviving
      // stored profile and redirects to /home, so anything left here
      // silently undoes the sign-out.
      saveActiveProfile({
        access_code: 'ABC123',
        patient_name: 'Tarun',
        disease_stage: 'early',
        avatar: 'male',
      });
      expect(getActiveProfile()).not.toBeNull();

      clearAll();

      expect(getActiveProfile()).toBeNull();
      expect(getProfiles()).toHaveLength(0);
      expect(getAccessCode()).toBeNull();
      expect(getPatientName()).toBeNull();
      expect(window.localStorage.getItem('calmguide_profiles')).toBeNull();
      expect(window.localStorage.getItem('calmguide_active_profile_index')).toBeNull();
    });

    it('clears every profile, not just the active one', () => {
      addProfile({ access_code: 'AAA', patient_name: 'Tarun', disease_stage: 'early' });
      addProfile({ access_code: 'BBB', patient_name: 'Asha', disease_stage: 'late' });

      clearAll();

      expect(getProfiles()).toHaveLength(0);
      expect(getActiveProfile()).toBeNull();
    });
  });

  describe('session expiry', () => {
    const MINUTE = 60 * 1000;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-26T09:00:00Z'));
      consumeSessionExpired();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps a session that is used within the idle window', () => {
      saveActiveProfile({ access_code: 'ABC12345', patient_name: 'Tarun', disease_stage: 'early' });
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS - MINUTE);
      expect(getAccessCode()).toBe('ABC12345');
      expect(consumeSessionExpired()).toBe(false);
    });

    it('signs out after the idle timeout, profiles included', () => {
      saveActiveProfile({ access_code: 'ABC12345', patient_name: 'Tarun', disease_stage: 'early' });
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS + MINUTE);

      expect(getAccessCode()).toBeNull();
      expect(getPatientName()).toBeNull();
      // A surviving profile would let WelcomeGate log straight back in.
      expect(getActiveProfile()).toBeNull();
      expect(consumeSessionExpired()).toBe(true);
      expect(consumeSessionExpired()).toBe(false);
    });

    it('activity restarts the idle timer', () => {
      setAccessCode('ABC12345');
      vi.advanceTimersByTime(20 * MINUTE);
      touchSession();
      vi.advanceTimersByTime(20 * MINUTE);
      expect(getAccessCode()).toBe('ABC12345');
    });

    it('signs out at the absolute limit even when active', () => {
      setAccessCode('ABC12345');
      for (let elapsed = 0; elapsed <= SESSION_MAX_AGE_MS; elapsed += 20 * MINUTE) {
        vi.advanceTimersByTime(20 * MINUTE);
        touchSession();
      }
      expect(getAccessCode()).toBeNull();
    });

    it('treats a session stored before expiry existed as expired', () => {
      window.localStorage.setItem(STORAGE_KEYS.ACCESS_CODE, 'ABC12345');
      window.localStorage.setItem(STORAGE_KEYS.PATIENT_NAME, 'Tarun');
      expect(getAccessCode()).toBeNull();
      expect(consumeSessionExpired()).toBe(true);
    });

    it('keeps device preferences when the session expires', () => {
      setPreferredLanguage('hi');
      setAccessCode('ABC12345');
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS + MINUTE);
      expect(getAccessCode()).toBeNull();
      expect(getPreferredLanguage()).toBe('hi');
    });

    it('sends a timed-out caregiver to login, a new one to setup', () => {
      expect(noSessionRedirectPath()).toBe('/profile/setup');
      setAccessCode('ABC12345');
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS + MINUTE);
      expect(noSessionRedirectPath()).toBe('/login');
      // Stays put after the guard consumes its one-shot flag…
      consumeSessionExpired();
      expect(noSessionRedirectPath()).toBe('/login');
      // …until the caregiver signs back in, or signs out deliberately.
      setAccessCode('ABC12345');
      clearAll();
      expect(noSessionRedirectPath()).toBe('/profile/setup');
    });

    it('does not report expiry when nobody was signed in', () => {
      expect(getAccessCode()).toBeNull();
      expect(consumeSessionExpired()).toBe(false);
    });
  });
});
