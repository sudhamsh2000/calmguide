export type CoachSectionId = 'right-now' | 'why' | 'what-not-to-do' | 'escalation';

export interface CoachSection {
  id: CoachSectionId;
  title: string;
  content: string;
}

interface HeaderMatch {
  id: CoachSectionId;
  index: number;
  contentStart: number;
}

/**
 * Stable machine markers emitted by the backend prompt.
 */
const SECTION_MARKER_PATTERN =
  /^\[\[SECTION:(right-now|why|what-not-to-do|escalation)\]\][ \t]*\r?\n?(?:###.*\r?\n?)?/gim;

const LEGACY_SECTION_PATTERNS: { pattern: RegExp; id: CoachSectionId }[] = [
  { pattern: /^###\s*(?:\d+\.\s*)?RIGHT NOW\b.*$/im, id: 'right-now' },
  { pattern: /^###\s*(?:\d+\.\s*)?WHY\b.*$/im, id: 'why' },
  { pattern: /^###\s*(?:\d+\.\s*)?WHAT NOT TO DO\b.*$/im, id: 'what-not-to-do' },
  { pattern: /^###\s*(?:\d+\.\s*)?WHEN TO CALL\b.*$/im, id: 'escalation' },
];

/**
 * Parses streaming coach response text into structured sections.
 * Designed to be called incrementally as text accumulates during streaming.
 * Partial sections (content still being streamed) are included.
 */
export function parseCoachResponse(text: string): CoachSection[] {
  if (!text.trim()) return [];

  const headers: HeaderMatch[] = [];

  for (const match of text.matchAll(SECTION_MARKER_PATTERN)) {
    headers.push({
      id: match[1] as CoachSectionId,
      index: match.index ?? 0,
      contentStart: (match.index ?? 0) + match[0].length,
    });
  }

  if (headers.length === 0) {
    for (const { pattern, id } of LEGACY_SECTION_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        headers.push({
          id,
          index: match.index,
          contentStart: match.index + match[0].length,
        });
      }
    }
  }

  if (headers.length === 0) return [];

  headers.sort((a, b) => a.index - b.index);

  const sections: CoachSection[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const contentEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const content = text.slice(header.contentStart, contentEnd).trim();

    sections.push({
      id: header.id,
      title: header.id,
      content,
    });
  }

  return sections;
}
