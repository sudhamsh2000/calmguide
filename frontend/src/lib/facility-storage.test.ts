import { beforeEach, describe, expect, it } from 'vitest';
import {
  FACILITY_STORAGE_KEYS,
  clearFacilityCode,
  getFacilityCode,
  getFacilityLoginMode,
  getFacilityName,
  setFacilityCode,
  setFacilityLoginMode,
  setFacilityName,
} from './facility-storage';

describe('facility-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores and retrieves the facility login mode', () => {
    setFacilityLoginMode('email');

    expect(getFacilityLoginMode()).toBe('email');
    expect(window.localStorage.getItem(FACILITY_STORAGE_KEYS.FACILITY_LOGIN_MODE)).toBe('email');
  });

  it('ignores invalid facility login modes', () => {
    window.localStorage.setItem(FACILITY_STORAGE_KEYS.FACILITY_LOGIN_MODE, 'pin');

    expect(getFacilityLoginMode()).toBeNull();
  });

  it('clears stored facility identity and login mode together', () => {
    setFacilityCode('ABCD1234');
    setFacilityName('Harbor Memory Care');
    setFacilityLoginMode('staff-select');

    clearFacilityCode();

    expect(getFacilityCode()).toBeNull();
    expect(getFacilityName()).toBeNull();
    expect(getFacilityLoginMode()).toBeNull();
  });
});
