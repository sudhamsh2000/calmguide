"use client";

import { useEffect, useRef, useState } from "react";

export interface NetworkStatus {
  /** Best-effort "can this device currently reach the internet?" signal.
   * `null` until mounted (SSR has no `navigator`) — treated as "assume
   * online" everywhere it's consumed, mirroring mobile/src/lib/network.ts,
   * so the app never shows an incorrect offline banner on first paint. */
  isOnline: boolean | null;
  /** True only on the transition from offline -> online, for one render —
   * callers (e.g. a "back online" toast) can watch this without keeping
   * their own previous-value bookkeeping. */
  justReconnected: boolean;
}

/**
 * Tracks browser connectivity via the `online`/`offline` window events and
 * `navigator.onLine`. Web equivalent of mobile/src/lib/network.ts's
 * useNetworkStatus (P2-12 degraded-mode scaffolding): callers use this to
 * show an offline banner and to decide whether a failed request was
 * "you're offline" vs. "the server had a problem" — distinct error copy
 * matters for a caregiver mid-crisis who needs to know whether retrying is
 * even worth it right now.
 *
 * `navigator.onLine` is link-layer only (true even when connected to a
 * router with no internet), so — like the mobile version — this is a
 * best-effort signal, not a guarantee of reachability. It intentionally
 * does not probe the backend to confirm actual reachability.
 *
 * This is connectivity detection only — it does not queue or retry failed
 * requests itself. See docs/DEFERRED.md for what's still out of scope.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const handle = (online: boolean) => {
      if (wasOnlineRef.current === false && online) {
        setJustReconnected(true);
      } else if (online) {
        setJustReconnected(false);
      }
      wasOnlineRef.current = online;
      setIsOnline(online);
    };

    handle(navigator.onLine);

    const onOnline = () => handle(true);
    const onOffline = () => handle(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { isOnline, justReconnected };
}
