const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add custom asset extensions for wake word models
config.resolver.assetExts.push('ppn');
config.resolver.assetExts.push('onnx');

module.exports = config;
