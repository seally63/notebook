// RN CLI config. `assets` is consumed by `npx react-native-asset` to bundle the Geist
// + Geist Mono faces into both native projects (iOS Info.plist UIAppFonts +
// android assets/fonts). Fonts are BUNDLED, never loaded from the network.
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts'],
};
