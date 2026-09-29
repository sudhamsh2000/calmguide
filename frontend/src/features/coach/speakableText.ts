import type { CoachSection, CoachSectionId } from './parseResponse';

/**
 * Turns a streaming Moment Coach reply into sentence-sized pieces that can
 * be read aloud while the rest of the reply is still arriving.
 *
 * The spoken document is append-only as the stream grows: earlier sections
 * never change once a later section's marker has appeared, and within the
 * last section only complete sentences are ever taken. So an offset into it
 * stays valid from one streamed chunk to the next.
 */

/**
 * Section titles spoken before each section's content, so "What not to do"
 * guidance is never read out as if it were advice. "Right now" is skipped:
 * it always comes first, and saying its title only delays the guidance.
 */
export function buildSpeakableText(
  sections: CoachSection[],
  titles: Record<CoachSectionId, string>,
): string {
  return sections
    .map((section) => {
      if (section.id === 'right-now') return section.content;
      const title = titles[section.id];
      // Titles are upper-case display labels; TTS voices can read those as
      // shouted or spell them out.
      const spokenTitle = title.charAt(0) + title.slice(1).toLowerCase();
      return `${spokenTitle}.\n${section.content}`;
    })
    .join('\n\n');
}

// Sentence end (including the Devanagari danda) followed by whitespace, or a
// line break — bullet points usually carry no final punctuation.
const BOUNDARY = /[.!?।]+["'”’)\]]*(?=\s)|\n/g;

// A period after these is not the end of a sentence ("Call Dr. Patel").
const ABBREVIATION = /(?:^|\s)(?:Dr|Mr|Mrs|Ms|Sr|Sra|Jr|St)\.$/;

/** Strip markdown so it isn't read out ("asterisk asterisk"). */
export function toSpokenText(markdown: string): string {
  return (
    markdown
      .replace(/\[\[SECTION:[^\]]*\]\]/g, '')
      .replace(/^\s*#+\s*/gm, '')
      .replace(/^\s*(?:[-*+•]|\d+[.)])(?:\s+|$)/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|\*|`/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      // A bullet with no final punctuation would run straight into the next
      // one with no pause.
      .map((line) => (/[.!?।:;,"'”’)]$/.test(line) ? line : `${line}.`))
      .join(' ')
  );
}

export interface SpeakableChunk {
  /** Plain text to hand to the speech engine. */
  speech: string;
  /** Offset in the document to continue from next time. */
  end: number;
}

/**
 * The next piece of `text` after `from` that is ready to speak: complete
 * sentences adding up to at least `minChars` of spoken text. When `final`
 * (the stream has ended) whatever remains is returned too.
 */
export function nextSpeakableChunk(
  text: string,
  from: number,
  { final, minChars }: { final: boolean; minChars: number },
): SpeakableChunk | null {
  const rest = text.slice(from);
  BOUNDARY.lastIndex = 0;
  for (const match of rest.matchAll(BOUNDARY)) {
    const end = match.index + match[0].length;
    const candidate = rest.slice(0, end);
    if (match[0] !== '\n' && ABBREVIATION.test(candidate)) continue;
    const speech = toSpokenText(candidate);
    if (speech.length >= minChars) return { speech, end: from + end };
  }
  if (final) {
    const speech = toSpokenText(rest);
    if (speech) return { speech, end: text.length };
  }
  return null;
}
