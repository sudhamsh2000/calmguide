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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
      className={`sticky top-0 z-50 w-full transition-colors ${
        scrolled
          ? 'bg-surface/90 backdrop-blur-md shadow-sm border-b border-theme'
          : 'bg-transparent'
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-ink"
      >
        {t('nav.skip_to_content')}
      </a>

      <div className="mx-auto flex h-16 max-w-landing items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center" aria-label="CalmGuide">
          <Image
            src="/brand/calmguide-logo-transparent.png"
            alt="CalmGuide"
            width={2172}
            height={724}
            priority
            className="h-10 w-auto md:h-12"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              {t(`nav.${link.key}`)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle className="h-10 w-10" />
          <Link
            href="/profile/setup"
            className="focus-ring inline-flex min-h-tap items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-ink transition-colors hover:bg-primary-light active:bg-primary-dark"
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
          className="focus-ring inline-flex min-h-tap min-w-tap items-center justify-center rounded-xl text-foreground lg:hidden"
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
                className="flex min-h-tap items-center rounded-lg px-2 text-base font-medium text-foreground transition-colors hover:bg-foreground/5"
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
              className="focus-ring inline-flex min-h-tap flex-1 items-center justify-center rounded-xl bg-primary px-5 ms-3 text-sm font-semibold text-ink transition-colors hover:bg-primary-light active:bg-primary-dark"
            >
              {t('nav.cta')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
