/* Jest setup: runs after the test framework is installed in each test file. */

// @testing-library/react-native ships its own matchers (toBeOnTheScreen, etc.)
// since v12.4; importing the entry registers them with expect().
require('@testing-library/react-native');

// AsyncStorage has no native backing in Jest — provide an in-memory mock so
// modules that import it (e.g. facility-storage, pulled in transitively by
// api.ts for the facility JWT) load cleanly.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store.has(k) ? store.get(k) : null)),
      setItem: jest.fn((k, v) => {
        store.set(k, String(v));
        return Promise.resolve();
      }),
      removeItem: jest.fn((k) => {
        store.delete(k);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

// Quiet down Expo's winter/runtime warnings that aren't relevant in unit tests.
jest.spyOn(console, 'warn').mockImplementation(() => {});
