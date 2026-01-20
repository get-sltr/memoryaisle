// Wake word detection service - STUB VERSION
// Picovoice packages are temporarily disabled due to incompatibility with Expo SDK 54
// TODO: Re-enable when Picovoice releases a compatible version

import { logger } from '../utils/logger';

type WakeWordCallback = () => void;
type ErrorCallback = (error: Error) => void;

class WakeWordService {
  private isListening = false;

  // Get the wake word name for the current platform
  getWakeWordName(): string {
    return 'Hey Mira';
  }

  // Initialize and start listening for wake word (STUB - always returns false)
  async start(
    onDetected: WakeWordCallback,
    onError?: ErrorCallback
  ): Promise<boolean> {
    logger.warn('Wake word detection is temporarily disabled');
    // Wake word is disabled - user must tap the microphone button instead
    return false;
  }

  // Pause listening (no-op)
  async pause(): Promise<void> {
    // No-op
  }

  // Resume listening (no-op)
  async resume(): Promise<void> {
    // No-op
  }

  // Stop and cleanup (no-op)
  async stop(): Promise<void> {
    this.isListening = false;
  }

  // Check if actively listening
  getIsListening(): boolean {
    return this.isListening;
  }
}

// Export singleton instance
export const wakeWord = new WakeWordService();
