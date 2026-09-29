import { describe, it, expect } from 'vitest';

import { parseCoachResponse } from './parseResponse';
import { buildSpeakableText, nextSpeakableChunk, toSpokenText } from './speakableText';

const TITLES = {
  'right-now': 'RIGHT NOW',
  why: 'WHY THIS IS HAPPENING',
  'what-not-to-do': 'WHAT NOT TO DO',
  escalation: 'WHEN TO CALL FOR HELP',
};

/** Every piece read out, feeding `stream` in growing prefixes as the SSE would. */
function speakAsStreamed(full: string, step: number): string[] {
  const spoken: string[] = [];
  let upTo = 0;
  for (let n = step; ; n += step) {
    const final = n >= full.length;
    const text = buildSpeakableText(parseCoachResponse(full.slice(0, n)), TITLES);
    for (;;) {
      const chunk = nextSpeakableChunk(text, upTo, { final, minChars: upTo === 0 ? 1 : 80 });
      if (!chunk) break;
      spoken.push(chunk.speech);
      upTo = chunk.end;
    }
    if (final) return spoken;
  }
}

const REPLY = [
  '[[SECTION:right-now]]',
  'Answer him plainly: "Your wife is at the store." Then offer a glass of water.',
  '- Check whether he needs the bathroom',
  '- Sit beside him, not across',
  '[[SECTION:what-not-to-do]]',
  '- **Don\'t** say "let me explain"',
  '[[SECTION:escalation]]',
  "Call Dr. Patel's office today if this is new.",
].join('\n');

describe('nextSpeakableChunk', () => {
  it('releases the first complete sentence on its own', () => {
    const text = 'Answer him plainly. Then offer water and sit with';
    expect(nextSpeakableChunk(text, 0, { final: false, minChars: 1 })).toEqual({
      speech: 'Answer him plainly.',
      end: 19,
    });
  });

  it('holds back an unfinished sentence until the stream ends', () => {
    const text = 'Then offer water and sit with';
    expect(nextSpeakableChunk(text, 0, { final: false, minChars: 1 })).toBeNull();
    expect(nextSpeakableChunk(text, 0, { final: true, minChars: 1 })?.speech).toBe(`${text}.`);
  });

  it('does not split after a title abbreviation', () => {
    const text = 'Call Dr. Patel today. More';
    expect(nextSpeakableChunk(text, 0, { final: false, minChars: 1 })?.speech).toBe(
      'Call Dr. Patel today.',
    );
  });

  it('treats a Devanagari danda as a sentence end', () => {
    const text = 'उन्हें पानी दें। फिर';
    expect(nextSpeakableChunk(text, 0, { final: false, minChars: 1 })?.speech).toBe(
      'उन्हें पानी दें।',
    );
  });
});

describe('toSpokenText', () => {
  it('strips list markers, emphasis and links', () => {
    expect(toSpokenText('- **Stay** calm\n1. See [the guide](https://x.y)')).toBe(
      'Stay calm. See the guide.',
    );
  });
});

describe('streamed read-aloud', () => {
  it('reads every section in order, with titles, whatever the chunk size', () => {
    for (const step of [1, 7, 40, REPLY.length]) {
      const spoken = speakAsStreamed(REPLY, step).join(' ');
      expect(spoken).toBe(
        'Answer him plainly: "Your wife is at the store." Then offer a glass of water. ' +
          'Check whether he needs the bathroom. Sit beside him, not across. ' +
          'What not to do. Don\'t say "let me explain" ' +
          "When to call for help. Call Dr. Patel's office today if this is new.",
      );
    }
  });

  it('never reads a section marker aloud', () => {
    expect(speakAsStreamed(REPLY, 3).join(' ')).not.toMatch(/SECTION|\[\[/);
  });

  it('starts with the first sentence of Right Now', () => {
    expect(speakAsStreamed(REPLY, 5)[0]).toBe('Answer him plainly: "Your wife is at the store."');
  });
});
