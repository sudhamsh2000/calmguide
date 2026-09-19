'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { NEGATIVE_REASON_TAGS, PREDEFINED_TAGS } from '@/lib/api';
import type { FeedbackEntry } from '@/lib/api';

interface FeedbackWidgetProps {
  conversationId: string;
  suggestedTags: string[];
  existingFeedback: FeedbackEntry | null;
  onSubmit: (helpful: boolean, tags: string[], negativeReasons: string[]) => void;
  source: 'home' | 'conversation';
  embedded?: boolean;
}

export function FeedbackWidget({
  conversationId,
  suggestedTags,
  existingFeedback,
  onSubmit,
  source,
  embedded = false,
}: FeedbackWidgetProps) {
  const t = useTranslations('home.feedback');
  const tc = useTranslations('common.tags');
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const tagLabel = (key: string) => (tc.has(key) ? tc(key) : key);

  if (existingFeedback) {
    return (
      <div className="card-shell flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          {t('you_rated')}
          {existingFeedback.helpful ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
              aria-hidden="true"
            >
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-error"
              aria-hidden="true"
            >
              <path d="M17 14V2" />
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
            </svg>
          )}
        </span>
        {existingFeedback.tags.length > 0 && (
          <span className="text-foreground-muted">
            · {existingFeedback.tags.map((tag) => tagLabel(tag)).join(', ')}
          </span>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-primary animate-fade-in-up">
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  const handleThumbsUp = () => {
    setHelpful(true);
    setSelectedReasons([]);
  };

  const handleThumbsDown = () => {
    setHelpful(false);
    setSelectedTags([]);
  };

  const handleDone = () => {
    if (helpful === null) return;
    onSubmit(helpful, selectedTags, selectedReasons);
    setSubmitted(true);
  };

  return (
    <div className={embedded ? 'space-y-2' : 'card-shell rounded-xl p-3 space-y-2'}>
      <div className="flex items-center gap-1.5 flex-nowrap">
        <span className="text-sm text-foreground whitespace-nowrap">{t('did_this_help')}</span>
        <div className="inline-flex items-center shrink-0">
          <button
            type="button"
            onClick={handleThumbsUp}
            className={`min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full transition-all ${
              helpful === true
                ? 'bg-primary/15 text-primary'
                : 'text-foreground-muted hover:bg-primary/5 hover:text-primary'
            }`}
            aria-label="Helpful"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleThumbsDown}
            className={`min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full transition-all ${
              helpful === false
                ? 'bg-error/15 text-error'
                : 'text-foreground-muted hover:bg-error/5 hover:text-error'
            }`}
            aria-label="Not helpful"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 14V2" />
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
            </svg>
          </button>
        </div>
      </div>

      {helpful === true && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground-muted">
            {t('what_worked')} <span className="text-foreground-muted/60">({t('tap_any')})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(suggestedTags.length > 0 ? suggestedTags : [...PREDEFINED_TAGS]).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'card-shell-selected text-primary'
                    : 'card-shell bg-background text-foreground-muted hover:border-primary/20 hover:bg-primary/[0.025] dark:hover:border-primary/25 dark:hover:bg-primary/[0.05]'
                }`}
              >
                {tagLabel(tag)}
                {selectedTags.includes(tag) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {helpful === false && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground-muted">
            {t('what_went_wrong')}{' '}
            <span className="text-foreground-muted/60">({t('tap_any')})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {NEGATIVE_REASON_TAGS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => toggleReason(reason)}
                className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                  selectedReasons.includes(reason)
                    ? 'border border-error/30 bg-error/12 text-error dark:border-error/25 dark:bg-error/10'
                    : 'card-shell bg-background text-foreground-muted hover:border-error/20 hover:bg-error/[0.03] dark:hover:border-error/25 dark:hover:bg-error/[0.05]'
                }`}
              >
                {tagLabel(reason)}
                {selectedReasons.includes(reason) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {helpful !== null && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleDone}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-onPrimary hover:bg-primary-dark transition-colors min-h-[44px]"
          >
            {t('done')}
          </button>
        </div>
      )}
    </div>
  );
}
