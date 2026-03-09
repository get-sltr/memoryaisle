const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODEL_SOURCE = 'assets/models/hey_mira.onnx';

function withWakeWordModel(config) {
  // iOS: copy model to the react-native-wakeword pod's models dir
  // The podspec bundles everything in ios/KeyWordRNBridge/models/* as resources
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.resolve(projectRoot, MODEL_SOURCE);
      const dest = path.resolve(
        projectRoot,
        'node_modules/react-native-wakeword/ios/KeyWordRNBridge/models/hey_mira.onnx'
      );

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('[withWakeWordModel] Copied hey_mira.onnx to iOS models');
      } else {
        console.warn('[withWakeWordModel] Model not found:', src);
      }

      return cfg;
    },
  ]);

  // Android: copy model to android/app/src/main/assets/
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.resolve(projectRoot, MODEL_SOURCE);
      const assetsDir = path.resolve(
        projectRoot,
        'android/app/src/main/assets'
      );

      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const dest = path.resolve(assetsDir, 'hey_mira.onnx');

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('[withWakeWordModel] Copied hey_mira.onnx to Android assets');
      } else {
        console.warn('[withWakeWordModel] Model not found:', src);
      }

      return cfg;
    },
  ]);

  return config;
}

module.exports = withWakeWordModel;
