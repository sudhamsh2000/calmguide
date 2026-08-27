import { useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  /** Best-effort "can this device currently reach the internet?" signal.
   * `null` until the first NetInfo event arrives (module init is async). We
   * treat null as "assume online" everywhere it's consumed, so the app
   * never shows an incorrect offline banner on cold start. */
  isOnline: boolean | null;
  /** True only on the transition from offline -> online, for one render —
   * callers (e.g. a "back online" toast) can watch this without keeping
   * their own previous-value bookkeeping. */
  justReconnected: boolean;
}

function deriveIsOnline(state: NetInfoState): boolean {
  // isInternetReachable can be null while NetInfo is still probing — fall
  // back to isConnected (link-layer state) rather than treating "unknown"
  // as offline, which would false-positive on every cold start.
  if (state.isInternetReachable === false) return false;
  return state.isConnected !== false;
}

/**
 * Tracks device connectivity via NetInfo. Scaffolding for degraded-mode UX
 * (P2-12): callers use this to show an offline banner and to decide whether
 * a failed request was "you're offline" vs. "the server had a problem" —
 * distinct error copy matters for a caregiver mid-crisis who needs to know
 * whether retrying is even worth it right now.
 *
 * This is connectivity detection only — it does not queue or retry failed
 * requests itself. See docs/DEFERRED.md for what's still out of scope
 * (request queueing, background sync, offline read caching).
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const handle = (state: NetInfoState) => {
      const online = deriveIsOnline(state);
      if (wasOnlineRef.current === false && online) {
        setJustReconnected(true);
      } else if (online) {
        setJustReconnected(false);
      }
      wasOnlineRef.current = online;
      setIsOnline(online);
    };

    NetInfo.fetch().then(handle);
    const unsubscribe = NetInfo.addEventListener(handle);
    return unsubscribe;
  }, []);

  return { isOnline, justReconnected };
}
