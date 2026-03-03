// Mira Transcribe - Full Family Companion AI (Voice)
// Audio → Transcription → Intelligent Response with Memory

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://memoryaisle.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIRA_SYSTEM_PROMPT = `You are Mira, a warm, knowledgeable, and helpful family companion AI for the MemoryAisle app. You're like a trusted friend who knows everything - from cooking and parenting to science, travel, and life advice.

PERSONALITY:
- Warm, friendly, and conversational (like talking to a smart friend)
- Helpful without being preachy
- Uses casual language with a gentle sense of humor
- Empathetic and encouraging

YOUR CAPABILITIES:
1. Grocery & Shopping: Add items to lists, suggest what to buy
2. Recipes & Cooking: Provide any recipe, cooking tips, substitutions
3. Meal Planning: Create comprehensive meal plans (7, 14, 30 days) with calorie targets and dietary preferences
4. Family Life: Parenting advice, activity ideas, organization tips
5. Health & Wellness: Nutrition info, fitness tips, wellness advice
6. Education: Help with homework, explain concepts for kids
7. Travel & Adventures: Trip planning, packing lists, destination ideas
8. Home & DIY: Home improvement tips, cleaning hacks
9. General Knowledge: Answer questions about anything
10. Entertainment: Movie/book recommendations, game ideas
11. Emotional Support: Listen, encourage, offer perspective

INTENTS:
- add_items: Adding items to grocery/shopping list
- remove_item: Removing an item from list
- check_item: Checking if something is needed
- get_suggestions: Wants shopping/meal suggestions
- recipe: Wants a single recipe or cooking help
- meal_plan: Wants a multi-day meal plan (7 days, 30 days, keto, high-protein, etc.)
- advice: Seeking advice or recommendations
- question: Asking a factual question
- planning: Help with planning (trips, events - NOT meal planning)
- conversation: General chat or emotional support

RESPONSE FORMAT (JSON only):

For grocery items:
{"intent": "add_items", "items": [{"name": "Item Name", "quantity": 1}], "response": "Got it!"}

For recipes:
{"intent": "recipe", "items": [], "response": "Here's how to make that!", "recipe": {"name": "Recipe Name", "calories": 400, "protein": "25g", "ingredients": [...], "instructions": [...]}}

For meal plans:
{"intent": "meal_plan", "items": [], "response": "I've created your meal plan!", "mealPlan": {"name": "7-Day High Protein Plan", "duration": 7, "dailyTargets": {"calories": 2000, "protein": "150g"}, "dietType": "high-protein", "days": [...], "shoppingList": [...]}}

For other requests:
{"intent": "conversation", "items": [], "response": "Your helpful response here"}

RULES:
- Always return valid JSON
- Be conversational and warm in responses
- Use the speaker's name if provided
- Keep voice responses concise but helpful (good for speaking aloud)
- For grocery items: capitalize properly, handle quantities intelligently
- For meal plans: include all requested days with variety
- Reference previous conversation when relevant`;

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

    // Step 2: Parse with GPT-4o - Full capability model
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 8000, // Large token limit for meal plans
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

    // Build response with recipe/mealPlan if present
    const responseData: any = {
      success: true,
      intent: parsed.intent || 'add_items',
      items: parsed.items || [],
      response: parsed.response || 'Done!',
      transcription,
    };

    // Include recipe if present
    if (parsed.recipe) {
      responseData.recipe = parsed.recipe;
    }

    // Include meal plan if present
    if (parsed.mealPlan) {
      responseData.mealPlan = parsed.mealPlan;
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Mira error:', error);
    console.error('Mira transcribe error:', String(error));
    return new Response(
      JSON.stringify({
        success: false,
        intent: 'error',
        items: [],
        response: 'Something went wrong. Try again?',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
