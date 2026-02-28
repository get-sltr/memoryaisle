import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface FavoriteItem {
  id: string;
  name: string;
  emoji?: string;
  count: number;
  isFavorite: boolean;
  lastPurchased?: string;
}

// Get frequently purchased items from database
export async function getFrequentItems(householdId: string): Promise<FavoriteItem[]> {
  try {
    // Get completed items grouped by name from list_items
    const { data: listData, error: listError } = await supabase
      .from('list_items')
      .select(`
        name,
        is_completed,
        created_at,
        grocery_lists!inner(household_id)
      `)
      .eq('grocery_lists.household_id', householdId)
      .eq('is_completed', true);

    if (listError) throw listError;

    // Group by name and count
    const itemCounts: Record<string, { count: number; lastPurchased: string }> = {};

    for (const item of listData || []) {
      const normalizedName = item.name.trim();
      if (!itemCounts[normalizedName]) {
        itemCounts[normalizedName] = { count: 0, lastPurchased: item.created_at };
      }
      itemCounts[normalizedName].count++;
      if (item.created_at > itemCounts[normalizedName].lastPurchased) {
        itemCounts[normalizedName].lastPurchased = item.created_at;
      }
    }

    // Get user's favorites from Supabase
    const manualFavorites = await getManualFavorites(householdId);
    const favoriteNames = manualFavorites.map(f => f.item_name.toLowerCase());

    // Add manual favorites that aren't in purchase history
    for (const fav of manualFavorites) {
      if (!itemCounts[fav.item_name]) {
        itemCounts[fav.item_name] = { count: 0, lastPurchased: fav.created_at };
      }
    }

    // Filter out recipe-style items (e.g., "3 cups of grated carrots", "1/2 lb ground beef")
    const isRecipeItem = (name: string) => /^\d/.test(name.trim());

    // Convert to array and sort
    const items: FavoriteItem[] = Object.entries(itemCounts)
      .filter(([name, data]) => {
        // Always keep manual favorites
        if (favoriteNames.includes(name.toLowerCase())) return true;
        // For frequent items: require 2+ purchases and skip recipe-style names
        return data.count >= 2 && !isRecipeItem(name);
      })
      .map(([name, data]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        emoji: getEmojiForItem(name),
        count: data.count,
        isFavorite: favoriteNames.includes(name.toLowerCase()),
        lastPurchased: data.lastPurchased,
      }))
      .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return b.count - a.count;
      });

    return items;
  } catch (error) {
    logger.error('Error getting frequent items:', error);
    return [];
  }
}

// Get favorites from Supabase
export async function getManualFavorites(householdId: string): Promise<{ item_name: string; created_at: string }[]> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('item_name, created_at')
      .eq('household_id', householdId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error getting manual favorites:', error);
    return [];
  }
}

// Toggle favorite status for an item
export async function toggleFavorite(householdId: string, itemName: string): Promise<boolean> {
  try {
    const normalizedName = itemName.trim();

    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('household_id', householdId)
      .eq('item_name', normalizedName)
      .single();

    if (existing) {
      // Remove from favorites
      await supabase
        .from('favorites')
        .delete()
        .eq('household_id', householdId)
        .eq('item_name', normalizedName);
      return false;
    } else {
      // Add to favorites
      await supabase
        .from('favorites')
        .insert({
          household_id: householdId,
          item_name: normalizedName,
          emoji: getEmojiForItem(normalizedName),
        });
      return true;
    }
  } catch (error) {
    logger.error('Error toggling favorite:', error);
    return false;
  }
}

// Add a custom favorite item
export async function addCustomFavorite(householdId: string, itemName: string): Promise<boolean> {
  try {
    const normalizedName = itemName.trim();

    const { error } = await supabase
      .from('favorites')
      .upsert({
        household_id: householdId,
        item_name: normalizedName,
        emoji: getEmojiForItem(normalizedName),
      }, {
        onConflict: 'household_id,item_name'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Error adding custom favorite:', error);
    return false;
  }
}

// Remove a favorite
export async function removeFavorite(householdId: string, itemName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('household_id', householdId)
      .eq('item_name', itemName.trim());

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Error removing favorite:', error);
    return false;
  }
}

// Get emoji for common grocery items
function getEmojiForItem(name: string): string {
  const lowerName = name.toLowerCase();

  const emojiMap: Record<string, string> = {
    'milk': '🥛', 'whole milk': '🥛', 'skim milk': '🥛',
    'eggs': '🥚', 'cheese': '🧀', 'cheddar': '🧀',
    'butter': '🧈', 'yogurt': '🫙', 'greek yogurt': '🫙', 'cream': '🥛',
    'banana': '🍌', 'bananas': '🍌', 'apple': '🍎', 'apples': '🍎',
    'orange': '🍊', 'oranges': '🍊', 'lemon': '🍋', 'lemons': '🍋',
    'strawberry': '🍓', 'strawberries': '🍓', 'grape': '🍇', 'grapes': '🍇',
    'watermelon': '🍉', 'avocado': '🥑', 'avocados': '🥑',
    'peach': '🍑', 'peaches': '🍑', 'mango': '🥭', 'mangos': '🥭',
    'pineapple': '🍍', 'coconut': '🥥', 'cherry': '🍒', 'cherries': '🍒',
    'blueberry': '🫐', 'blueberries': '🫐',
    'carrot': '🥕', 'carrots': '🥕', 'broccoli': '🥦',
    'lettuce': '🥬', 'spinach': '🥬', 'corn': '🌽',
    'potato': '🥔', 'potatoes': '🥔', 'tomato': '🍅', 'tomatoes': '🍅',
    'onion': '🧅', 'onions': '🧅', 'garlic': '🧄',
    'cucumber': '🥒', 'pepper': '🌶️', 'peppers': '🫑',
    'mushroom': '🍄', 'mushrooms': '🍄', 'eggplant': '🍆',
    'bread': '🍞', 'sourdough': '🍞', 'bagel': '🥯', 'bagels': '🥯',
    'croissant': '🥐', 'rice': '🍚', 'pasta': '🍝',
    'cereal': '🥣', 'oatmeal': '🥣',
    'chicken': '🍗', 'chicken breast': '🍗', 'beef': '🥩', 'steak': '🥩',
    'bacon': '🥓', 'ham': '🍖', 'turkey': '🦃',
    'fish': '🐟', 'salmon': '🐟', 'shrimp': '🦐', 'sausage': '🌭',
    'coffee': '☕', 'tea': '🍵', 'juice': '🧃', 'orange juice': '🍊',
    'water': '💧', 'wine': '🍷', 'beer': '🍺', 'soda': '🥤',
    'chocolate': '🍫', 'cookie': '🍪', 'cookies': '🍪',
    'cake': '🍰', 'ice cream': '🍦', 'chips': '🥔',
    'popcorn': '🍿', 'candy': '🍬', 'nuts': '🌰',
    'peanuts': '🥜', 'almonds': '🫘', 'honey': '🍯', 'salt': '🧂',
    'oil': '🫒', 'olive oil': '🫒', 'jam': '🫙', 'jelly': '🫙',
    'peanut butter': '🫙', 'nutella': '🫙', 'mayo': '🫙', 'mayonnaise': '🫙',
    'mustard': '🫙', 'ketchup': '🫙', 'sauce': '🫙', 'syrup': '🫙',
    'maple syrup': '🍁', 'pickles': '🥒', 'olives': '🫒',
    'soup': '🥣', 'beans': '🫘', 'flour': '🌾', 'sugar': '🧊',
  };

  if (emojiMap[lowerName]) return emojiMap[lowerName];

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) return emoji;
  }

  return '•';
}
