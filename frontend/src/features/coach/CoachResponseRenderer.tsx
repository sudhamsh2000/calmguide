'use client';

import { memo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CoachSection, CoachSectionId } from './parseResponse';
import { SpeakButton } from '@/components/ui/SpeakButton';
import { useTranslations } from 'next-intl';

export interface CoachResponseRendererProps {
  sections: CoachSection[];
  /** Raw response text — shown as markdown fallback when sections cannot be parsed */
  rawResponse?: string;
  className?: string;
}

interface SectionStyle {
  containerClass: string;
  titleClass: string;
  labelKey: 'sections.right_now' | 'sections.why' | 'sections.what_not_to_do' | 'sections.escalation';
}

const SECTION_STYLES: Record<CoachSectionId, SectionStyle> = {
  'right-now': {
    containerClass:
      'card-shell-selected rounded-2xl p-5 shadow-sm',
    titleClass: 'text-primary-dark dark:text-primary-light font-bold',
    labelKey: 'sections.right_now',
  },
  why: {
    containerClass: 'card-shell rounded-2xl p-5',
    titleClass: 'text-foreground font-semibold',
    labelKey: 'sections.why',
  },
  'what-not-to-do': {
    containerClass: 'bg-surface border-s-4 border-error rounded-2xl p-5',
    titleClass: 'text-error font-bold',
    labelKey: 'sections.what_not_to_do',
  },
  escalation: {
    containerClass: 'card-shell rounded-2xl p-5',
    titleClass: 'text-foreground-muted font-semibold',
    labelKey: 'sections.escalation',
  },
};

const markdownComponents: ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => (
    <p className="text-coach leading-relaxed text-foreground mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ps-5 space-y-1 text-coach text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ps-5 space-y-1 text-coach text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <>{children}</>,
  h3: ({ children }) => (
    <h3 className="font-semibold text-base text-foreground mt-3 mb-1">{children}</h3>
  ),
};

/**
 * Defense-in-depth allowlist for LLM-rendered markdown. Only safe text/list
 * formatting is permitted — no `img`, no `a` (links), no embedded/raw HTML.
 * Anything outside this set is stripped (`unwrapDisallowed` keeps the inner
 * text so guidance is never silently dropped).
 */
const ALLOWED_MARKDOWN_ELEMENTS: ReadonlyArray<string> = [
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'h3',
  'br',
  'blockquote',
  'code',
  'pre',
];

function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={markdownComponents}
      allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
      unwrapDisallowed
      skipHtml
    >
      {children}
    </ReactMarkdown>
  );
}

const CoachSectionCard = memo(function CoachSectionCard({ section }: { section: CoachSection }) {
  const t = useTranslations('coach');
  const style = SECTION_STYLES[section.id];
  const sectionLabel = t(style.labelKey);
  return (
    <section
      role="region"
      aria-label={sectionLabel}
      className={`${style.containerClass} animate-fade-in-up`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className={`text-lg mb-3 ${style.titleClass}`}>{sectionLabel}</h2>
        <SpeakButton text={section.content} className="shrink-0 mt-0.5" />
      </div>
      <div className="space-y-2">
        <SafeMarkdown>{section.content}</SafeMarkdown>
      </div>
    </section>
  );
});

export const CoachResponseRenderer = memo(function CoachResponseRenderer({
  sections,
  rawResponse,
  className = '',
}: CoachResponseRendererProps) {
  if (sections.length > 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {sections.map((section) => (
          <CoachSectionCard key={section.id} section={section} />
        ))}
      </div>
    );
  }

  if (rawResponse?.trim()) {
    return (
      <div
        className={`card-shell rounded-2xl p-5 animate-fade-in-up space-y-2 ${className}`}
      >
        <SafeMarkdown>{rawResponse}</SafeMarkdown>
      </div>
    );
  }

  return null;
});
