'use client';

import { useTranslations } from 'next-intl';
import type { PendingFeedback } from '@/lib/api';
import { FeedbackWidget } from '@/features/coach/FeedbackWidget';

interface HomeFeedbackCardProps {
  pending: PendingFeedback;
  onDismiss: () => void;
  onSubmit: (helpful: boolean, tags: string[], negativeReasons: string[]) => void;
}

function useTimeLabel(isoDate: string): string {
  const t = useTranslations('home.feedback');
  const created = new Date(isoDate);
  const now = new Date();
  const hoursAgo = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
  if (hoursAgo < 1) return t('time_just_now');
  if (hoursAgo < 12) return t('time_hours_ago', { count: hoursAgo });
  if (hoursAgo < 24) return t('time_earlier_today');
  return t('time_yesterday');
}

export function HomeFeedbackCard({ pending, onDismiss, onSubmit }: HomeFeedbackCardProps) {
  const t = useTranslations('home.feedback');
  const timeText = useTimeLabel(pending.created_at);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
          <p className="text-xs text-foreground-muted mt-0.5 flex items-center gap-1">
            <span className="truncate max-w-[65%]">{pending.title.replace(/\.{3}$/, '')}</span>
            <span className="shrink-0">· {timeText}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-foreground-muted hover:text-foreground min-w-[32px] min-h-[32px] flex items-center justify-center text-lg"
          aria-label={t('dismiss_label')}
        >
          ✕
        </button>
      </div>

      <FeedbackWidget
        conversationId={pending.conversation_id}
        suggestedTags={pending.suggested_tags}
        existingFeedback={null}
        onSubmit={onSubmit}
        source="home"
        embedded
      />
    </div>
  );
}
