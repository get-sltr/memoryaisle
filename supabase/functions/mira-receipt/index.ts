// Mira Receipt Scanner - Extract items and prices, save to history, find what's missing
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

// Keyword-based item categorization (6 report buckets)
// Maps to: dairy, produce, meat, bakery, pantry, other
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  dairy: ['milk', 'cheese', 'butter', 'yogurt', 'egg', 'eggs', 'cream', 'cheddar', 'mozzarella'],
  produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'spinach', 'avocado', 'cucumber', 'pepper', 'garlic', 'lemon', 'lime', 'strawberry', 'blueberry', 'grape', 'mango', 'celery', 'kale', 'mushroom', 'zucchini', 'corn', 'pear', 'peach', 'melon', 'berry'],
  meat: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'lamb', 'ground', 'chicken', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia', 'deli', 'salami', 'prosciutto', 'pastrami'],
  bakery: ['bread', 'bagel', 'muffin', 'croissant', 'cake', 'cookie', 'donut', 'roll', 'baguette', 'tortilla', 'pita'],
  pantry: ['rice', 'pasta', 'flour', 'sugar', 'oil', 'sauce', 'soup', 'beans', 'canned', 'spice', 'frozen', 'ice cream', 'pizza', 'water', 'juice', 'soda', 'tea', 'wine', 'beer', 'cereal', 'oatmeal', 'pancake', 'waffle', 'syrup', 'coffee', 'granola', 'chips', 'candy', 'chocolate', 'popcorn', 'nuts', 'crackers', 'salsa', 'soy', 'curry', 'noodle', 'ramen', 'salt', 'vinegar', 'honey', 'jam', 'jelly', 'ketchup', 'mustard'],
};

function categorizeItem(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  return 'other';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // --- Authenticate the user via JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { image, listItems, householdId, storeName } = await req.json();

    // --- Verify user belongs to the household ---
    if (householdId) {
      const { data: membership } = await anonClient
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .eq('household_id', householdId)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ success: false, message: 'Not a member of this household' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

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
        model: 'gpt-4o-mini',
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

    // Save to purchase_history if we have householdId (user already verified as member above)
    let savedCount = 0;
    if (householdId && extractedItems.length > 0) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const purchaseRecords = extractedItems.map(item => ({
          household_id: householdId,
          item_name: item.name,
          price: item.price,
          store_name: extractedStoreName,
          category: categorizeItem(item.name),
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
    console.error('Receipt scan error:', String(error));
    return new Response(
      JSON.stringify({
        success: false,
        purchasedItems: [],
        missingItems: [],
        message: "Something went wrong scanning the receipt. Try again?",
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
