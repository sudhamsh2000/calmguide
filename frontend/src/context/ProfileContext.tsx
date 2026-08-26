'use client';

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import type { ProfileResponse } from '@/lib/api';

// --- State ---

interface ProfileState {
  profile: ProfileResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
};

// --- Actions ---

type ProfileAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: ProfileResponse }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'UPDATE_SUCCESS'; payload: ProfileResponse }
  | { type: 'CLEAR' };

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { profile: action.payload, loading: false, error: null };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'UPDATE_SUCCESS':
      return { profile: action.payload, loading: false, error: null };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

// --- Context ---

interface ProfileContextValue {
  state: ProfileState;
  dispatch: React.Dispatch<ProfileAction>;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

// --- Provider ---

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(profileReducer, initialState);

  const clearProfile = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
    <ProfileContext.Provider value={{ state, dispatch, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

// --- Hook ---

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

export type { ProfileState, ProfileAction };
