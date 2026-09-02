import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Load English translations for realistic test mocking
import commonMessages from '../locales/en/common.json';
import coachMessages from '../locales/en/coach.json';
import homeMessages from '../locales/en/home.json';
import checkinMessages from '../locales/en/checkin.json';
import learnMessages from '../locales/en/learn.json';
import profileMessages from '../locales/en/profile.json';

const allMessages: Record<string, Record<string, unknown>> = {
  common: commonMessages,
  coach: coachMessages,
  home: homeMessages,
  checkin: checkinMessages,
  learn: learnMessages,
  profile: profileMessages,
};

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

// Stable mock router instance for next-intl navigation
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterBack = vi.fn();
const mockRouter = { push: mockRouterPush, replace: mockRouterReplace, back: mockRouterBack };

vi.mock('@/i18n/navigation', async () => {
  const React = await import('react');
  return {
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('a', { href, ...props }, children),
    useRouter: () => mockRouter,
    usePathname: () => '/',
    redirect: vi.fn(),
  };
});

// Mock next-intl — returns actual English translations
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const messages = allMessages[ns] ?? {};
    const t = (key: string, params?: Record<string, string>) => {
      let value = getNestedValue(messages, key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, v);
        }
      }
      return value;
    };
    t.raw = (key: string) => getNestedValue(messages, key);
    // Real next-intl's t.has() reports whether a key resolves to an actual
    // translation. getNestedValue() returns the key itself as a fallback
    // sentinel when nothing is found, so "did we get back the key we asked
    // for" is the same signal, without needing a second lookup path.
    t.has = (key: string) => getNestedValue(messages, key) !== key;
    return t;
  },
  useLocale: () => 'en',
}));

// Polyfill localStorage for jsdom environments where it may be incomplete
// (Node 25+ has a native localStorage global that conflicts with jsdom)
if (
  typeof window !== 'undefined' &&
  (!window.localStorage || typeof window.localStorage.clear !== 'function')
) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
}
