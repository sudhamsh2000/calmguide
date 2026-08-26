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

  const tagLabel = (key: string) => tc.has(key) ? tc(key) : key;

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-surface px-4 py-3 text-sm text-primary animate-fade-in-up">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const TIME_SLOTS = ['overnight', 'morning', 'afternoon', 'evening'] as const;

  const severityStyles = {
    calm: { active: 'bg-primary/15 text-primary ring-1 ring-primary', label: t('severity_calm') },
    mild: { active: 'bg-primary/15 text-primary ring-1 ring-primary', label: t('severity_mild') },
    tough: { active: 'bg-primary/15 text-primary ring-1 ring-primary', label: t('severity_tough') },
  };

  return (
    <div className="rounded-2xl border border-foreground/10 bg-surface p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>

      <div className="flex gap-2">
        {(['calm', 'mild', 'tough'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => handleSeverity(s)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
              severity === s ? severityStyles[s].active : 'bg-background text-foreground-muted border border-foreground/10'
            }`}
          >
            {severityStyles[s].label}
          </button>
        ))}
      </div>

      {severity && severity !== 'calm' && (
        <>
          <div className="space-y-1.5">
            <p className="text-xs text-foreground-muted">{t('when')}</p>
            <div className="flex gap-1.5">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeSlot(slot)}
                  className={`flex-1 rounded-lg py-1.5 text-xs transition-colors ${
                    timeSlot === slot
                      ? 'bg-primary/15 text-primary ring-1 ring-primary'
                      : 'bg-background text-foreground-muted border border-foreground/10'
                  }`}
                >
                  {t(`time_${slot}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-foreground-muted">{t('what_helped')}</p>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'card-shell-selected text-primary'
                      : 'card-shell bg-background text-foreground-muted'
                  }`}
                >
                  {tagLabel(tag)}{selectedTags.includes(tag) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDone}
            className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors min-h-[44px]"
          >
            {t('done')}
          </button>
        </>
      )}
    </div>
  );
}
