// Object Detection Edge Function
// Uses Google Cloud Vision API for grocery item and receipt detection

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://memoryaisle.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Cloud Vision API endpoint
const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

interface VisionRequest {
  image: string;
  detectGroceries?: boolean;
  detectReceipt?: boolean;
}

interface DetectedObject {
  name: string;
  confidence: number;
  boundingPoly?: {
    vertices: Array<{ x: number; y: number }>;
  };
}

interface ReceiptItem {
  name: string;
  quantity?: number;
  price?: number;
  confidence: number;
}

// Common grocery items for filtering Vision API results
const GROCERY_KEYWORDS = [
  'food', 'fruit', 'vegetable', 'meat', 'dairy', 'bread', 'beverage',
  'produce', 'grocery', 'snack', 'drink', 'bottle', 'can', 'box',
  'package', 'bag', 'carton', 'container', 'jar', 'packet',
  // Specific items
  'apple', 'banana', 'orange', 'tomato', 'potato', 'onion', 'carrot',
  'milk', 'cheese', 'yogurt', 'butter', 'egg', 'bread', 'rice', 'pasta',
  'chicken', 'beef', 'fish', 'pork', 'turkey', 'salmon',
  'cereal', 'coffee', 'tea', 'juice', 'water', 'soda', 'wine', 'beer',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image, detectGroceries, detectReceipt }: VisionRequest = await req.json();

    if (!image) {
      throw new Error('No image provided');
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('Google Cloud API key not configured');
    }

    // Build Vision API request based on detection type
    const features: Array<{ type: string; maxResults?: number }> = [];

    if (detectReceipt) {
      features.push({ type: 'TEXT_DETECTION' });
      features.push({ type: 'DOCUMENT_TEXT_DETECTION' });
    } else {
      features.push({ type: 'OBJECT_LOCALIZATION', maxResults: 20 });
      features.push({ type: 'LABEL_DETECTION', maxResults: 20 });
    }

    const visionRequest = {
      requests: [
        {
          image: { content: image },
          features,
        },
      ],
    };

    // Call Google Cloud Vision API
    const visionResponse = await fetch(`${VISION_API_URL}?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionRequest),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      throw new Error('Vision API request failed');
    }

    const visionData = await visionResponse.json();
    const response = visionData.responses?.[0];

    if (detectReceipt) {
      // Process receipt text detection
      const items = parseReceiptText(response);
      return new Response(
        JSON.stringify({ items }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Process object and label detection
      const objects = processDetectedObjects(response, detectGroceries || false);
      return new Response(
        JSON.stringify({ objects }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in detect-objects:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Detection failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Process detected objects from Vision API
function processDetectedObjects(response: any, filterGroceries: boolean): DetectedObject[] {
  const objects: DetectedObject[] = [];
  const seenNames = new Set<string>();

  // Process localized objects
  const localizedObjects = response.localizedObjectAnnotations || [];
  for (const obj of localizedObjects) {
    const name = obj.name?.toLowerCase() || '';
    const confidence = obj.score || 0;

    // Skip duplicates
    if (seenNames.has(name)) continue;

    // Filter for grocery items if requested
    if (filterGroceries) {
      const isGroceryRelated = GROCERY_KEYWORDS.some(keyword =>
        name.includes(keyword) || keyword.includes(name)
      );
      if (!isGroceryRelated && confidence < 0.8) continue;
    }

    seenNames.add(name);
    objects.push({
      name: capitalizeFirst(name),
      confidence,
      boundingPoly: obj.boundingPoly,
    });
  }

  // Process labels (for additional context)
  const labels = response.labelAnnotations || [];
  for (const label of labels) {
    const name = label.description?.toLowerCase() || '';
    const confidence = label.score || 0;

    if (seenNames.has(name)) continue;
    if (confidence < 0.7) continue;

    // Only include food/grocery related labels
    const isGroceryRelated = GROCERY_KEYWORDS.some(keyword =>
      name.includes(keyword) || keyword.includes(name)
    );

    if (isGroceryRelated || (!filterGroceries && confidence > 0.85)) {
      seenNames.add(name);
      objects.push({
        name: capitalizeFirst(name),
        confidence,
      });
    }
  }

  // Sort by confidence
  return objects.sort((a, b) => b.confidence - a.confidence).slice(0, 15);
}

// Parse receipt text to extract items
function parseReceiptText(response: any): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const fullText = response.fullTextAnnotation?.text || '';

  if (!fullText) return items;

  // Split into lines
  const lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l);

  // Patterns for receipt items
  const itemPatterns = [
    // Item name followed by price (e.g., "Bananas 2.99")
    /^([A-Za-z\s]+)\s+\$?(\d+\.\d{2})$/,
    // Item with quantity (e.g., "2x Milk 5.98")
    /^(\d+)x?\s+([A-Za-z\s]+)\s+\$?(\d+\.\d{2})$/,
    // Just item names (common grocery terms)
    /^([A-Za-z\s]{3,30})$/,
  ];

  for (const line of lines) {
    // Skip header/footer common text
    if (isReceiptBoilerplate(line)) continue;

    for (const pattern of itemPatterns) {
      const match = line.match(pattern);
      if (match) {
        let name: string;
        let quantity: number | undefined;
        let price: number | undefined;

        if (match.length === 4) {
          // Pattern with quantity
          quantity = parseInt(match[1]);
          name = match[2].trim();
          price = parseFloat(match[3]);
        } else if (match.length === 3) {
          // Pattern with price
          name = match[1].trim();
          price = parseFloat(match[2]);
        } else {
          // Just name
          name = match[1].trim();
        }

        // Validate it looks like a grocery item
        if (name.length >= 3 && name.length <= 30 && !isReceiptBoilerplate(name)) {
          items.push({
            name: capitalizeFirst(name),
            quantity,
            price,
            confidence: 0.85,
          });
        }
        break;
      }
    }
  }

  return items;
}

// Check if text is common receipt boilerplate
function isReceiptBoilerplate(text: string): boolean {
  const boilerplate = [
    'total', 'subtotal', 'tax', 'change', 'cash', 'credit', 'debit',
    'thank you', 'receipt', 'store', 'welcome', 'date', 'time',
    'phone', 'address', 'www', 'http', '.com', 'tel:', 'fax:',
  ];

  const lower = text.toLowerCase();
  return boilerplate.some(bp => lower.includes(bp));
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
