import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { supabase } from './supabase';

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

export interface MiraChatResponse {
  success: boolean;
  intent: 'add_items' | 'remove_item' | 'check_item' | 'get_suggestions' | 'clear_completed' | 'general_chat' | 'unclear' | 'error';
  items: MiraItem[];
  response: string;
  transcription?: string;
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

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Audio permission not granted');
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
      console.error('Failed to start recording:', error);
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
      return {
        success: false,
        intent: 'error',
        items: [],
        response: 'Not recording',
        error: 'Not recording',
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
          intent: 'error',
          items: [],
          response: 'No audio recorded',
          error: 'No audio recorded',
        };
      }

      // Process with conversation context
      const result = await this.transcribeAndParse(uri, {
        ...context,
        conversationHistory: this.conversationHistory,
        speakerName: context?.speakerName || this.currentSpeaker || undefined,
      });

      // Add to history
      if (result.transcription) {
        this.addToHistory('user', result.transcription);
      }
      if (result.success && result.response) {
        this.addToHistory('assistant', result.response);
      }

      return result;
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      return {
        success: false,
        intent: 'error',
        items: [],
        response: getRandomResponse('error'),
        error: error.message,
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
      // Read file as base64
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

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
        console.error('Mira error:', error);
        return {
          success: false,
          intent: 'error',
          items: [],
          response: getRandomResponse('error'),
          error: error.message,
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
      console.error('Mira error:', error);
      return {
        success: false,
        intent: 'error',
        items: [],
        response: getRandomResponse('error'),
        error: error.message,
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
        console.error('AI processing error:', error);
        return {
          success: false,
          intent: 'error',
          items: [],
          response: getRandomResponse('error'),
          error: error.message,
        };
      }

      const result = {
        success: data.success,
        intent: data.intent,
        items: data.items || [],
        response: data.response,
      };

      // Add response to history
      if (result.success && result.response) {
        this.addToHistory('assistant', result.response);
      }

      return result;
    } catch (error: any) {
      console.error('AI processing error:', error);
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
        console.error('Suggestions error:', error);
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
      console.error('Suggestions error:', error);
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
}

// Export singleton instance
export const mira = new MiraAssistant();

// Mira's personality responses
export const miraResponses = {
  greeting: [
    "Hey! What do you need?",
    "I'm listening!",
    "What can I add for you?",
    "Go ahead, I'm ready!",
    "What can I get for you?",
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
    "Hmm, couldn't hear you. One more time?",
    "Could you repeat that?",
  ],
  error: [
    "Oops, something went wrong. Try again?",
    "Had a hiccup there. One more time?",
  ],
  thinking: [
    "Let me think...",
    "Working on it...",
    "One sec...",
  ],
  suggestions: [
    "Here's what you might need!",
    "Based on your patterns...",
    "Looks like you're running low on...",
  ],
  followUp: [
    "Anything else?",
    "What else?",
    "Need anything more?",
  ],
};

export function getRandomResponse(type: keyof typeof miraResponses): string {
  const responses = miraResponses[type];
  return responses[Math.floor(Math.random() * responses.length)];
}
