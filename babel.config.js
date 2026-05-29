module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Reads .env into the virtual `@env` module (build-time, no native code).
    // NOTE: when react-native-reanimated is added in Phase 1, its babel plugin must
    // be the LAST entry in this array.
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true, // app must boot without secrets (local-first)
      },
    ],
  ],
};
