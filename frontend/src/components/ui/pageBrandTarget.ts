import type { StoredProfile } from '@/lib/storage';
import type { StaffRole } from '@/lib/facility-api';

interface ResolvePageBrandHrefArgs {
  pathname: string;
  caregiverAccessCode: string | null;
  caregiverPatientName: string | null;
  caregiverActiveProfile: StoredProfile | null;
  facilityAuthenticated: boolean;
  facilityStaffRole: StaffRole | null;
}

function resolveFacilityHome(role: StaffRole | null): string {
  if (role === 'staff') return '/facility/residents';
  if (role === 'admin') return '/facility/dashboard';
  if (role === 'owner') return '/facility/executive';
  return '/facility/login';
}

export function resolvePageBrandHref({
  pathname,
  caregiverAccessCode,
  caregiverPatientName,
  caregiverActiveProfile,
  facilityAuthenticated,
  facilityStaffRole,
}: ResolvePageBrandHrefArgs): string {
  const isFacilityPath = pathname.includes('/facility');

  if (isFacilityPath) {
    return facilityAuthenticated ? resolveFacilityHome(facilityStaffRole) : '/facility/login';
  }

  if (caregiverAccessCode && caregiverPatientName) {
    return '/home';
  }

  if (caregiverAccessCode) {
    return '/login';
  }

  if (caregiverActiveProfile) {
    return '/home';
  }

  if (facilityAuthenticated) {
    return resolveFacilityHome(facilityStaffRole);
  }

  return '/';
}
