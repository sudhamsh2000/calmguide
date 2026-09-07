'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { StaffSelector } from '@/components/facility/StaffSelector';
import { PinPad } from '@/components/facility/PinPad';
import { BackButton } from '@/components/ui/BackButton';
import { useFacility } from '@/context/FacilityContext';
import {
  getActiveStaff,
  verifyFacilityCode,
  pinLogin,
  emailLogin,
  FacilityApiError,
} from '@/lib/facility-api';
import type { StaffListItem } from '@/lib/facility-api';
import {
  clearFacilityCode,
  getFacilityCode,
  getFacilityLoginMode,
  getFacilityName,
  setFacilityCode,
  setFacilityLoginMode,
  setFacilityName as storeFacilityName,
} from '@/lib/facility-storage';

type LoginMode = 'staff-select' | 'pin' | 'email' | 'facility-code';
type RestorableLoginMode = Exclude<LoginMode, 'pin'>;

export default function FacilityLoginPage() {
  const t = useTranslations('facility');
  const router = useRouter();
  const { state, dispatch } = useFacility();
  const bootstrappedRef = useRef(false);

  const [mode, setMode] = useState<LoginMode>('facility-code');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [facilityCode, setFacilityCodeLocal] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffListItem | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pinLocked, setPinLocked] = useState(false);

  const setRestorableMode = useCallback((nextMode: RestorableLoginMode) => {
    setFacilityLoginMode(nextMode);
    setMode(nextMode);
  }, []);

  const loadFacilityStaff = useCallback(
    async (code: string, options?: { optimisticStaffSelect?: boolean }) => {
      const optimisticStaffSelect = options?.optimisticStaffSelect ?? false;
      setStaffLoading(true);
      setCodeError(null);
      try {
        const [facilityData, staffData] = await Promise.all([
          verifyFacilityCode(code),
          getActiveStaff(code),
        ]);
        setFacilityName(facilityData.name);
        setStaffList(staffData.staff);
        setFacilityCode(code);
        storeFacilityName(facilityData.name);
        dispatch({
          type: 'SET_FACILITY',
          payload: { facilityCode: code, facilityName: facilityData.name },
        });
        setRestorableMode('staff-select');
      } catch (err) {
        if (optimisticStaffSelect) {
          setRestorableMode('facility-code');
        }
        if (err instanceof FacilityApiError && err.status === 404) {
          setCodeError(
            'Facility code not recognized. Double-check the code on your welcome sheet.',
          );
        } else {
          setCodeError('Could not reach the server. Check your connection and try again.');
        }
      } finally {
        setStaffLoading(false);
      }
    },
    [dispatch],
  );

  // Check if facility code already stored
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const storedCode = state.facilityCode ?? getFacilityCode();
    const storedName = state.facilityName ?? getFacilityName() ?? '';
    const storedMode = getFacilityLoginMode();

    if (storedMode === 'email') {
      setFacilityCodeLocal(storedCode ?? '');
      if (storedName) {
        setFacilityName(storedName);
      }
      setRestorableMode('email');
      setIsBootstrapping(false);
      return;
    }

    if (!storedCode) {
      setRestorableMode('facility-code');
      setIsBootstrapping(false);
      return;
    }

    setFacilityCodeLocal(storedCode);
    if (storedName) {
      setFacilityName(storedName);
    }
    setRestorableMode('staff-select');
    setStaffLoading(true);
    setIsBootstrapping(false);
    void loadFacilityStaff(storedCode, { optimisticStaffSelect: true });
  }, [loadFacilityStaff, setRestorableMode, state.facilityCode, state.facilityName]);

  // Redirect on successful auth
  useEffect(() => {
    if (state.authenticated && state.staff) {
      const role = state.staff.role;
      if (role === 'staff') {
        router.push('/facility/residents');
      } else if (role === 'admin') {
        router.push('/facility/dashboard');
      } else {
        router.push('/facility/executive');
      }
    }
  }, [state.authenticated, state.staff, router]);

  const handleCodeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const code = facilityCode.trim().toUpperCase();
      if (code.length !== 8) {
        setCodeError('Facility code must be 8 characters.');
        return;
      }
      loadFacilityStaff(code);
    },
    [facilityCode, loadFacilityStaff],
  );

  const handleStaffSelect = useCallback((staff: StaffListItem) => {
    setSelectedStaff(staff);
    setPinError(null);
    setPinLocked(false);
    setMode('pin');
  }, []);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (!selectedStaff) return;
      dispatch({ type: 'LOGIN_START' });
      setPinError(null);
      try {
        const data = await pinLogin(facilityCode, selectedStaff.id, pin);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            staff: data.staff,
            facilityCode,
            facilityName,
          },
        });
      } catch (err) {
        if (err instanceof FacilityApiError) {
          const body = err.body as Record<string, string> | undefined;
          if (body?.code === 'ACCOUNT_LOCKED') {
            setPinLocked(true);
            setPinError(
              'PIN locked after too many attempts. Contact your charge nurse to reset, or wait 30 minutes.',
            );
          } else {
            setPinError(t('login.incorrect_pin'));
          }
        } else {
          setPinError(t('login.incorrect_pin'));
        }
        dispatch({ type: 'LOGIN_ERROR', payload: 'PIN login failed' });
      }
    },
    [selectedStaff, facilityCode, facilityName, dispatch, t],
  );

  const handleEmailLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ type: 'LOGIN_START' });
      setEmailError(null);
      try {
        const data = await emailLogin(email, password);
        // Admin/owner email login never learns the facility's plaintext code
        // (facility codes are stored one-way-hashed, so the backend can't
        // hand it back either). When we don't already have the real code —
        // e.g. this admin went straight to email login without ever typing
        // one — fall back to the "me" sentinel, which facility-scoped
        // endpoints resolve from the authenticated JWT instead of the code.
        // Do NOT default to a fabricated real-looking code here: previously
        // this fell back to the literal string 'admin', which silently
        // pointed every facility-scoped request (staff list, staff create,
        // settings, etc.) at a facility that doesn't exist.
        const resolvedFacilityCode = facilityCode || 'me';
        setFacilityCode(resolvedFacilityCode);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            staff: data.staff,
            facilityCode: resolvedFacilityCode,
            facilityName: facilityName || 'Facility',
          },
        });
      } catch (err) {
        if (err instanceof FacilityApiError) {
          const body = err.body as Record<string, string> | undefined;
          if (body?.code === 'ACCOUNT_LOCKED') {
            setEmailError(t('login.account_locked'));
          } else {
            setEmailError('Invalid email or password.');
          }
        } else {
          setEmailError('Could not reach the server. Check your connection and try again.');
        }
        dispatch({ type: 'LOGIN_ERROR', payload: 'Email login failed' });
      }
    },
    [email, password, facilityCode, facilityName, dispatch, t],
  );

  const handleBackToStaffSelect = useCallback(() => {
    setSelectedStaff(null);
    setPinError(null);
    setPinLocked(false);
    setRestorableMode('staff-select');
  }, [setRestorableMode]);

  const handleShowEmailLogin = useCallback(() => {
    setSelectedStaff(null);
    setPinError(null);
    setPinLocked(false);
    setCodeError(null);
    setEmailError(null);
    setRestorableMode('email');
  }, [setRestorableMode]);

  const handleChangeFacility = useCallback(() => {
    clearFacilityCode();
    dispatch({ type: 'CLEAR_FACILITY' });
    setSelectedStaff(null);
    setStaffList([]);
    setFacilityCodeLocal('');
    setFacilityName('');
    setCodeError(null);
    setEmailError(null);
    setPinError(null);
    setPinLocked(false);
    setRestorableMode('facility-code');
  }, [dispatch, setRestorableMode]);

  const handleBackToStaffLogin = useCallback(() => {
    setEmailError(null);
    setSelectedStaff(null);
    setPinError(null);
    setPinLocked(false);

    if (!facilityCode) {
      setRestorableMode('facility-code');
      return;
    }

    setRestorableMode('staff-select');
    if (staffList.length === 0 && !staffLoading) {
      void loadFacilityStaff(facilityCode, { optimisticStaffSelect: true });
    }
  }, [facilityCode, loadFacilityStaff, setRestorableMode, staffList.length, staffLoading]);

  if (isBootstrapping) {
    return (
      <main className="flex flex-col items-center justify-center h-full px-4 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center h-full overflow-y-auto px-4 pt-4 pb-24 sm:px-5 sm:pt-8 sm:pb-8">
      <div className="mb-4 flex w-full items-center gap-3">
        <BackButton href="/" label="Back to welcome" />
        <h1
          className="text-xl font-medium text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Facility Login
        </h1>
      </div>

      {/* Facility header */}
      {facilityName && (
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-foreground-muted">{facilityName}</p>
        </div>
      )}

      {/* Facility code entry */}
      {mode === 'facility-code' && (
        <form onSubmit={handleCodeSubmit} className="w-full max-w-sm flex flex-col gap-4">
          <div>
            <label
              htmlFor="facility-code"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Facility Code
            </label>
            <input
              id="facility-code"
              type="text"
              value={facilityCode}
              onChange={(e) => {
                setFacilityCodeLocal(e.target.value.toUpperCase());
                setCodeError(null);
              }}
              maxLength={8}
              placeholder="ABCD1234"
              className="field-shell w-full h-14 px-4 text-center text-lg font-mono tracking-widest"
              autoFocus
              autoComplete="off"
            />
          </div>
          {codeError && (
            <p className="text-sm text-error" role="alert">
              {codeError}
            </p>
          )}
          <button
            type="submit"
            disabled={facilityCode.length !== 8 || staffLoading}
            className="h-12 rounded-xl bg-primary text-white font-semibold text-lg disabled:opacity-40 hover:bg-primary-light active:bg-primary-dark transition-colors"
          >
            {staffLoading ? 'Connecting...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleShowEmailLogin}
            className="text-sm text-primary hover:underline mt-2"
          >
            Admin / DON login with email
          </button>
        </form>
      )}

      {/* Staff selection grid — only show staff role (CNAs), not admin/owner */}
      {mode === 'staff-select' && (
        <div className="w-full">
          <StaffSelector
            staff={staffList.filter((s) => s.role === 'staff')}
            selectedId={null}
            onSelect={handleStaffSelect}
            loading={staffLoading}
          />
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleChangeFacility}
              className="text-sm text-foreground-muted hover:text-foreground hover:underline"
            >
              Change facility
            </button>
            <span className="mx-2 text-foreground-muted/40">·</span>
            <button
              type="button"
              onClick={handleShowEmailLogin}
              className="text-sm text-primary hover:underline"
            >
              Admin login
            </button>
          </div>
        </div>
      )}

      {/* PIN entry */}
      {mode === 'pin' && selectedStaff && (
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">Hello, {selectedStaff.name}</h2>
          <p className="text-sm text-foreground-muted">Enter your PIN</p>
          <div className="mt-4 w-full">
            <PinPad
              onComplete={handlePinComplete}
              error={pinError}
              disabled={state.loading}
              lockout={{ locked: pinLocked }}
              onBackToStaffSelect={handleBackToStaffSelect}
            />
          </div>
          <button
            type="button"
            onClick={handleBackToStaffSelect}
            className="mt-4 text-sm text-foreground-muted hover:text-foreground hover:underline"
          >
            Not {selectedStaff.name.split(' ')[0]}? Switch
          </button>
        </div>
      )}

      {/* Email / password login */}
      {mode === 'email' && (
        <form onSubmit={handleEmailLogin} className="w-full max-w-sm flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-foreground text-start">Admin Login</h2>
          <div>
            <label
              htmlFor="admin-email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@facility.com"
              className="field-shell w-full h-12 px-4 text-base"
              autoFocus
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-shell w-full h-12 px-4 text-base"
              autoComplete="current-password"
            />
          </div>
          {emailError && (
            <p className="text-sm text-error" role="alert">
              {emailError}
            </p>
          )}
          <button
            type="submit"
            disabled={!email || !password || state.loading}
            className="h-12 rounded-xl bg-primary text-white font-semibold text-lg disabled:opacity-40 hover:bg-primary-light active:bg-primary-dark transition-colors"
          >
            {state.loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={handleBackToStaffLogin}
            className="text-sm text-primary hover:underline mt-2"
          >
            Back to staff login
          </button>
        </form>
      )}
    </main>
  );
}
