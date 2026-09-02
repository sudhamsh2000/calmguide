import { describe, it, expect } from 'vitest';
import { localeNumbers } from './SafetyDisclosure';

/**
 * These numbers are what a caregiver is told to call during a crisis, so the
 * lookup that selects them is worth pinning directly.
 *
 * The regression these guard: the component indexed the numbers map with the
 * value from useLocale(), which is a full routing tag ("es-ES", "hi-IN"), while
 * the map is keyed by bare language code. Every non-English lookup missed and
 * fell through to English, so Spanish and Hindi caregivers were shown US 911
 * and the US helpline instead of their own.
 */
describe('localeNumbers', () => {
  it('resolves full routing tags, not just bare codes', () => {
    expect(localeNumbers('hi-IN').emergency).toBe('112');
    expect(localeNumbers('hi-IN').helpline).toBe('1800-11-0031');
  });

  it('gives Spanish its own helpline name rather than the English one', () => {
    expect(localeNumbers('es-ES').helplineName).toBe('Línea de Ayuda de Alzheimer 24/7');
  });

  it('still resolves bare codes', () => {
    expect(localeNumbers('hi').emergency).toBe('112');
    expect(localeNumbers('en').emergency).toBe('911');
  });

  it('is case-insensitive', () => {
    expect(localeNumbers('HI-in').emergency).toBe('112');
  });

  it('falls back to English for unknown or missing locales', () => {
    expect(localeNumbers('fr-FR').emergency).toBe('911');
    expect(localeNumbers(undefined).emergency).toBe('911');
  });
});
