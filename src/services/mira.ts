import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Helper to read file as base64 using fetch (avoids expo-file-system deprecation)
async function readFileAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/m4a;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to check if file exists using fetch
async function checkFileExists(uri: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const response = await fetch(uri, { method: 'HEAD' });
    if (response.ok) {
      const size = Number.parseInt(response.headers.get('content-length') || '0', 10);
      return { exists: true, size };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

// Mira - MemoryAisle's AI Assistant
// Full conversational AI with voice, memory, and personality

// Types
export interface MiraItem {
  name: string;
  quantity: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface MiraRecipe {
  name: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
  ingredients: string[];
  instructions: string[];
  tips?: string[];
}

export interface MiraMeal {
  name: string;
  calories: number;
  description: string;
  ingredients: string[];
  macros?: {
    protein: string;
    carbs: string;
    fat: string;
  };
  prepTime?: string;
}

export interface MiraDayPlan {
  day: number;
  dayName?: string;
  meals: {
    breakfast: MiraMeal;
    lunch: MiraMeal;
    dinner: MiraMeal;
    snacks?: MiraMeal;
  };
  totalCalories: number;
  totalMacros?: {
    protein: string;
    carbs: string;
    fat: string;
  };
}

export interface MiraMealPlan {
  name: string;
  description: string;
  duration: number;
  dailyTargets: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
  dietType: string;
  days: MiraDayPlan[];
  shoppingList: string[];
  tips: string[];
}

export interface MiraChatResponse {
  success: boolean;
  intent: 'add_items' | 'remove_item' | 'check_item' | 'get_suggestions' | 'clear_completed' | 'general_chat' | 'recipe' | 'meal_plan' | 'advice' | 'question' | 'planning' | 'conversation' | 'unclear' | 'error';
  items: MiraItem[];
  response: string;
  transcription?: string;
  recipe?: MiraRecipe;
  mealPlan?: MiraMealPlan;
  error?: string;
}

export interface MiraSuggestion {
  itemName: string;
  reason: string;
  confidence: number;
  daysPastDue: number;
}

export interface MiraSuggestResponse {
  success: boolean;
  suggestions: MiraSuggestion[];
  message: string;
  error?: string;
}

// Voice settings for Mira
const MIRA_VOICE_CONFIG = {
  language: 'en-US',
  pitch: 1.1,      // Slightly higher pitch for friendly tone
  rate: 1.05,      // Slightly faster, energetic
};

class MiraAssistant {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private isSpeaking = false;

  // Conversation memory - last 10 turns for context
  private conversationHistory: ConversationTurn[] = [];
  private readonly MAX_HISTORY = 10;

  // Speaker context (will be set by Eagle)
  private currentSpeaker: string | null = null;

  // Set current speaker (called by Eagle recognition)
  setSpeaker(speakerId: string | null): void {
    this.currentSpeaker = speakerId;
  }

  getCurrentSpeaker(): string | null {
    return this.currentSpeaker;
  }

  // Add to conversation history
  private addToHistory(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY);
    }
  }

  // Get recent conversation for context
  getConversationHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  // Clear conversation (new session)
  clearConversation(): void {
    this.conversationHistory = [];
  }

  // Speak response using TTS
  async speak(text: string): Promise<void> {
    // Don't speak if already speaking
    if (this.isSpeaking) {
      await Speech.stop();
    }

    this.isSpeaking = true;

    return new Promise((resolve) => {
      Speech.speak(text, {
        ...MIRA_VOICE_CONFIG,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  // Stop speaking
  async stopSpeaking(): Promise<void> {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }

  // Check if Mira is currently speaking
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // Start listening
  async startListening(): Promise<boolean> {
    try {
      // Stop any ongoing speech
      await this.stopSpeaking();

      // Clean up any existing recording first
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.recording = null;
        this.isRecording = false;
      }

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        logger.error('Audio permission not granted');
        return false;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      return true;
    } catch (error) {
      logger.error('Failed to start recording:', error);
      // Clean up on error
      this.recording = null;
      this.isRecording = false;
      return false;
    }
  }

  // Stop listening and process with AI
  async stopListening(context?: {
    currentListItems?: string[];
    recentPurchases?: string[];
    speakerName?: string;
  }): Promise<MiraChatResponse> {
    if (!this.recording || !this.isRecording) {
      logger.error('stopListening called but not recording');
      return {
        success: false,
        intent: 'error',
        items: [],
        response: 'Not recording',
        error: 'Recording not started - tap mic to start',
      };
    }

    try {
      this.isRecording = false;
      logger.info('Stopping recording...');
      await this.recording.stopAndUnloadAsync();

      const uri = this.recording.getURI();
      logger.info('Recording URI:', uri);
      this.recording = null;

      if (!uri) {
        logger.error('No URI from recording');
        return {
          success: false,
          intent: 'error',
          items: [],
          response: 'No audio recorded',
          error: 'No audio file created',
        };
      }

      // Check if file exists and has content
      const fileInfo = await checkFileExists(uri);
      logger.info('Audio file info:', fileInfo);

      if (!fileInfo.exists) {
        return {
          success: false,
          intent: 'error',
          items: [],
          response: 'Audio file not found',
          error: 'Audio file does not exist',
        };
      }

      // Process with conversation context
      logger.info('Sending to transcribe...');
      const result = await this.transcribeAndParse(uri, {
        ...context,
        conversationHistory: this.conversationHistory,
        speakerName: context?.speakerName || this.currentSpeaker || undefined,
      });
      logger.info('Transcribe result:', result.success, result.error);

      // Add to history
      if (result.transcription) {
        this.addToHistory('user', result.transcription);
      }
      if (result.success && result.response) {
        this.addToHistory('assistant', result.response);
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to stop recording:', error);
      return {
        success: false,
        intent: 'error',
        items: [],
        response: 'Voice processing failed',
        error: `Stop recording error: ${error.message}`,
      };
    }
  }

  // Stop listening, process, and speak response
  async stopListeningAndRespond(context?: {
    currentListItems?: string[];
    recentPurchases?: string[];
    speakerName?: string;
  }): Promise<MiraChatResponse> {
    const result = await this.stopListening(context);

    // Speak the response
    if (result.success && result.response) {
      await this.speak(result.response);
    }

    return result;
  }

  // Cancel recording
  async cancelListening(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (e) {
        // Ignore errors when canceling
      }
      this.recording = null;
      this.isRecording = false;
    }
  }

  // Transcribe + Parse with conversation context
  private async transcribeAndParse(
    uri: string,
    context?: {
      currentListItems?: string[];
      recentPurchases?: string[];
      conversationHistory?: ConversationTurn[];
      speakerName?: string;
    }
  ): Promise<MiraChatResponse> {
    try {
      // Read file as base64 using fetch (avoids expo-file-system deprecation)
      const base64 = await readFileAsBase64(uri);

      if (!base64 || base64.length === 0) {
        return {
          success: false,
          intent: 'error',
          items: [],
          response: "I couldn't hear that. Please try again.",
          error: 'Empty audio file',
        };
      }

      // Call Edge Function with full context
      const { data, error } = await supabase.functions.invoke('mira-transcribe', {
        body: {
          audio: base64,
          filename: 'audio.m4a',
          context: {
            currentListItems: context?.currentListItems,
            recentPurchases: context?.recentPurchases,
            conversationHistory: context?.conversationHistory?.slice(-5), // Last 5 turns
            speakerName: context?.speakerName,
          },
        },
      });

      if (error) {
        logger.error('Mira transcribe error:', error);
        return {
          success: false,
          intent: 'error',
          items: [],
          response: "I'm having trouble connecting. Please try again.",
          error: `Edge function error: ${error.message}`,
        };
      }

      if (!data) {
        return {
          success: false,
          intent: 'error',
          items: [],
          response: "I didn't get a response. Please try again.",
          error: 'No data returned from edge function',
        };
      }

      return {
        success: data.success,
        intent: data.intent || 'unclear',
        items: data.items || [],
        response: data.response || 'Done!',
        transcription: data.transcription,
      };
    } catch (error: any) {
      logger.error('Mira transcribe error:', error);
      return {
        success: false,
        intent: 'error',
        items: [],
        response: "Something went wrong with voice processing.",
        error: `Transcribe failed: ${error.message}`,
      };
    }
  }

  // Process text directly (for typed input)
  async processText(
    text: string,
    context?: {
      currentListItems?: string[];
      recentPurchases?: string[];
      speakerName?: string;
      familyDietaryRestrictions?: string;
      glp1Context?: string;
      pantryContext?: string;
      budgetContext?: string;
      holidayContext?: string;
    }
  ): Promise<MiraChatResponse> {
    try {
      // Add to history
      this.addToHistory('user', text);

      const { data, error } = await supabase.functions.invoke('mira-chat', {
        body: {
          text,
          context: {
            ...context,
            conversationHistory: this.conversationHistory.slice(-5),
            speakerName: context?.speakerName || this.currentSpeaker || undefined,
          },
        },
      });

      if (error) {
        logger.error('AI processing error:', error);
        return {
          success: false,
          intent: 'error',
          items: [],
          response: getRandomResponse('error'),
          error: error.message,
        };
      }

      const result: MiraChatResponse = {
        success: data.success,
        intent: data.intent,
        items: data.items || [],
        response: data.response,
        recipe: data.recipe || undefined,
        mealPlan: data.mealPlan || undefined,
      };

      // Add response to history
      if (result.success && result.response) {
        this.addToHistory('assistant', result.response);
      }

      return result;
    } catch (error: any) {
      logger.error('AI processing error:', error);
      return {
        success: false,
        intent: 'error',
        items: [],
        response: getRandomResponse('error'),
        error: error.message,
      };
    }
  }

  // Process text and speak response
  async processTextAndRespond(
    text: string,
    context?: {
      currentListItems?: string[];
      recentPurchases?: string[];
      speakerName?: string;
    }
  ): Promise<MiraChatResponse> {
    const result = await this.processText(text, context);

    if (result.success && result.response) {
      await this.speak(result.response);
    }

    return result;
  }

  // Get suggestions based on purchase patterns
  async getSuggestions(householdId: string): Promise<MiraSuggestResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('mira-suggest', {
        body: { householdId },
      });

      if (error) {
        logger.error('Suggestions error:', error);
        return {
          success: false,
          suggestions: [],
          message: "Couldn't load suggestions",
          error: error.message,
        };
      }

      return {
        success: data.success,
        suggestions: data.suggestions || [],
        message: data.message,
      };
    } catch (error: any) {
      logger.error('Suggestions error:', error);
      return {
        success: false,
        suggestions: [],
        message: "Couldn't load suggestions",
        error: error.message,
      };
    }
  }

  // Greet user (with optional name from speaker recognition)
  async greet(speakerName?: string): Promise<void> {
    let greeting: string;

    if (speakerName) {
      const greetings = [
        `Hey ${speakerName}! What do you need?`,
        `Hi ${speakerName}! What can I get for you?`,
        `${speakerName}! Ready when you are.`,
      ];
      greeting = greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      greeting = getRandomResponse('greeting');
    }

    await this.speak(greeting);
  }

  // Get recording status
  getIsRecording(): boolean {
    return this.isRecording;
  }

  // =============================================
  // DIRECT DICTATION MODE - Fast item entry
  // =============================================

  // Quick dictate - just items, no conversation
  async quickDictate(): Promise<{
    success: boolean;
    items: MiraItem[];
    transcription: string;
    message: string;
  }> {
    if (!this.recording || !this.isRecording) {
      return {
        success: false,
        items: [],
        transcription: '',
        message: 'Not recording',
      };
    }

    try {
      this.isRecording = false;
      await this.recording.stopAndUnloadAsync();

      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        return {
          success: false,
          items: [],
          transcription: '',
          message: 'No audio recorded',
        };
      }

      // Read file as base64 using fetch (avoids expo-file-system deprecation)
      const base64 = await readFileAsBase64(uri);

      // Call fast dictation Edge Function
      const { data, error } = await supabase.functions.invoke('mira-dictate', {
        body: {
          audio: base64,
          filename: 'audio.m4a',
        },
      });

      if (error) {
        logger.error('Dictation error:', error);
        return {
          success: false,
          items: [],
          transcription: '',
          message: 'Something went wrong',
        };
      }

      return {
        success: data.success,
        items: data.items || [],
        transcription: data.transcription || '',
        message: data.message || 'Done!',
      };
    } catch (error: any) {
      logger.error('Dictation error:', error);
      return {
        success: false,
        items: [],
        transcription: '',
        message: 'Something went wrong',
      };
    }
  }

  // Quick dictate and speak result
  async quickDictateAndRespond(): Promise<{
    success: boolean;
    items: MiraItem[];
    transcription: string;
    message: string;
  }> {
    const result = await this.quickDictate();

    if (result.success && result.items.length > 0) {
      await this.speak(result.message);
    } else if (!result.success) {
      await this.speak("Didn't catch that. Try again?");
    }

    return result;
  }
}

// Export singleton instance
export const mira = new MiraAssistant();

// Mira's personality responses - Full Family Companion
export const miraResponses = {
  greeting: [
    "Hey! What's on your mind?",
    "Hi there! How can I help?",
    "I'm all ears! What do you need?",
    "Hey! What can I do for you today?",
    "Hi! Ready when you are!",
  ],
  added: [
    "Got it!",
    "Added!",
    "On the list!",
    "Done!",
    "All set!",
  ],
  notUnderstood: [
    "Sorry, I didn't catch that. Try again?",
    "Hmm, couldn't quite hear you. One more time?",
    "Could you repeat that?",
  ],
  error: [
    "Oops, something went wrong. Try again?",
    "Had a little hiccup there. One more time?",
  ],
  thinking: [
    "Let me think...",
    "Working on it...",
    "Give me a sec...",
    "Let me look into that...",
  ],
  suggestions: [
    "Here's what you might need!",
    "Based on your patterns...",
    "Looks like you're running low on...",
  ],
  followUp: [
    "Anything else I can help with?",
    "What else?",
    "Need anything else?",
    "Happy to help with more!",
  ],
  recipe: [
    "Ooh, good choice! Here's the recipe...",
    "I love that dish! Here's how to make it...",
    "Great pick! Here's my recipe for you...",
  ],
  advice: [
    "Here's what I think...",
    "Let me share some thoughts...",
    "Great question! Here's my take...",
  ],
};

export function getRandomResponse(type: keyof typeof miraResponses): string {
  const responses = miraResponses[type];
  return responses[Math.floor(Math.random() * responses.length)];
}
