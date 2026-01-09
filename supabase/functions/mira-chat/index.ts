// Mira Chat - GPT-4 Intelligent Parsing Edge Function
// Handles natural language understanding and item extraction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mira's system prompt for GPT-4
const MIRA_SYSTEM_PROMPT = `You are Mira, a friendly and efficient grocery list assistant for the MemoryAisle app.

Your job is to:
1. Extract grocery items from natural speech
2. Detect the user's intent
3. Respond in a warm, concise way (under 15 words)

INTENTS:
- add_items: User wants to add items to their list
- remove_item: User wants to remove an item
- check_item: User is asking if they need something
- get_suggestions: User wants recommendations
- clear_completed: User wants to clear completed items
- general_chat: General conversation

RESPONSE FORMAT (JSON only, no markdown):
{
  "intent": "add_items",
  "items": [
    {"name": "Milk", "quantity": 1},
    {"name": "Eggs", "quantity": 12}
  ],
  "response": "Got it! Added milk and a dozen eggs."
}

RULES:
- Always return valid JSON
- Capitalize item names properly (e.g., "Milk" not "milk")
- Convert units intelligently (e.g., "a dozen eggs" = quantity 12)
- If quantity isn't specified, default to 1
- For check_item intent, include the item in the items array
- Keep responses friendly but brief
- If you can't understand, set intent to "unclear" and ask for clarification

EXAMPLES:
User: "Add milk and two loaves of bread"
{"intent": "add_items", "items": [{"name": "Milk", "quantity": 1}, {"name": "Bread", "quantity": 2}], "response": "Added milk and 2 loaves of bread!"}

User: "Do I need eggs?"
{"intent": "check_item", "items": [{"name": "Eggs", "quantity": 1}], "response": "Let me check your purchase history..."}

User: "What should I get?"
{"intent": "get_suggestions", "items": [], "response": "Based on your patterns, here are some suggestions!"}`;

interface ChatRequest {
  text: string;
  householdId?: string;
  userId?: string;
  context?: {
    currentListItems?: string[];
    recentPurchases?: string[];
  };
}

interface MiraItem {
  name: string;
  quantity: number;
}

interface MiraResponse {
  intent: string;
  items: MiraItem[];
  response: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { text, householdId, context }: ChatRequest = await req.json();

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided');
    }

    // Build context message for GPT-4
    let contextMessage = '';
    if (context?.currentListItems?.length) {
      contextMessage += `\nCurrent list items: ${context.currentListItems.join(', ')}`;
    }
    if (context?.recentPurchases?.length) {
      contextMessage += `\nRecent purchases: ${context.recentPurchases.join(', ')}`;
    }

    // Call GPT-4
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: MIRA_SYSTEM_PROMPT },
          ...(contextMessage ? [{ role: 'system', content: `Context:${contextMessage}` }] : []),
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.text();
      console.error('GPT-4 API error:', error);
      throw new Error(`GPT-4 API error: ${gptResponse.status}`);
    }

    const gptResult = await gptResponse.json();
    const content = gptResult.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from GPT-4');
    }

    // Parse the JSON response
    let miraResponse: MiraResponse;
    try {
      miraResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', content);
      miraResponse = {
        intent: 'unclear',
        items: [],
        response: "Sorry, I had trouble understanding. Could you try again?",
      };
    }

    // Validate and clean the response
    if (!miraResponse.intent) {
      miraResponse.intent = 'unclear';
    }
    if (!Array.isArray(miraResponse.items)) {
      miraResponse.items = [];
    }
    if (!miraResponse.response) {
      miraResponse.response = "Done!";
    }

    // Ensure items have valid structure
    miraResponse.items = miraResponse.items
      .filter(item => item && typeof item.name === 'string' && item.name.trim())
      .map(item => ({
        name: item.name.trim(),
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      }));

    return new Response(
      JSON.stringify({
        success: true,
        ...miraResponse,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Mira chat error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        intent: 'error',
        items: [],
        response: "Oops, something went wrong. Try again?",
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
