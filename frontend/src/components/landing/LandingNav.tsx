'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV_LINKS = [
  { href: '#what-we-do', key: 'what_we_do' },
  { href: '#how-it-works', key: 'how_it_works' },
  { href: '#safety', key: 'safety' },
  { href: '#technology', key: 'technology' },
  { href: '#for-caregivers', key: 'for_caregivers' },
  { href: '#for-healthcare', key: 'for_healthcare' },
  { href: '#about', key: 'about' },
] as const;

export function LandingNav() {
  const t = useTranslations('common.landing');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Which link is "current" — a thin band a third of the way down the
  // viewport, rather than the section that merely touches the top, so the
  // highlight changes when a section is actually being read, not the
  // instant its top pixel appears.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const entries = NAV_LINKS.map((link) => ({
      href: link.href as string,
      el: document.getElementById(link.href.slice(1)),
    })).filter((e): e is { href: string; el: HTMLElement } => e.el !== null);
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((o) => o.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
        const match = entries.find((e) => e.el === topMost.target);
        if (match) setActiveHref(match.href);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    entries.forEach((e) => observer.observe(e.el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <header
      className="sticky top-0 z-50 w-full transition-[background-color,box-shadow] duration-200"
      style={
        scrolled
          ? {
              backgroundColor: 'color-mix(in srgb, var(--color-surface) 90%, transparent)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 1px 2px rgba(16,20,28,0.06)',
            }
          : undefined
      }
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-onPrimary"
      >
        {t('nav.skip_to_content')}
      </a>

      {/* Transparent over the hero, on the page's own gradient — no bar of
       * its own — with the link set collected into one white pill in the
       * center and the primary CTA as a plain black pill on the end,
       * matching the reference exactly. Gains a translucent backing only
       * once scrolled past the hero, so it stays legible over whatever
       * section is underneath it further down the page. */}
      <div className="mx-auto flex h-20 max-w-landing items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="CalmGuide">
          <Image
            src="/brand/calmguide-logo-transparent.png"
            alt="CalmGuide"
            width={2172}
            height={724}
            priority
            className="h-9 w-auto md:h-10"
          />
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full bg-white px-2 py-2 shadow-sm lg:flex"
          aria-label="Main"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? 'true' : undefined}
              className={`landing-nav-link rounded-full px-4 py-2 text-sm font-medium ${
                activeHref === link.href ? 'text-foreground' : 'text-foreground-muted'
              }`}
            >
              {t(`nav.${link.key}`)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle className="h-9 w-9" />
          <Link
            href="/profile/setup"
            className="focus-ring inline-flex min-h-tap items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-onPrimary transition-colors hover:bg-primary-light active:bg-primary-dark"
          >
            {t('nav.cta')}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-nav"
          aria-label={mobileOpen ? t('nav.close_menu') : t('nav.menu')}
          className="focus-ring inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-foreground lg:hidden"
        >
          {mobileOpen ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="landing-mobile-nav"
          className="border-t border-theme bg-surface px-5 py-4 lg:hidden"
        >
          <nav className="flex flex-col" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="landing-nav-link flex min-h-tap items-center rounded-full px-2 text-base font-medium text-foreground"
              >
                {t(`nav.${link.key}`)}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-theme pt-3">
            <ThemeToggle className="h-10 w-10" />
            <Link
              href="/profile/setup"
              onClick={() => setMobileOpen(false)}
              className="focus-ring inline-flex min-h-tap flex-1 items-center justify-center rounded-full bg-primary px-5 ms-3 text-sm font-semibold text-onPrimary transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              {t('nav.cta')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
