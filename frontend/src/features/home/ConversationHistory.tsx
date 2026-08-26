'use client';

import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';

export interface ConversationSummary {
  id: string;
  title: string;
  timestamp: Date;
}

export interface ConversationHistoryProps {
  conversations: ConversationSummary[];
  className?: string;
}

function formatTimestamp(date: Date, locale: string): string {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const timeStr = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dateStr = date.toDateString();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (dateStr === todayStr) {
    return `Today at ${timeStr}`;
  }
  if (dateStr === yesterdayStr) {
    return `Yesterday at ${timeStr}`;
  }
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString(locale, { weekday: 'long' });
    return `${dayName} at ${timeStr}`;
  }

  const monthDay = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  return `${monthDay} at ${timeStr}`;
}

export function ConversationHistory({
  conversations,
  className = '',
}: ConversationHistoryProps) {
  const t = useTranslations('home');
  const locale = useLocale();

  return (
    <div className={className}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {t('conversations.heading')}
      </h2>
      <div className="flex flex-col gap-2">
        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-foreground/10 bg-surface px-4 py-3.5">
            <p className="text-sm text-foreground-muted">
              {t('conversations.empty_detail')}
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <Link key={conversation.id} href={`/coach?session_id=${conversation.id}`} className="block">
              <div className="rounded-2xl border border-foreground/10 bg-surface px-4 py-3.5 transition-colors hover:border-primary/30 cursor-pointer">
                <p className="text-sm font-medium text-foreground truncate">
                  {conversation.title}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  {formatTimestamp(conversation.timestamp, locale)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
