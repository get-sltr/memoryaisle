import { PorcupineManager, BuiltInKeywords } from '@picovoice/porcupine-react-native';
import { Paths, File } from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Picovoice Access Key from environment
const ACCESS_KEY = Constants.expoConfig?.extra?.picovoiceAccessKey || '';

if (!ACCESS_KEY) {
  console.warn('PICOVOICE_ACCESS_KEY not configured. Wake word detection will not work.');
}

// Wake word detection service
// iOS: Uses built-in "Computer" keyword (custom models require Picovoice Console iOS export)
// Android: Uses custom "Hey Mira" wake word

type WakeWordCallback = () => void;
type ErrorCallback = (error: Error) => void;

class WakeWordService {
  private porcupineManager: PorcupineManager | null = null;
  private isListening = false;
  private onWakeWordDetected: WakeWordCallback | null = null;
  private onError: ErrorCallback | null = null;

  // Get the wake word name for the current platform
  getWakeWordName(): string {
    return Platform.OS === 'ios' ? 'Computer' : 'Hey Mira';
  }

  // Get the local file path for the wake word model (Android only)
  private async getKeywordPath(): Promise<string> {
    const asset = Asset.fromModule(require('../../assets/porcupine/hey-Mira_en_android_v4_0_0.ppn'));
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load wake word model');
    }

    const destFile = new File(Paths.document, 'hey-mira.ppn');
    const sourceFile = new File(asset.localUri);
    await sourceFile.copy(destFile);

    return destFile.uri;
  }

  // Initialize and start listening for wake word
  async start(
    onDetected: WakeWordCallback,
    onError?: ErrorCallback
  ): Promise<boolean> {
    if (this.isListening) {
      console.log('Wake word detection already running');
      return true;
    }

    this.onWakeWordDetected = onDetected;
    this.onError = onError || null;

    try {
      const wakeWord = this.getWakeWordName();

      if (Platform.OS === 'ios') {
        // iOS: Use built-in keyword "Computer"
        this.porcupineManager = await PorcupineManager.fromBuiltInKeywords(
          ACCESS_KEY,
          [BuiltInKeywords.COMPUTER],
          (keywordIndex: number) => {
            console.log(`Wake word "${wakeWord}" detected!`);
            if (this.onWakeWordDetected) {
              this.onWakeWordDetected();
            }
          },
          (error: Error) => {
            console.error('Porcupine error:', error);
            if (this.onError) {
              this.onError(error);
            }
          }
        );
      } else {
        // Android: Use custom "Hey Mira" wake word
        const keywordPath = await this.getKeywordPath();
        this.porcupineManager = await PorcupineManager.fromKeywordPaths(
          ACCESS_KEY,
          [keywordPath],
          (keywordIndex: number) => {
            console.log(`Wake word "${wakeWord}" detected!`);
            if (this.onWakeWordDetected) {
              this.onWakeWordDetected();
            }
          },
          (error: Error) => {
            console.error('Porcupine error:', error);
            if (this.onError) {
              this.onError(error);
            }
          }
        );
      }

      await this.porcupineManager.start();
      this.isListening = true;
      console.log(`Wake word detection started - say "${wakeWord}" to activate`);
      return true;
    } catch (error: any) {
      console.error('Failed to start wake word detection:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  // Pause listening (while Mira is recording)
  async pause(): Promise<void> {
    if (this.porcupineManager && this.isListening) {
      try {
        await this.porcupineManager.stop();
        console.log('Wake word detection paused');
      } catch (error) {
        console.error('Failed to pause wake word detection:', error);
      }
    }
  }

  // Resume listening (after Mira finishes)
  async resume(): Promise<void> {
    if (this.porcupineManager && this.isListening) {
      try {
        await this.porcupineManager.start();
        console.log('Wake word detection resumed');
      } catch (error) {
        console.error('Failed to resume wake word detection:', error);
      }
    }
  }

  // Stop and cleanup
  async stop(): Promise<void> {
    if (this.porcupineManager) {
      try {
        await this.porcupineManager.stop();
        await this.porcupineManager.delete();
        this.porcupineManager = null;
        this.isListening = false;
        console.log('Wake word detection stopped');
      } catch (error) {
        console.error('Failed to stop wake word detection:', error);
      }
    }
  }

  // Check if actively listening
  getIsListening(): boolean {
    return this.isListening;
  }
}

// Export singleton instance
export const wakeWord = new WakeWordService();
