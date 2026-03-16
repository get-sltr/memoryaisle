// Wake word detection service - DaVoice (react-native-wakeword)
// Uses on-device ONNX model for "Hey Mira" detection
// All audio processing happens locally — no data leaves the device

import { useCallback, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';

// Guard native module import — crashes in Expo Go where NitroModules aren't available
let useModelHook: (() => { loadModel: any; stopListening: any; setKeywordDetectionLicense: any }) | null = null;
try {
  useModelHook = require('react-native-wakeword').default;
} catch {
  logger.warn('react-native-wakeword not available (Expo Go). Wake word disabled.');
}

type WakeWordCallback = () => void;
type ErrorCallback = (error: Error) => void;

const WAKE_WORD_CONFIG = {
  id: 'hey_mira',
  modelName: 'hey_mira.onnx',
  threshold: 0.9,
  bufferCnt: 3,
  sticky: false,
};

/**
 * Custom hook for wake word detection using DaVoice.
 *
 * Usage:
 *   const { startWakeWord, stopWakeWord, pauseWakeWord, resumeWakeWord, isWakeWordListening } = useWakeWord();
 *
 * Call startWakeWord(onDetected) to begin listening.
 * Call pauseWakeWord() when recording audio (to avoid conflicts).
 * Call resumeWakeWord() after recording finishes.
 * Call stopWakeWord() on unmount.
 */
export function useWakeWord() {
  const model = useModelHook ? useModelHook() : { loadModel: () => {}, stopListening: () => {}, setKeywordDetectionLicense: () => {} };
  const { loadModel, stopListening, setKeywordDetectionLicense } = model;
  const [isListening, setIsListening] = useState(false);
  const callbackRef = useRef<WakeWordCallback | null>(null);
  const errorCallbackRef = useRef<ErrorCallback | null>(null);
  const isPausedRef = useRef(false);

  const applyLicenseKey = useCallback(() => {
    const licenseKey = (Constants.expoConfig?.extra as any)?.davoiceLicenseKey;
    if (licenseKey) {
      setKeywordDetectionLicense(licenseKey);
    }
  }, [setKeywordDetectionLicense]);

  const startNativeListener = useCallback(() => {
    try {
      applyLicenseKey();
      loadModel(
        [WAKE_WORD_CONFIG],
        async (phraseDetected: string) => {
          if (isPausedRef.current) return;
          logger.info('Wake word detected:', phraseDetected);
          callbackRef.current?.();
        }
      );
    } catch (error) {
      logger.warn('Wake word model failed to load (model may be missing):', error);
    }
  }, [loadModel, applyLicenseKey]);

  const startWakeWord = useCallback(
    (onDetected: WakeWordCallback, onError?: ErrorCallback): boolean => {
      try {
        callbackRef.current = onDetected;
        errorCallbackRef.current = onError ?? null;
        isPausedRef.current = false;

        startNativeListener();

        setIsListening(true);
        logger.info('Wake word listening started');
        return true;
      } catch (error: any) {
        logger.error('Failed to start wake word:', error);
        errorCallbackRef.current?.(error instanceof Error ? error : new Error(error?.message || 'Unknown error'));
        return false;
      }
    },
    [startNativeListener]
  );

  const stopWakeWord = useCallback(() => {
    try {
      stopListening();
      setIsListening(false);
      isPausedRef.current = false;
      callbackRef.current = null;
      errorCallbackRef.current = null;
      logger.info('Wake word listening stopped');
    } catch (error) {
      logger.error('Failed to stop wake word:', error);
    }
  }, [stopListening]);

  const pauseWakeWord = useCallback(() => {
    isPausedRef.current = true;
    try {
      stopListening();
      logger.info('Wake word paused (native module stopped, mic released)');
    } catch (error) {
      logger.error('Failed to pause wake word native module:', error);
    }
  }, [stopListening]);

  const resumeWakeWord = useCallback(() => {
    isPausedRef.current = false;
    try {
      startNativeListener();
      logger.info('Wake word resumed (native module restarted)');
    } catch (error) {
      logger.error('Failed to resume wake word native module:', error);
    }
  }, [startNativeListener]);

  const setLicenseKey = useCallback(
    (licenseKey: string) => {
      try {
        setKeywordDetectionLicense(licenseKey);
        logger.info('DaVoice license key set');
      } catch (error) {
        logger.error('Failed to set DaVoice license:', error);
      }
    },
    [setKeywordDetectionLicense]
  );

  return {
    startWakeWord,
    stopWakeWord,
    pauseWakeWord,
    resumeWakeWord,
    setLicenseKey,
    isWakeWordListening: isListening,
  };
}

// Wake word name (for display purposes)
export const WAKE_WORD_NAME = 'Hey Mira';
