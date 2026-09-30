import { processSSEBuffer } from '../api';

function run(buffer: string) {
  const chunks: string[] = [];
  const replaced: string[] = [];
  let emergencies = 0;
  const result = processSSEBuffer(
    buffer,
    (t) => chunks.push(t),
    (t) => replaced.push(t),
    () => {
      emergencies += 1;
    },
  );
  return { ...result, chunks, replaced, emergencies };
}

describe('processSSEBuffer', () => {
  it('reports the safety gate emergency event', () => {
    const out = run(
      'data: {"safety": {"triggered": true, "emergency": true}}\n\n' +
        'data: {"text": "Call 911 now."}\n\n' +
        'data: [DONE]\n\n',
    );
    expect(out.emergencies).toBe(1);
    expect(out.chunks).toEqual(['Call 911 now.']);
    expect(out.done).toBe(true);
  });

  it('does not raise an emergency for a non-emergency safety event', () => {
    const out = run('data: {"safety": {"triggered": true, "emergency": false}}\n\n');
    expect(out.emergencies).toBe(0);
  });

  it('passes a response-guard replacement through instead of appending it', () => {
    const out = run('data: {"text": "bad"}\n\ndata: {"replace": "repaired"}\n\n');
    expect(out.chunks).toEqual(['bad']);
    expect(out.replaced).toEqual(['repaired']);
  });

  it('returns an event split across progress callbacks so the caller can finish it', () => {
    const first = run('data: {"text": "Hello"}\n\ndata: {"te');
    expect(first.chunks).toEqual(['Hello']);
    expect(first.remaining).toBe('data: {"te');

    const second = run(`${first.remaining}xt": " world"}\n\n`);
    expect(second.chunks).toEqual([' world']);
  });
});
