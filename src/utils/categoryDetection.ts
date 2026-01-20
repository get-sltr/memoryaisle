// Smart grocery item categorization with Supabase backend
import { supabase } from '../services/supabase';

export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'poultry'
  | 'seafood'
  | 'deli'
  | 'bakery'
  | 'frozen'
  | 'pantry'
  | 'beverages'
  | 'breakfast'
  | 'snacks'
  | 'international'
  | 'baby'
  | 'household'
  | 'other';

export interface CategoryInfo {
  id: GroceryCategory;
  label: string;
  icon: string;
  color: string;
}

// Vibrant category colors - more visible and attractive
export const CATEGORIES: Record<GroceryCategory, CategoryInfo> = {
  produce: { id: 'produce', label: 'Produce', icon: 'leaf', color: '#7ED957' },        // Lime Green
  dairy: { id: 'dairy', label: 'Dairy & Eggs', icon: 'milk', color: '#5CC8E8' },       // Sky Bloom
  meat: { id: 'meat', label: 'Meat', icon: 'meat', color: '#E85C5C' },                 // Red
  poultry: { id: 'poultry', label: 'Poultry', icon: 'poultry', color: '#FF9B5C' },     // Orange
  seafood: { id: 'seafood', label: 'Seafood', icon: 'fish', color: '#5CD8D8' },        // Teal
  deli: { id: 'deli', label: 'Deli', icon: 'sandwich', color: '#A67C52' },             // Brown
  bakery: { id: 'bakery', label: 'Bakery', icon: 'bread', color: '#FFCF5C' },          // Citrus Pop
  frozen: { id: 'frozen', label: 'Frozen', icon: 'snowflake', color: '#5C8CE8' },      // Blue
  pantry: { id: 'pantry', label: 'Pantry', icon: 'jar', color: '#8B7355' },            // Dark Brown
  beverages: { id: 'beverages', label: 'Beverages', icon: 'bottle', color: '#5CE8B8' }, // Fresh Mint
  breakfast: { id: 'breakfast', label: 'Breakfast', icon: 'coffee', color: '#FF8B70' }, // Sunset Peach
  snacks: { id: 'snacks', label: 'Snacks', icon: 'cookie', color: '#9B5CE8' },          // Violet
  international: { id: 'international', label: 'International', icon: 'globe', color: '#E85CA8' }, // Pink
  baby: { id: 'baby', label: 'Baby & Kids', icon: 'baby', color: '#E8B8D4' },           // Rose Glow
  household: { id: 'household', label: 'Household', icon: 'home', color: '#6B6B6B' },   // Dark Gray
  other: { id: 'other', label: 'Other', icon: 'basket', color: '#C8A8E8' },             // Lavender
};

// Category display order
export const CATEGORY_ORDER: GroceryCategory[] = [
  'produce',
  'dairy',
  'meat',
  'poultry',
  'seafood',
  'deli',
  'bakery',
  'frozen',
  'pantry',
  'beverages',
  'breakfast',
  'snacks',
  'international',
  'baby',
  'household',
  'other',
];

// Fallback keywords if Supabase is empty/unavailable
const FALLBACK_KEYWORDS: Record<string, GroceryCategory> = {
  // Produce
  apple: 'produce', banana: 'produce', orange: 'produce', lettuce: 'produce',
  tomato: 'produce', potato: 'produce', onion: 'produce', carrot: 'produce',
  broccoli: 'produce', spinach: 'produce', avocado: 'produce', cucumber: 'produce',
  pepper: 'produce', garlic: 'produce', lemon: 'produce', lime: 'produce',
  strawberry: 'produce', blueberry: 'produce', grape: 'produce', mango: 'produce',
  // Dairy
  milk: 'dairy', cheese: 'dairy', butter: 'dairy', yogurt: 'dairy', egg: 'dairy',
  eggs: 'dairy', cream: 'dairy', cheddar: 'dairy', mozzarella: 'dairy',
  // Meat
  beef: 'meat', steak: 'meat', pork: 'meat', bacon: 'meat', ham: 'meat',
  sausage: 'meat', lamb: 'meat', ground: 'meat',
  // Poultry
  chicken: 'poultry', turkey: 'poultry', duck: 'poultry', poultry: 'poultry',
  // Seafood
  fish: 'seafood', salmon: 'seafood', tuna: 'seafood', shrimp: 'seafood',
  crab: 'seafood', lobster: 'seafood', cod: 'seafood',
  // Deli
  deli: 'deli', salami: 'deli', prosciutto: 'deli', pastrami: 'deli',
  roast: 'deli', sliced: 'deli', sandwich: 'deli',
  // Bakery
  bread: 'bakery', bagel: 'bakery', muffin: 'bakery', croissant: 'bakery',
  cake: 'bakery', cookie: 'bakery', donut: 'bakery', roll: 'bakery',
  // Frozen
  frozen: 'frozen', 'ice cream': 'frozen', pizza: 'frozen',
  // Pantry
  rice: 'pantry', pasta: 'pantry', flour: 'pantry',
  sugar: 'pantry', oil: 'pantry', sauce: 'pantry', soup: 'pantry',
  beans: 'pantry', canned: 'pantry', spice: 'pantry',
  // Beverages
  water: 'beverages', juice: 'beverages', soda: 'beverages',
  tea: 'beverages', wine: 'beverages', beer: 'beverages',
  // Breakfast
  cereal: 'breakfast', oatmeal: 'breakfast', pancake: 'breakfast', waffle: 'breakfast',
  syrup: 'breakfast', coffee: 'breakfast', granola: 'breakfast',
  // Snacks
  chips: 'snacks', candy: 'snacks', chocolate: 'snacks', popcorn: 'snacks',
  nuts: 'snacks', crackers: 'snacks',
  // International
  salsa: 'international', tortilla: 'international', soy: 'international',
  curry: 'international', noodle: 'international', ramen: 'international',
  // Baby
  baby: 'baby', diaper: 'baby', formula: 'baby', wipes: 'baby',
  // Household
  paper: 'household', soap: 'household', detergent: 'household', cleaner: 'household',
  tissue: 'household', towel: 'household', trash: 'household',
};

// Cache keywords on app load
let keywordCache: Map<string, string> | null = null;
let cacheLoadPromise: Promise<Map<string, string>> | null = null;

async function loadKeywords(): Promise<Map<string, string>> {
  if (keywordCache) return keywordCache;

  // Prevent multiple simultaneous loads
  if (cacheLoadPromise) return cacheLoadPromise;

  cacheLoadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('category_keywords')
        .select('keyword, category_id, priority')
        .order('priority', { ascending: false });

      if (error) throw error;

      keywordCache = new Map();

      // Load from Supabase
      if (data && data.length > 0) {
        data.forEach(row => {
          if (!keywordCache!.has(row.keyword.toLowerCase())) {
            keywordCache!.set(row.keyword.toLowerCase(), row.category_id);
          }
        });
      }

      // Add fallback keywords (won't override DB keywords)
      Object.entries(FALLBACK_KEYWORDS).forEach(([keyword, category]) => {
        if (!keywordCache!.has(keyword.toLowerCase())) {
          keywordCache!.set(keyword.toLowerCase(), category);
        }
      });

      return keywordCache;
    } catch (error) {
      console.error('Failed to load keywords from DB:', error);
      // Use fallback keywords only
      keywordCache = new Map(Object.entries(FALLBACK_KEYWORDS));
      return keywordCache;
    } finally {
      cacheLoadPromise = null;
    }
  })();

  return cacheLoadPromise;
}

// Refresh cache when needed (e.g., app foreground, every 24 hrs)
export function invalidateKeywordCache() {
  keywordCache = null;
  cacheLoadPromise = null;
}

// Preload keywords on app start
export async function preloadKeywords(): Promise<void> {
  await loadKeywords();
}

/**
 * Detects the category of a grocery item based on its name (async version)
 */
export async function detectCategoryAsync(itemName: string): Promise<GroceryCategory> {
  const keywords = await loadKeywords();
  const normalized = itemName.toLowerCase().trim();

  // Exact match first
  if (keywords.has(normalized)) {
    return keywords.get(normalized) as GroceryCategory;
  }

  // Partial match - check if item contains any keyword
  for (const [keyword, category] of keywords) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      return category as GroceryCategory;
    }
  }

  // Word-level partial match
  const nameParts = normalized.split(' ');
  for (const [keyword, category] of keywords) {
    const keywordParts = keyword.split(' ');
    for (const kPart of keywordParts) {
      for (const nPart of nameParts) {
        if (kPart.length > 2 && nPart.length > 2) {
          if (kPart === nPart || kPart.includes(nPart) || nPart.includes(kPart)) {
            return category as GroceryCategory;
          }
        }
      }
    }
  }

  return 'other';
}

/**
 * Sync version - uses cached data, returns 'other' if cache not loaded
 */
export function detectCategory(itemName: string): GroceryCategory {
  if (!keywordCache || keywordCache.size === 0) {
    // Trigger async load for next time
    loadKeywords();
    return 'other';
  }

  const normalized = itemName.toLowerCase().trim();

  // Exact match first
  if (keywordCache.has(normalized)) {
    return keywordCache.get(normalized) as GroceryCategory;
  }

  // Partial match
  for (const [keyword, category] of keywordCache) {
    if (normalized.includes(keyword) || keyword.includes(normalized)) {
      return category as GroceryCategory;
    }
  }

  // Word-level partial match
  const nameParts = normalized.split(' ');
  for (const [keyword, category] of keywordCache) {
    const keywordParts = keyword.split(' ');
    for (const kPart of keywordParts) {
      for (const nPart of nameParts) {
        if (kPart.length > 2 && nPart.length > 2) {
          if (kPart === nPart || kPart.includes(nPart) || nPart.includes(kPart)) {
            return category as GroceryCategory;
          }
        }
      }
    }
  }

  return 'other';
}

/**
 * Gets category info for display
 */
export function getCategoryInfo(category: GroceryCategory): CategoryInfo {
  return CATEGORIES[category];
}

/**
 * Groups items by category and returns them in display order
 */
export function groupItemsByCategory<T extends { name: string }>(
  items: T[]
): Map<GroceryCategory, T[]> {
  const grouped = new Map<GroceryCategory, T[]>();

  // Initialize all categories
  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }

  // Sort items into categories
  for (const item of items) {
    const category = detectCategory(item.name);
    grouped.get(category)!.push(item);
  }

  // Remove empty categories
  for (const category of CATEGORY_ORDER) {
    if (grouped.get(category)!.length === 0) {
      grouped.delete(category);
    }
  }

  return grouped;
}
