'use client';

import { useEffect } from 'react';

/**
 * `data-landing` is set on <html> before hydration by the beforeInteractive
 * script in [locale]/layout.tsx, purely to avoid a flash of app-shell chrome
 * on first paint. That script only runs once and never re-fires on
 * client-side navigations (e.g. the locale switcher's router.replace, or any
 * <Link> transition) — so without this, switching language or navigating
 * back to the landing page client-side leaves the attribute missing, and the
 * app shell's hidden header/footer + constrained width reappear on top of
 * the landing page. This mirrors the same effect-based pattern already used
 * for `data-facility` (see FacilityModeShell.tsx).
 */
export function LandingChromeSync() {
  useEffect(() => {
    document.documentElement.setAttribute('data-landing', '');
    return () => {
      document.documentElement.removeAttribute('data-landing');
    };
  }, []);

  return null;
}
