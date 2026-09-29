'use client';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A standard on/off toggle. `label` is required and used as the accessible
 * name (role="switch" + aria-checked) rather than shown as visible text —
 * callers that also want the label displayed render their own <span> next to
 * this, matching how ThemeToggle's callers already do it.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-primary' : 'bg-[var(--color-border-strong)]'
      } ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full shadow transition-transform ${
          checked ? 'translate-x-6 bg-onPrimary' : 'translate-x-1 bg-white'
        }`}
      />
    </button>
  );
}
