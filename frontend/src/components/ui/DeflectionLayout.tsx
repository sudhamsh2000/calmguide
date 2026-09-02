'use client';

import { useTranslations } from 'next-intl';
import { BackButton } from './BackButton';

interface ResourceLink {
  label: string;
  href: string;
  description?: string;
  phone?: boolean;
}

interface DeflectionLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  resources: ResourceLink[];
  resourcesHeading?: string;
}

export function DeflectionLayout({
  title,
  subtitle,
  children,
  resources,
  resourcesHeading,
}: DeflectionLayoutProps) {
  const tc = useTranslations('common');
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 animate-page-enter">
      <div className="mb-6">
        <BackButton href="/home" label={tc('nav.back_to_home')} />
      </div>

      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        <p className="mt-2 text-base text-foreground-muted leading-relaxed">{subtitle}</p>
      </div>

      <div className="space-y-4 text-base text-foreground leading-relaxed mb-8">{children}</div>

      <div className="card-shell rounded-2xl bg-primary/5 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted mb-4">
          {resourcesHeading ?? 'Trusted resources'}
        </h2>
        <div className="space-y-3">
          {resources.map((r) => {
            const external = !r.phone;
            return (
              <a
                key={r.href}
                href={r.href}
                className="block rounded-xl border border-foreground/10 bg-background p-4 hover:border-primary/40 transition-colors"
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                  {r.label}
                  {external && (
                    <span aria-hidden className="text-xs">
                      ↗
                    </span>
                  )}
                  {external && <span className="sr-only"> (opens in new tab)</span>}
                </span>
                {r.description && (
                  <span className="block text-sm text-foreground-muted mt-1">{r.description}</span>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </main>
  );
}
