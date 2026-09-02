import { describe, expect, it } from 'vitest';
import { resolvePageBrandHref } from './pageBrandTarget';

describe('resolvePageBrandHref', () => {
  it('routes facility staff to residents from facility pages', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US/facility/residents',
        caregiverAccessCode: null,
        caregiverPatientName: null,
        caregiverActiveProfile: null,
        facilityAuthenticated: true,
        facilityStaffRole: 'staff',
      }),
    ).toBe('/facility/residents');
  });

  it('routes facility admins to dashboard from non-facility pages when no caregiver session exists', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US/terms',
        caregiverAccessCode: null,
        caregiverPatientName: null,
        caregiverActiveProfile: null,
        facilityAuthenticated: true,
        facilityStaffRole: 'admin',
      }),
    ).toBe('/facility/dashboard');
  });

  it('keeps facility login as the fallback for unauthenticated facility routes', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US/facility/login',
        caregiverAccessCode: 'ABCD1234',
        caregiverPatientName: 'Margaret',
        caregiverActiveProfile: null,
        facilityAuthenticated: false,
        facilityStaffRole: null,
      }),
    ).toBe('/facility/login');
  });

  it('routes fully restored caregiver sessions to home', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US/login',
        caregiverAccessCode: 'ABCD1234',
        caregiverPatientName: 'Margaret',
        caregiverActiveProfile: null,
        facilityAuthenticated: false,
        facilityStaffRole: null,
      }),
    ).toBe('/home');
  });

  it('routes partial caregiver sessions to access-code login', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US',
        caregiverAccessCode: 'ABCD1234',
        caregiverPatientName: null,
        caregiverActiveProfile: null,
        facilityAuthenticated: false,
        facilityStaffRole: null,
      }),
    ).toBe('/login');
  });

  it('routes remembered multi-profile caregivers to home', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US',
        caregiverAccessCode: null,
        caregiverPatientName: null,
        caregiverActiveProfile: {
          access_code: 'ABCD1234',
          patient_name: 'Margaret',
          disease_stage: 'middle',
        },
        facilityAuthenticated: false,
        facilityStaffRole: null,
      }),
    ).toBe('/home');
  });

  it('falls back to the welcome page for new users', () => {
    expect(
      resolvePageBrandHref({
        pathname: '/en-US',
        caregiverAccessCode: null,
        caregiverPatientName: null,
        caregiverActiveProfile: null,
        facilityAuthenticated: false,
        facilityStaffRole: null,
      }),
    ).toBe('/');
  });
});
