import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { clearFacilitySession } from '../lib/facility-storage';
import { refreshToken } from '../lib/facility-api';

const SESSION_TIMEOUT_MS = 90_000;

export function useFacilitySessionGuard(timeoutMs = SESSION_TIMEOUT_MS) {
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());

  const recordActivity = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > timeoutMs) {
        await clearFacilitySession();
        router.replace('/facility/login');
      } else {
        try {
          await refreshToken();
        } catch {
          await clearFacilitySession();
          router.replace('/facility/login');
        }
      }
    }, 60_000);

    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        if (Date.now() - lastActivityRef.current > timeoutMs) {
          await clearFacilitySession();
          router.replace('/facility/login');
        } else {
          lastActivityRef.current = Date.now();
        }
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [router, timeoutMs]);

  return { recordActivity };
}
