'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PREDEFINED_TAGS } from '@/lib/api';

interface DailyCheckinCardProps {
  onSubmit: (severity: 'calm' | 'mild' | 'tough', timeSlot?: string, tags?: string[]) => void;
}

export function DailyCheckinCard({ onSubmit }: DailyCheckinCardProps) {
  const t = useTranslations('home.daily_checkin');
  const tc = useTranslations('common.tags');
  const [severity, setSeverity] = useState<'calm' | 'mild' | 'tough' | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const tagLabel = (key: string) => (tc.has(key) ? tc(key) : key);

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-surface px-4 py-3 text-sm text-primary animate-fade-in-up">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {t('thanks')}
      </div>
    );
  }

  const handleSeverity = (s: 'calm' | 'mild' | 'tough') => {
    setSeverity(s);
    if (s === 'calm') {
      onSubmit('calm');
      setSubmitted(true);
    }
  };

  const handleDone = () => {
    if (!severity) return;
    onSubmit(severity, timeSlot ?? undefined, selectedTags.length > 0 ? selectedTags : undefined);
    setSubmitted(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const TIME_SLOTS = ['overnight', 'morning', 'afternoon', 'evening'] as const;

  /* Severity is presented as three icon cards, echoing the Daily Check-In
   * reference's mood selector. The reference draws five faces; the app records
   * three levels (calm / mild / tough) and adding levels would mean changing
   * what's persisted, so the visual treatment is adopted without inventing
   * options that the backend can't store. Icons read faster than text alone
   * under stress, and the label stays visible for clarity and screen readers. */
  const SEVERITY_OPTIONS = [
    {
      id: 'calm' as const,
      label: t('severity_calm'),
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.2c1.2 1.1 5.8 1.1 7 0" />
          <path d="M9.2 9.8h.01M14.8 9.8h.01" />
        </>
      ),
    },
    {
      id: 'mild' as const,
      label: t('severity_mild'),
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5h7" />
          <path d="M9.2 9.8h.01M14.8 9.8h.01" />
        </>
      ),
    },
    {
      id: 'tough' as const,
      label: t('severity_tough'),
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 15.5c1.2-1.2 5.8-1.2 7 0" />
          <path d="M9.2 9.8h.01M14.8 9.8h.01" />
        </>
      ),
    },
  ];

  const chipBase =
    'min-h-tap rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-ring';
  const chipOn = 'bg-primary text-white';
  const chipOff = 'card-shell bg-background text-foreground hover:border-primary/30';

  return (
    <div className="card-shell p-5 space-y-4">
      <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>

      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label={t('title')}>
        {SEVERITY_OPTIONS.map((opt) => {
          const isOn = severity === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={isOn}
              onClick={() => handleSeverity(opt.id)}
              className={`focus-ring flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-sm font-medium transition-colors ${
                isOn
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-theme-soft bg-background text-foreground hover:border-primary/30'
              }`}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {opt.icon}
              </svg>
              <span className="leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {severity && severity !== 'calm' && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t('when')}</p>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label={t('when')}
            >
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={timeSlot === slot}
                  onClick={() => setTimeSlot(slot)}
                  className={`${chipBase} ${timeSlot === slot ? chipOn : chipOff}`}
                >
                  {t(`time_${slot}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t('what_helped')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('what_helped')}>
              {PREDEFINED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selectedTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                  className={`${chipBase} ${selectedTags.includes(tag) ? chipOn : chipOff}`}
                >
                  {tagLabel(tag)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDone}
            className="focus-ring min-h-tap w-full rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-light active:bg-primary-dark"
          >
            {t('done')}
          </button>
        </>
      )}
    </div>
  );
}
