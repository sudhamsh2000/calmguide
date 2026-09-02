import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BackButton } from './BackButton';

interface Section {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  sections: Section[];
  children: React.ReactNode;
}

export function LegalLayout({ title, lastUpdated, sections, children }: LegalLayoutProps) {
  const tc = useTranslations('common');
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 animate-page-enter">
      {/* Back */}
      <div className="mb-6">
        <BackButton href="/" label={tc('nav.back_to_home')} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground-muted">Last updated {lastUpdated}</p>
      </div>

      {/* Table of contents */}
      <nav
        aria-label="Table of contents"
        className="mb-8 rounded-xl border border-theme bg-surface p-4"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          On this page
        </p>
        <ol className="space-y-1">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-sm text-primary hover:text-primary-light transition-colors"
              >
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Content */}
      <div className="space-y-0">{children}</div>

      {/* Footer nav */}
      <div className="mt-12 pt-6 border-t border-theme flex gap-4 text-sm text-foreground-muted">
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
