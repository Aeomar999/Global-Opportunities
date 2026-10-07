// Learn more https://docs.expo.io/guides/customizing-metro
const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

config.projectRoot = __dirname;
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /.*[\\\/]Global-Opportunities[\\\/]node_modules[\\\/].*/,
  /.*[\\\/]\.git[\\\/].*/,
  /.*[\\\/]\.expo[\\\/].*/,
];
config.watcher = {
  ...config.watcher,
  useWatchman: false,
  unstable_usePolling: true,
};

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  forceWriteFileSystem: true,
});
