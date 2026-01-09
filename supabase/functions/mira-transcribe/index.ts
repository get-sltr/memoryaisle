// Mira Transcribe - Conversational AI Edge Function
// Audio → Transcription → Intelligent Response with Memory

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIRA_SYSTEM_PROMPT = `You are Mira, a friendly and helpful AI grocery assistant for MemoryAisle app. You have a warm, conversational personality.

CAPABILITIES:
- Add items to grocery list
- Answer questions about the list
- Give suggestions based on patterns
- Have natural conversations about groceries and cooking
- Remember context from recent conversation

RESPONSE FORMAT (JSON only):
{
  "intent": "add_items|remove_item|check_item|get_suggestions|general_chat|unclear",
  "items": [{"name": "Item Name", "quantity": 1}],
  "response": "Your conversational response"
}

PERSONALITY:
- Friendly and warm, like a helpful friend
- Concise but not robotic (10-20 words typically)
- Use the speaker's name if provided
- Reference previous conversation when relevant
- Be proactive: "Got it! Anything else?" or "Added! Need milk with those cookies?"

RULES:
- Capitalize item names properly (Milk, Bread, Eggs)
- Convert quantities (dozen = 12, couple = 2, few = 3)
- Default quantity is 1 if not specified
- For follow-ups like "add 2 more" or "actually make that 3", reference previous context
- If user asks about items already on list, acknowledge it
- Keep responses natural and conversational`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { audio, filename = 'audio.m4a', context } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    // Step 1: Transcribe with Whisper
    const audioBytes = decode(audio);
    const audioBlob = new Blob([audioBytes], { type: 'audio/m4a' });

    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      throw new Error(`Whisper error: ${whisperResponse.status}`);
    }

    const { text: transcription } = await whisperResponse.json();

    if (!transcription || transcription.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          intent: 'unclear',
          items: [],
          response: "I didn't catch that. Try again?",
          transcription: '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context-aware messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: MIRA_SYSTEM_PROMPT },
    ];

    // Add conversation history for context
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      for (const turn of context.conversationHistory) {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content,
        });
      }
    }

    // Build user message with context
    let userMessage = transcription;

    // Add speaker context
    if (context?.speakerName) {
      userMessage = `[Speaker: ${context.speakerName}] ${transcription}`;
    }

    // Add list context
    if (context?.currentListItems && context.currentListItems.length > 0) {
      userMessage += `\n\n[Current list has: ${context.currentListItems.slice(0, 10).join(', ')}${context.currentListItems.length > 10 ? '...' : ''}]`;
    }

    messages.push({ role: 'user', content: userMessage });

    // Step 2: Parse with GPT-4o-mini
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7, // More creative for natural conversation
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!gptResponse.ok) {
      // Fallback if GPT fails
      return new Response(
        JSON.stringify({
          success: true,
          intent: 'add_items',
          items: [{ name: transcription, quantity: 1 }],
          response: 'Added!',
          transcription,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gptResult = await gptResponse.json();
    const content = gptResult.choices[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        intent: 'add_items',
        items: [{ name: transcription, quantity: 1 }],
        response: 'Added!',
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        intent: parsed.intent || 'add_items',
        items: parsed.items || [],
        response: parsed.response || 'Done!',
        transcription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Mira error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        intent: 'error',
        items: [],
        response: 'Something went wrong. Try again?',
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
