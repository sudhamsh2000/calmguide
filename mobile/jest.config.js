/** Jest config for the CalmGuide mobile app (Expo SDK 55 / React Native). */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Map the `@/*` path alias used throughout src/ (mirrors tsconfig paths).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // jest-expo ignores node_modules by default; allow transforming the RN/Expo
  // ESM packages our code (and the testing library) pull in.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@testing-library/.*))',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
