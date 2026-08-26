'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  getAccessCode,
  getActiveProfile,
  getPatientName,
  setAccessCode,
  setPatientName,
} from '@/lib/storage';

interface WelcomeGateProps {
  children: ReactNode;
}

export function WelcomeGate({ children }: WelcomeGateProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedCode = getAccessCode();
    const storedName = getPatientName();

    if (storedCode && storedName) {
      router.replace('/home');
      return;
    }

    if (storedCode && !storedName) {
      router.replace('/login');
      return;
    }

    const activeProfile = getActiveProfile();
    if (activeProfile) {
      setAccessCode(activeProfile.access_code);
      setPatientName(activeProfile.patient_name);
      router.replace('/home');
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  return <>{children}</>;
}
