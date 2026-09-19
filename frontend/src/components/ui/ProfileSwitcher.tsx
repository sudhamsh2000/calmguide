'use client';

import { useState } from 'react';
import {
  getProfiles,
  getActiveProfileIndex,
  switchProfile,
  type StoredProfile,
} from '@/lib/storage';
import { ProfileAvatar } from './ProfileAvatar';

export interface ProfileSwitcherProps {
  onSwitch: () => void;
  className?: string;
}

export function ProfileSwitcher({ onSwitch, className = '' }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const profiles = getProfiles();
  const activeIndex = getActiveProfileIndex();

  if (profiles.length <= 1) return null;

  const active = profiles[activeIndex];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 min-h-[44px] transition-colors hover:border-primary/40 focus-ring"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{ textAlign: 'start' }}
      >
        <ProfileAvatar
          name={active?.patient_name ?? '?'}
          avatar={active?.avatar}
          diseaseStage={active?.disease_stage}
          size={32}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground truncate">
            {active?.patient_name ?? 'Unknown'}
          </span>
          <span className="block text-xs text-foreground-muted capitalize">
            {active?.disease_stage ?? ''} stage
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-foreground-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-border bg-surface shadow-lg"
          role="listbox"
        >
          {profiles.map((profile, index) => (
            <button
              key={profile.access_code}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => {
                switchProfile(index);
                setOpen(false);
                onSwitch();
              }}
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-3 min-h-[44px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                index === activeIndex ? 'bg-accentSky-soft' : 'hover:bg-primary-soft'
              }`}
              style={{ textAlign: 'start' }}
            >
              <ProfileAvatar
                name={profile.patient_name}
                avatar={profile.avatar}
                diseaseStage={profile.disease_stage}
                size={32}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">
                  {profile.patient_name}
                </span>
                <span className="block text-xs text-foreground-muted capitalize">
                  {profile.disease_stage} stage
                </span>
              </span>
              {index === activeIndex && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-primary"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
