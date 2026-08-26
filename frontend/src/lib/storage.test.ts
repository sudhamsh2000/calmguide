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
});
