import { ACCESS_CODE_LENGTH, sanitizeAccessCode, validateLoginInput } from '../login-validation';

describe('sanitizeAccessCode', () => {
  it('uppercases and strips non-alphanumeric characters', () => {
    expect(sanitizeAccessCode('ab-cd 12!')).toBe('ABCD12');
  });

  it('caps the code at the access-code length', () => {
    expect(sanitizeAccessCode('abcd1234extra')).toBe('ABCD1234');
    expect(sanitizeAccessCode('abcd1234extra')).toHaveLength(ACCESS_CODE_LENGTH);
  });

  it('returns an empty string for input with no valid characters', () => {
    expect(sanitizeAccessCode('   --- ')).toBe('');
  });
});

describe('validateLoginInput', () => {
  it('accepts a full 8-char code with a name', () => {
    const result = validateLoginInput('abcd1234', 'Mom');
    expect(result.valid).toBe(true);
    expect(result.code).toBe('ABCD1234');
    expect(result.error).toBeNull();
  });

  it('trims and uppercases the code before length-checking', () => {
    const result = validateLoginInput('  abcd1234  ', 'Dad');
    expect(result.valid).toBe(true);
    expect(result.code).toBe('ABCD1234');
  });

  it('rejects a code shorter than 8 characters', () => {
    const result = validateLoginInput('ABC123', 'Mom');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('incomplete_code');
  });

  it('rejects a missing or whitespace-only patient name', () => {
    expect(validateLoginInput('ABCD1234', '').error).toBe('missing_name');
    expect(validateLoginInput('ABCD1234', '   ').error).toBe('missing_name');
  });

  it('reports the incomplete-code error before the missing-name error', () => {
    const result = validateLoginInput('ABC', '');
    expect(result.error).toBe('incomplete_code');
  });
});
