'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getFacilityToken, getStoredStaff } from '@/lib/facility-storage';
import { getAccessCode, getActiveProfile, getPatientName } from '@/lib/storage';
import { resolvePageBrandHref } from './pageBrandTarget';

export interface PageBrandProps {
  className?: string;
}

export function PageBrand({ className = '' }: PageBrandProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [href, setHref] = useState('/');

  useEffect(() => {
    setMounted(true);
    const storedStaff = getStoredStaff();
    const facilityToken = getFacilityToken();

    setHref(resolvePageBrandHref({
      pathname: pathname ?? '/',
      caregiverAccessCode: getAccessCode(),
      caregiverPatientName: getPatientName(),
      caregiverActiveProfile: getActiveProfile(),
      facilityAuthenticated: Boolean(facilityToken && storedStaff),
      facilityStaffRole: facilityToken && storedStaff ? storedStaff.role : null,
    }));
  }, [pathname]);

  if (!mounted) {
    return (
      <div className={` ${className}`}>
        <span
          className="text-base font-bold tracking-tight text-primary"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Calm<span className="font-light">Guide</span>
        </span>
      </div>
    );
  }

  return (
    <div className={` ${className}`}>
      <Link
        href={href}
        className="text-base font-bold tracking-tight text-primary hover:text-primary-light transition-colors"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Calm<span className="font-light">Guide</span>
      </Link>
    </div>
  );
}
