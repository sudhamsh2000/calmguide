import { parseCoachResponse } from '../parse-response';

describe('parseCoachResponse', () => {
  it('returns no sections for empty or whitespace-only input', () => {
    expect(parseCoachResponse('')).toEqual([]);
    expect(parseCoachResponse('   \n  ')).toEqual([]);
  });

  it('parses the four-part coach response from SECTION markers', () => {
    const raw = [
      '[[SECTION:right-now]]',
      'Speak slowly and stay calm.',
      '',
      '[[SECTION:why]]',
      'Sundowning is common in the late afternoon.',
      '',
      '[[SECTION:what-not-to-do]]',
      "Don't argue or correct them.",
      '',
      '[[SECTION:escalation]]',
      'Call 911 if there is a fall or injury.',
    ].join('\n');

    const sections = parseCoachResponse(raw);

    expect(sections.map((s) => s.id)).toEqual([
      'right-now',
      'why',
      'what-not-to-do',
      'escalation',
    ]);
    expect(sections[0].content).toBe('Speak slowly and stay calm.');
    expect(sections[2].content).toBe("Don't argue or correct them.");
    expect(sections[3].content).toBe('Call 911 if there is a fall or injury.');
  });

  it('keeps sections in document order even when emitted out of order', () => {
    const raw = '[[SECTION:why]]\nB\n\n[[SECTION:right-now]]\nA';
    const sections = parseCoachResponse(raw);
    expect(sections.map((s) => s.id)).toEqual(['why', 'right-now']);
  });

  it('falls back to legacy ### headers when no markers are present', () => {
    const raw = [
      '### RIGHT NOW',
      'Do this immediately.',
      '### WHY',
      'Because of confusion.',
      '### WHAT NOT TO DO',
      'Avoid this.',
      '### WHEN TO CALL',
      'Escalate here.',
    ].join('\n');

    const sections = parseCoachResponse(raw);
    expect(sections.map((s) => s.id)).toEqual([
      'right-now',
      'why',
      'what-not-to-do',
      'escalation',
    ]);
    expect(sections[0].content).toBe('Do this immediately.');
  });

  it('returns no sections when there are no recognizable headers', () => {
    expect(parseCoachResponse('Just some free-form guidance.')).toEqual([]);
  });

  it('handles a partial/streaming response with only the first section so far', () => {
    const raw = '[[SECTION:right-now]]\nStay with them and breathe.';
    const sections = parseCoachResponse(raw);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('right-now');
    expect(sections[0].content).toBe('Stay with them and breathe.');
  });
});
