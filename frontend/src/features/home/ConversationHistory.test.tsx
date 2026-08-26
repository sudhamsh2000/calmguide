import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      'conversations.heading': 'Recent',
      'conversations.empty_detail': 'No recent conversations yet. Tap the coach button when you need guidance.',
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'en-US',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ConversationHistory } from './ConversationHistory';
import type { ConversationSummary } from './ConversationHistory';

describe('ConversationHistory', () => {
  it('shows empty state when no conversations', () => {
    render(<ConversationHistory conversations={[]} />);
    expect(
      screen.getByText(/no recent conversations/i),
    ).toBeInTheDocument();
  });

  it('renders conversation cards when conversations exist', () => {
    const conversations: ConversationSummary[] = [
      {
        id: '1',
        title: 'Mom is refusing to take her medication',
        timestamp: new Date('2026-03-25T19:34:00'),
      },
      {
        id: '2',
        title: 'Dad keeps trying to leave the house',
        timestamp: new Date('2026-03-23T18:15:00'),
      },
    ];

    render(<ConversationHistory conversations={conversations} />);
    expect(screen.getByText(/Mom is refusing to take/)).toBeInTheDocument();
    expect(screen.getByText(/Dad keeps trying to leave/)).toBeInTheDocument();
  });

  it('shows formatted timestamps', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(19, 34, 0, 0);

    const conversations: ConversationSummary[] = [
      {
        id: '1',
        title: 'Test conversation',
        timestamp: yesterday,
      },
    ];

    render(<ConversationHistory conversations={conversations} />);
    expect(screen.getByText(/yesterday/i)).toBeInTheDocument();
  });

  it('links each conversation to /coach', () => {
    const conversations: ConversationSummary[] = [
      {
        id: '1',
        title: 'Test conversation',
        timestamp: new Date(),
      },
    ];

    render(<ConversationHistory conversations={conversations} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/coach?session_id=1');
  });

  it('truncates long titles', () => {
    const conversations: ConversationSummary[] = [
      {
        id: '1',
        title: 'This is an extremely long title that should be truncated because it exceeds the reasonable display width for a card',
        timestamp: new Date(),
      },
    ];

    render(<ConversationHistory conversations={conversations} />);
    const titleEl = screen.getByText(/This is an extremely long/);
    expect(titleEl.className).toContain('truncate');
  });

  it('accepts className prop', () => {
    const { container } = render(
      <ConversationHistory conversations={[]} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders section heading', () => {
    render(<ConversationHistory conversations={[]} />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });
});
