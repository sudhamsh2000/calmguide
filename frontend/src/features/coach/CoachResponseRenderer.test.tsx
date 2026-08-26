import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { CoachResponseRenderer } from './CoachResponseRenderer';
import type { CoachSection } from './parseResponse';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      'sections.right_now': 'RIGHT NOW',
      'sections.why': 'WHY THIS IS HAPPENING',
      'sections.what_not_to_do': 'WHAT NOT TO DO',
      'sections.escalation': 'WHEN TO CALL FOR HELP',
    };
    return messages[key] ?? key;
  },
  useLocale: () => 'en-US',
}));

afterEach(cleanup);

const makeSections = (ids: CoachSection['id'][]): CoachSection[] =>
  ids.map((id) => {
    const contents: Record<CoachSection['id'], string> = {
      'right-now': 'Stay calm and lower the lights.',
      why: 'Sundowning is common in middle-stage dementia.',
      'what-not-to-do': 'Do not argue or raise your voice.',
      escalation: 'Call 911 if they become a danger.',
    };
    return { id, title: id, content: contents[id] };
  });

describe('CoachResponseRenderer', () => {
  it('renders nothing for empty sections and no rawResponse', () => {
    const { container } = render(<CoachResponseRenderer sections={[]} />);
    expect(container.querySelector('[role="region"]')).not.toBeInTheDocument();
  });

  it('renders rawResponse as markdown fallback when sections is empty', () => {
    render(<CoachResponseRenderer sections={[]} rawResponse="**Hello** caregiver" />);
    expect(screen.getByText('Hello caregiver')).toBeInTheDocument();
  });

  it('renders RIGHT NOW section with primary background styling', () => {
    render(<CoachResponseRenderer sections={makeSections(['right-now'])} />);
    const region = screen.getByRole('region', { name: /right now/i });
    expect(region.className).toMatch(/bg-primary/);
  });

  it('renders RIGHT NOW section with elevated shadow', () => {
    render(<CoachResponseRenderer sections={makeSections(['right-now'])} />);
    const region = screen.getByRole('region', { name: /right now/i });
    expect(region.className).toMatch(/shadow/);
  });

  it('renders WHAT NOT TO DO with red inline-start border', () => {
    render(<CoachResponseRenderer sections={makeSections(['what-not-to-do'])} />);
    const region = screen.getByRole('region', { name: /what not to do/i });
    expect(region.className).toMatch(/border-s-4/);
    expect(region.className).toMatch(/border-error/);
  });

  it('renders no emoji characters in any section title', () => {
    render(
      <CoachResponseRenderer
        sections={makeSections(['right-now', 'why', 'what-not-to-do', 'escalation'])}
      />,
    );
    const headings = screen.getAllByRole('heading', { level: 2 });
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
    for (const h of headings) {
      expect(emojiRegex.test(h.textContent ?? '')).toBe(false);
    }
  });

  it('renders all 4 sections with correct aria landmarks', () => {
    render(
      <CoachResponseRenderer
        sections={makeSections(['right-now', 'why', 'what-not-to-do', 'escalation'])}
      />,
    );
    expect(screen.getByRole('region', { name: /right now/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /why this is happening/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /what not to do/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /when to call for help/i })).toBeInTheDocument();
  });

  it('each section has an aria-label attribute', () => {
    render(
      <CoachResponseRenderer
        sections={makeSections(['right-now', 'why', 'what-not-to-do', 'escalation'])}
      />,
    );
    for (const region of screen.getAllByRole('region')) {
      expect(region).toHaveAttribute('aria-label');
    }
  });

  it('accepts className prop on the wrapper', () => {
    const { container } = render(
      <CoachResponseRenderer sections={makeSections(['right-now'])} className="my-class" />,
    );
    expect(container.firstChild).toHaveClass('my-class');
  });
});
