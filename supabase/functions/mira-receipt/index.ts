// Mira Receipt Scanner - Extract items from receipt, find what's missing
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { image, listItems } = await req.json();

    if (!image) {
      throw new Error('No receipt image provided');
    }

    // Use GPT-4 Vision to extract items from receipt
    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a receipt scanner. Extract all purchased items from this grocery receipt image.

Return JSON only:
{
  "items": ["Item 1", "Item 2", "Item 3"]
}

Rules:
- Extract product names, not prices or quantities
- Normalize names (e.g., "ORG BANANAS" → "Bananas", "2% MILK GAL" → "Milk")
- Remove store codes, SKUs, and abbreviations
- Focus on food/grocery items
- If you can't read the receipt clearly, return {"items": [], "error": "Could not read receipt"}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: 'Extract all grocery items from this receipt.',
              },
            ],
          },
        ],
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      throw new Error('Failed to analyze receipt');
    }

    const visionResult = await visionResponse.json();
    const content = visionResult.choices[0]?.message?.content;

    let extractedItems: string[] = [];
    try {
      const parsed = JSON.parse(content);
      extractedItems = parsed.items || [];

      if (parsed.error) {
        return new Response(
          JSON.stringify({
            success: false,
            purchasedItems: [],
            missingItems: listItems || [],
            message: "I couldn't read that receipt clearly. Try taking another photo with better lighting?",
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      extractedItems = [];
    }

    // Normalize for comparison
    const normalizeForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const purchasedNormalized = extractedItems.map(normalizeForCompare);

    // Find missing items (on list but not on receipt)
    const missingItems = (listItems || []).filter((listItem: string) => {
      const normalizedListItem = normalizeForCompare(listItem);
      // Check if any purchased item contains or matches the list item
      return !purchasedNormalized.some(purchased =>
        purchased.includes(normalizedListItem) ||
        normalizedListItem.includes(purchased) ||
        // Fuzzy match - at least 70% of characters match
        (normalizedListItem.length > 3 && purchased.includes(normalizedListItem.slice(0, Math.ceil(normalizedListItem.length * 0.7))))
      );
    });

    // Generate Mira's message
    let message: string;
    if (missingItems.length === 0) {
      message = "You got everything on your list! Nice job!";
    } else if (missingItems.length === 1) {
      message = `Wait! You still need ${missingItems[0]}.`;
    } else if (missingItems.length <= 3) {
      const lastItem = missingItems.pop();
      message = `Hold on! You still need ${missingItems.join(', ')} and ${lastItem}.`;
    } else {
      message = `You're missing ${missingItems.length} items: ${missingItems.slice(0, 3).join(', ')} and ${missingItems.length - 3} more.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchasedItems: extractedItems.map(name => ({ name })),
        missingItems,
        message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Receipt scan error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        purchasedItems: [],
        missingItems: [],
        message: "Something went wrong scanning the receipt. Try again?",
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
