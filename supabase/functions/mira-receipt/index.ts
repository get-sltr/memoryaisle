// Mira Receipt Scanner - Extract items and prices, save to history, find what's missing
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://memoryaisle.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { image, listItems, householdId, storeName } = await req.json();

    if (!image) {
      throw new Error('No receipt image provided');
    }

    // Use GPT-4 Vision to extract items AND prices from receipt
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
            content: `You are a receipt scanner. Extract all purchased items WITH PRICES from this grocery receipt image.

Return JSON only:
{
  "items": [
    {"name": "Item Name", "price": 3.99},
    {"name": "Another Item", "price": 5.49}
  ],
  "storeName": "Store Name if visible",
  "total": 45.67
}

Rules:
- Extract product names AND their prices
- Normalize names (e.g., "ORG BANANAS" → "Bananas", "2% MILK GAL" → "Milk")
- Price should be a number, not a string
- Remove store codes, SKUs, and abbreviations
- Focus on food/grocery items
- If price is unclear, use null
- Extract store name from receipt header if visible
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
                text: 'Extract all grocery items with their prices from this receipt.',
              },
            ],
          },
        ],
        max_tokens: 1000,
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

    let extractedItems: Array<{name: string, price: number | null}> = [];
    let extractedStoreName: string | null = null;
    let extractedTotal: number | null = null;
    
    try {
      const parsed = JSON.parse(content);
      extractedItems = parsed.items || [];
      extractedStoreName = parsed.storeName || storeName || null;
      extractedTotal = parsed.total || null;

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

    // Save to purchase_history if we have householdId and Supabase is configured
    let savedCount = 0;
    if (householdId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && extractedItems.length > 0) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const purchaseRecords = extractedItems.map(item => ({
          household_id: householdId,
          item_name: item.name,
          price: item.price,
          store_name: extractedStoreName,
          purchased_at: new Date().toISOString(),
          source: 'receipt_ocr'
        }));

        const { data, error } = await supabase
          .from('purchase_history')
          .insert(purchaseRecords);

        if (error) {
          console.error('Failed to save purchase history:', error);
        } else {
          savedCount = purchaseRecords.length;
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Normalize for comparison
    const normalizeForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const purchasedNormalized = extractedItems.map(item => normalizeForCompare(item.name));

    // Find missing items (on list but not on receipt)
    const missingItems = (listItems || []).filter((listItem: string) => {
      const normalizedListItem = normalizeForCompare(listItem);
      return !purchasedNormalized.some(purchased =>
        purchased.includes(normalizedListItem) ||
        normalizedListItem.includes(purchased) ||
        (normalizedListItem.length > 3 && purchased.includes(normalizedListItem.slice(0, Math.ceil(normalizedListItem.length * 0.7))))
      );
    });

    // Generate Mira's message
    let message: string;
    if (missingItems.length === 0) {
      message = savedCount > 0 
        ? `You got everything! I saved ${savedCount} items to your purchase history.`
        : "You got everything on your list! Nice job!";
    } else if (missingItems.length === 1) {
      message = `Wait! You still need ${missingItems[0]}.`;
    } else if (missingItems.length <= 3) {
      const itemsCopy = [...missingItems];
      const lastItem = itemsCopy.pop();
      message = `Hold on! You still need ${itemsCopy.join(', ')} and ${lastItem}.`;
    } else {
      message = `You're missing ${missingItems.length} items: ${missingItems.slice(0, 3).join(', ')} and ${missingItems.length - 3} more.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchasedItems: extractedItems,
        missingItems,
        storeName: extractedStoreName,
        total: extractedTotal,
        savedToHistory: savedCount,
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
