import { describe, it, expect } from 'vitest';
import { parseCoachResponse, type CoachSection } from './parseResponse';

describe('parseCoachResponse', () => {
  it('returns empty array for empty text', () => {
    expect(parseCoachResponse('')).toEqual([]);
  });

  it('discards text before any recognized header', () => {
    const text = 'Some preamble text without a header.';
    expect(parseCoachResponse(text)).toEqual([]);
  });

  it('parses a complete 4-section response', () => {
    const text = [
      '[[SECTION:right-now]]',
      '### இப்போது செய்ய வேண்டியது',
      'Stay calm. Speak in a low voice.',
      '- Lower the lights',
      '- Play soft music',
      '',
      '[[SECTION:why]]',
      '### இது ஏன் நடக்கிறது',
      'Sundowning is common in middle-stage dementia.',
      '',
      '[[SECTION:what-not-to-do]]',
      '### இதை செய்யாதீர்கள்',
      '- Do not argue or raise your voice',
      '- Do not restrain physically',
      '',
      '[[SECTION:escalation]]',
      '### எப்போது உதவிக்கு அழைக்க வேண்டும்',
      '- If they become a danger to themselves',
      '- If agitation lasts more than 30 minutes',
    ].join('\n');

    const sections = parseCoachResponse(text);
    expect(sections).toHaveLength(4);

    expect(sections[0].id).toBe('right-now');
    expect(sections[0].content).toContain('Stay calm');
    expect(sections[0].content).toContain('Lower the lights');

    expect(sections[1].id).toBe('why');
    expect(sections[1].content).toContain('Sundowning');

    expect(sections[2].id).toBe('what-not-to-do');
    expect(sections[2].content).toContain('Do not argue');

    expect(sections[3].id).toBe('escalation');
    expect(sections[3].content).toContain('danger to themselves');
  });

  it('parses partial response with only first 2 sections (streaming scenario)', () => {
    const text = [
      '[[SECTION:right-now]]',
      '### இப்போது செய்ய வேண்டியது',
      'Take a deep breath.',
      '',
      '[[SECTION:why]]',
      '### இது ஏன் நடக்கிறது',
      'This behavior is triggered by...',
    ].join('\n');

    const sections = parseCoachResponse(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe('right-now');
    expect(sections[1].id).toBe('why');
    expect(sections[1].content).toContain('triggered by');
  });

  it('parses a single section mid-stream', () => {
    const text = '[[SECTION:right-now]]\n### இப்போது செய்ய வேண்டியது\nStay calm and';
    const sections = parseCoachResponse(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('right-now');
    expect(sections[0].content).toContain('Stay calm and');
  });

  it('falls back to legacy English headers when markers are missing', () => {
    const text = [
      '### RIGHT NOW',
      'Do this immediately.',
      '',
      '### WHY THIS IS HAPPENING',
      'Because of dementia.',
    ].join('\n');

    const sections = parseCoachResponse(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe('right-now');
    expect(sections[1].id).toBe('why');
  });

  it('trims whitespace from section content', () => {
    const text =
      '[[SECTION:right-now]]\n### இப்போது செய்ய வேண்டியது\n\n  Stay calm.  \n\n[[SECTION:why]]\n### இது ஏன் நடக்கிறது\n\nBecause reasons.\n';
    const sections = parseCoachResponse(text);
    expect(sections[0].content).toBe('Stay calm.');
    expect(sections[1].content).toBe('Because reasons.');
  });

  it('preserves internal markdown formatting within sections', () => {
    const text = [
      '[[SECTION:right-now]]',
      '### இப்போது செய்ய வேண்டியது',
      '**Stay calm.** Here is what to do:',
      '1. Lower your voice',
      '2. Move slowly',
      '- Keep eye contact',
    ].join('\n');

    const sections = parseCoachResponse(text);
    expect(sections[0].content).toContain('**Stay calm.**');
    expect(sections[0].content).toContain('1. Lower your voice');
    expect(sections[0].content).toContain('- Keep eye contact');
  });

  it('maps marker ids correctly', () => {
    const idMap: Record<string, CoachSection['id']> = {
      'right-now': 'right-now',
      why: 'why',
      'what-not-to-do': 'what-not-to-do',
      escalation: 'escalation',
    };

    for (const [marker, expectedId] of Object.entries(idMap)) {
      const text = `[[SECTION:${marker}]]\n### Localized title\nContent for ${marker}`;
      const sections = parseCoachResponse(text);
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe(expectedId);
    }
  });
});
