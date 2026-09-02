'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFacility } from '@/context/FacilityContext';
import type { StaffRole } from '@/lib/facility-api';

export function useRequireRole(...roles: StaffRole[]): {
  allowed: boolean;
  loading: boolean;
} {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? 'en';
  const { state, isRole } = useFacility();

  const authenticated = state.authenticated;
  const hasRole = authenticated && isRole(...roles);

  useEffect(() => {
    if (!authenticated) return;
    if (!hasRole) {
      router.replace(`/${locale}/facility/residents`);
    }
  }, [authenticated, hasRole, router, locale]);

  return {
    allowed: hasRole,
    loading: !authenticated,
  };
}
