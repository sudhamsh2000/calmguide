'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { consumeSessionExpired, touchSession } from '@/lib/storage';

/** How often to re-check while the tab stays open but untouched. */
const CHECK_INTERVAL_MS = 60 * 1000;
/** Activity writes are throttled; the idle limit is minutes, not seconds. */
const TOUCH_THROTTLE_MS = 15 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Signs the caregiver out after inactivity (see SESSION_IDLE_TIMEOUT_MS).
 *
 * The expiry itself is enforced in storage on every session read; this
 * component only keeps the idle timer fed while someone is using the app,
 * and sends them to the access-code screen once a stale session is cleared —
 * on reopen, on returning to the tab, or while it sits idle in the
 * foreground. Renders nothing.
 */
export function SessionExpiryGuard() {
  const router = useRouter();

  useEffect(() => {
    let lastTouch = 0;

    const check = () => {
      if (consumeSessionExpired()) router.replace('/login');
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch < TOUCH_THROTTLE_MS) return;
      lastTouch = now;
      touchSession(now);
      check();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
