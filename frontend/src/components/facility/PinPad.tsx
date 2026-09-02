'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

interface PinPadLockout {
  locked: boolean;
  unlockAt?: string;
}

interface PinPadProps {
  onComplete: (pin: string) => void;
  error?: string | null;
  disabled?: boolean;
  lockout?: PinPadLockout;
  onBackToStaffSelect?: () => void;
  className?: string;
}

const PIN_LENGTH = 4;

export function PinPad({
  onComplete,
  error,
  disabled = false,
  lockout,
  onBackToStaffSelect,
  className = '',
}: PinPadProps) {
  const t = useTranslations('facility.login');
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  const isLocked = lockout?.locked || (error && error.toLowerCase().includes('locked'));

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled) return;
      const next = [...digits, digit];
      setDigits(next);
      if (next.length === PIN_LENGTH) {
        onComplete(next.join(''));
        setTimeout(() => setDigits([]), 300);
      }
    },
    [digits, disabled, onComplete],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [disabled]);

  // Trigger shake on error change
  const triggerShake = useCallback(() => {
    setShake(true);
    setDigits([]);
    setTimeout(() => setShake(false), 500);
  }, []);

  // Reset when error changes
  if (error && !shake && digits.length === 0) {
    triggerShake();
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'back'],
  ];

  if (isLocked) {
    return (
      <div className={`flex flex-col items-center gap-4 py-8 ${className}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-12 text-error"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3 className="text-lg font-bold text-foreground">Account temporarily locked</h3>
        <p className="text-sm text-foreground-muted text-center max-w-xs">
          {error || 'Contact your charge nurse to reset, or wait 30 minutes.'}
        </p>
        {onBackToStaffSelect && (
          <button
            type="button"
            onClick={onBackToStaffSelect}
            className="outline-button mt-2 h-12 rounded-xl px-6 text-base font-medium"
          >
            Back to staff selection
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      {/* Dot indicators */}
      <div
        className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}
        role="status"
        aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <div
            key={i}
            className={`size-4 rounded-full border-2 transition-colors ${
              i < digits.length
                ? 'bg-primary border-primary'
                : 'border-foreground/20 dark:border-white/12 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-error font-medium" role="alert">
          {error}
        </p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4">
        {keys.flat().map((key, i) => {
          if (key === '') {
            return <div key={i} className="size-20" />;
          }
          if (key === 'back') {
            return (
              <button
                key={i}
                type="button"
                onClick={handleBackspace}
                disabled={disabled || digits.length === 0}
                className="size-20 flex items-center justify-center rounded-2xl text-foreground/70 border border-transparent hover:border-foreground/10 hover:bg-foreground/5 active:bg-foreground/10 disabled:opacity-30 transition-colors dark:hover:border-white/10"
                aria-label="Backspace"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-7"
                >
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDigit(key)}
              disabled={disabled}
              className="size-20 flex items-center justify-center rounded-2xl bg-surface border border-slate-300 text-3xl font-semibold text-foreground shadow-[0_1px_2px_rgba(23,37,42,0.05)] hover:border-slate-400 hover:bg-foreground/[0.03] active:bg-foreground/10 disabled:opacity-30 transition-colors select-none dark:border-[#31445f] dark:shadow-[0_1px_2px_rgba(0,0,0,0.18)] dark:hover:border-[#3a4f6d] dark:hover:bg-white/[0.04]"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
