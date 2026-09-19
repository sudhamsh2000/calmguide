import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrimaryNav } from './PrimaryNav';
import { NAV_ITEMS, shouldShowBottomNav } from './BottomNav';

let mockPathname = '/home';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname,
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      'bottom_nav.label': 'Main sections',
      'bottom_nav.coach': 'Coach',
      'bottom_nav.insights': 'Insights',
      'bottom_nav.resources': 'Resources',
      'bottom_nav.more': 'More',
    };
    return (key: string) => messages[key] ?? key;
  },
}));

beforeEach(() => {
  mockPathname = '/home';
});

describe('PrimaryNav', () => {
  it('offers every destination the bottom nav does', () => {
    // One item list, two presentations. If these ever diverge, a caregiver
    // learns different names for the same place on phone and desktop.
    render(<PrimaryNav placement="header" />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(NAV_ITEMS.map((i) => i.href));
  });

  it.each(['header', 'rail'] as const)('renders the same four links in %s placement', (p) => {
    render(<PrimaryNav placement={p} />);
    for (const label of ['Coach', 'Insights', 'Resources', 'More']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('marks the current section, and keeps nested routes on it', () => {
    mockPathname = '/incidents/new';
    render(<PrimaryNav placement="header" />);
    // Insights owns /incidents, so logging an incident must not blank the
    // indicator mid-flow.
    expect(screen.getByText('Insights').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Coach').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('stays out of the landing page and facility mode', () => {
    // Both run their own chrome; this is the same guard the bottom nav uses.
    for (const path of ['/', '/facility', '/facility/dashboard']) {
      mockPathname = path;
      const { container, unmount } = render(<PrimaryNav placement="header" />);
      expect(container).toBeEmptyDOMElement();
      expect(shouldShowBottomNav(path)).toBe(false);
      unmount();
    }
  });

  it('is hidden below lg, where the bottom bar has it covered', () => {
    // The two navs must never both be on screen; BottomNav is `lg:hidden`,
    // so this one has to be the exact complement.
    const { container } = render(<PrimaryNav placement="header" />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('hidden');
    expect(nav?.className).toContain('lg:block');
  });
});
