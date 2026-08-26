/**
 * Pure helpers for the access-code login form. Extracted from login.tsx so the
 * validation rules can be unit-tested without rendering the screen (TEST-1).
 */

export const ACCESS_CODE_LENGTH = 8;

/**
 * Normalise raw keyboard input into a candidate access code: strip anything
 * that isn't a letter or digit, uppercase, and cap at the code length. Mirrors
 * the onChangeText sanitiser used by the access-code field.
 */
export function sanitizeAccessCode(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, ACCESS_CODE_LENGTH);
}

export type LoginValidationError = 'incomplete_code' | 'missing_name';

export interface LoginValidationResult {
  valid: boolean;
  /** The normalised, submit-ready code (trimmed + uppercased). */
  code: string;
  error: LoginValidationError | null;
}

/**
 * Validate the access code + caregiver name before hitting the network.
 * - The code must be exactly ACCESS_CODE_LENGTH alphanumeric chars.
 * - A non-empty patient name is required.
 */
export function validateLoginInput(rawCode: string, rawName: string): LoginValidationResult {
  const code = rawCode.trim().toUpperCase();
  if (code.length < ACCESS_CODE_LENGTH) {
    return { valid: false, code, error: 'incomplete_code' };
  }
  if (!rawName.trim()) {
    return { valid: false, code, error: 'missing_name' };
  }
  return { valid: true, code, error: null };
}
