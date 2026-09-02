'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { StaffInfo, StaffRole } from '@/lib/facility-api';
import { refreshToken, logout as apiLogout } from '@/lib/facility-api';
import {
  getFacilityCode,
  getFacilityName,
  setFacilityName as storeFacilityName,
  getFacilityToken,
  getRawFacilityToken,
  setFacilityToken,
  removeFacilityToken,
  getStoredStaff,
  setStoredStaff,
  clearStoredStaff,
} from '@/lib/facility-storage';

// --- State ---

interface FacilityState {
  staff: StaffInfo | null;
  facilityCode: string | null;
  facilityName: string | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: FacilityState = {
  staff: null,
  facilityCode: null,
  facilityName: null,
  authenticated: false,
  loading: false,
  error: null,
};

function hydrateInitialState(): FacilityState {
  if (typeof window === 'undefined') return initialState;
  const storedStaff = getStoredStaff();
  const token = getRawFacilityToken();
  const code = getFacilityCode();
  const name = getFacilityName();
  if (storedStaff && token) {
    return {
      staff: storedStaff,
      facilityCode: code,
      facilityName: name,
      authenticated: true,
      loading: false,
      error: null,
    };
  }
  return {
    ...initialState,
    facilityCode: code,
    facilityName: name,
  };
}

// --- Actions ---

type FacilityAction =
  | { type: 'LOGIN_START' }
  | {
      type: 'LOGIN_SUCCESS';
      payload: { staff: StaffInfo; facilityCode: string; facilityName: string };
    }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'TOKEN_REFRESHED'; payload: { staff: StaffInfo } }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_FACILITY' }
  | { type: 'SET_FACILITY'; payload: { facilityCode: string; facilityName: string } };

function facilityReducer(state: FacilityState, action: FacilityAction): FacilityState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        staff: action.payload.staff,
        facilityCode: action.payload.facilityCode,
        facilityName: action.payload.facilityName,
        authenticated: true,
        loading: false,
        error: null,
      };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'TOKEN_REFRESHED':
      return { ...state, staff: action.payload.staff };
    case 'LOGOUT':
      return {
        ...initialState,
        facilityCode: state.facilityCode,
        facilityName: state.facilityName,
      };
    case 'CLEAR_FACILITY':
      return { ...state, facilityCode: null, facilityName: null };
    case 'SET_FACILITY':
      return {
        ...state,
        facilityCode: action.payload.facilityCode,
        facilityName: action.payload.facilityName,
      };
    default:
      return state;
  }
}

// --- Context ---

interface FacilityContextValue {
  state: FacilityState;
  dispatch: React.Dispatch<FacilityAction>;
  logout: () => Promise<void>;
  isRole: (...roles: StaffRole[]) => boolean;
}

const FacilityContext = createContext<FacilityContextValue | null>(null);

// --- Provider ---

// 45s — safe margin under the shortest possible session length. PIN-based
// (shared-tablet) logins get a 60s server-side token expiry (session
// isolation between staff sharing a device); password logins get the
// standard 900s. This interval must stay under the shorter of the two.
const TOKEN_REFRESH_INTERVAL = 45_000;
const INACTIVITY_TIMEOUT = 900_000; // 15 minutes — matches the password-login JWT expiry

export function FacilityProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(facilityReducer, undefined, hydrateInitialState);

  const dispatch = useCallback((action: FacilityAction) => {
    if (action.type === 'LOGIN_SUCCESS' && action.payload.staff) {
      setStoredStaff(action.payload.staff);
    } else if (action.type === 'TOKEN_REFRESHED' && action.payload.staff) {
      setStoredStaff(action.payload.staff);
    } else if (action.type === 'LOGOUT') {
      clearStoredStaff();
    }
    rawDispatch(action);
  }, []);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    try {
      await apiLogout();
    } catch {
      removeFacilityToken();
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, [handleLogout]);

  useEffect(() => {
    if (!state.authenticated) return;

    resetInactivityTimer();

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = () => resetInactivityTimer();
    for (const event of events) {
      window.addEventListener(event, handler, { passive: true });
    }

    refreshIntervalRef.current = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        handleLogout();
        return;
      }
      try {
        const data = await refreshToken();
        dispatch({ type: 'TOKEN_REFRESHED', payload: { staff: data.staff } });
      } catch {
        handleLogout();
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handler);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [state.authenticated, handleLogout, resetInactivityTimer]);

  // Background token refresh on mount (state already hydrated via lazy init)
  useEffect(() => {
    if (!state.authenticated) return;

    refreshToken()
      .then((data) => {
        setStoredStaff(data.staff);
        dispatch({
          type: 'TOKEN_REFRESHED',
          payload: { staff: data.staff },
        });
      })
      .catch((err) => {
        const isNetworkError = err instanceof TypeError;
        if (!isNetworkError) {
          removeFacilityToken();
          clearStoredStaff();
          dispatch({ type: 'LOGOUT' });
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRole = useCallback(
    (...roles: StaffRole[]) => {
      if (!state.staff) return false;
      return roles.includes(state.staff.role as StaffRole);
    },
    [state.staff],
  );

  return (
    <FacilityContext.Provider value={{ state, dispatch, logout: handleLogout, isRole }}>
      {children}
    </FacilityContext.Provider>
  );
}

// --- Hook ---

export function useFacility(): FacilityContextValue {
  const context = useContext(FacilityContext);
  if (!context) {
    throw new Error('useFacility must be used within a FacilityProvider');
  }
  return context;
}

export type { FacilityState, FacilityAction };
