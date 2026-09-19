import { describe, it, expect, beforeEach } from 'vitest';
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
});
