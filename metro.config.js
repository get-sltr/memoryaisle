const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .ppn files to asset extensions for Porcupine wake word models
config.resolver.assetExts.push('ppn');

module.exports = config;
