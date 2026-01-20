import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

const FAVORITES_KEY = '@memoryaisle_favorites';

export interface FavoriteItem {
  id: string;
  name: string;
  emoji?: string;
  count: number; // Times purchased
  isFavorite: boolean; // Manually marked as favorite
  lastPurchased?: string;
}

// Get frequently purchased items from database
export async function getFrequentItems(householdId: string): Promise<FavoriteItem[]> {
  try {
    // Get completed items grouped by name, count occurrences
    const { data, error } = await supabase
      .from('list_items')
      .select(`
        name,
        is_completed,
        created_at,
        grocery_lists!inner(household_id)
      `)
      .eq('grocery_lists.household_id', householdId)
      .eq('is_completed', true);

    if (error) throw error;

    // Group by name and count
    const itemCounts: Record<string, { count: number; lastPurchased: string }> = {};

    for (const item of data || []) {
      const normalizedName = item.name.trim();
      if (!itemCounts[normalizedName]) {
        itemCounts[normalizedName] = { count: 0, lastPurchased: item.created_at };
      }
      itemCounts[normalizedName].count++;
      if (item.created_at > itemCounts[normalizedName].lastPurchased) {
        itemCounts[normalizedName].lastPurchased = item.created_at;
      }
    }

    // Get user's manual favorites
    const manualFavorites = await getManualFavorites();

    // Convert to array and sort by count
    const items: FavoriteItem[] = Object.entries(itemCounts)
      .map(([name, data]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        emoji: getEmojiForItem(name),
        count: data.count,
        isFavorite: manualFavorites.includes(name.toLowerCase()),
        lastPurchased: data.lastPurchased,
      }))
      .sort((a, b) => {
        // Favorites first, then by count
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

// Get manually saved favorites from local storage
export async function getManualFavorites(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    logger.error('Error getting manual favorites:', error);
    return [];
  }
}

// Toggle favorite status for an item
export async function toggleFavorite(itemName: string): Promise<boolean> {
  try {
    const favorites = await getManualFavorites();
    const normalizedName = itemName.toLowerCase();

    let newFavorites: string[];
    let isNowFavorite: boolean;

    if (favorites.includes(normalizedName)) {
      // Remove from favorites
      newFavorites = favorites.filter(f => f !== normalizedName);
      isNowFavorite = false;
    } else {
      // Add to favorites
      newFavorites = [...favorites, normalizedName];
      isNowFavorite = true;
    }

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    return isNowFavorite;
  } catch (error) {
    logger.error('Error toggling favorite:', error);
    return false;
  }
}

// Add a custom favorite item (user entered)
export async function addCustomFavorite(itemName: string): Promise<boolean> {
  try {
    const favorites = await getManualFavorites();
    const normalizedName = itemName.toLowerCase();

    if (!favorites.includes(normalizedName)) {
      favorites.push(normalizedName);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
    return true;
  } catch (error) {
    logger.error('Error adding custom favorite:', error);
    return false;
  }
}

// Remove a favorite
export async function removeFavorite(itemName: string): Promise<boolean> {
  try {
    const favorites = await getManualFavorites();
    const normalizedName = itemName.toLowerCase();
    const newFavorites = favorites.filter(f => f !== normalizedName);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
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
    // Dairy
    'milk': '🥛',
    'whole milk': '🥛',
    'skim milk': '🥛',
    'eggs': '🥚',
    'cheese': '🧀',
    'cheddar': '🧀',
    'butter': '🧈',
    'yogurt': '🫙',
    'greek yogurt': '🫙',
    'cream': '🥛',

    // Fruits
    'banana': '🍌',
    'bananas': '🍌',
    'apple': '🍎',
    'apples': '🍎',
    'orange': '🍊',
    'oranges': '🍊',
    'lemon': '🍋',
    'lemons': '🍋',
    'strawberry': '🍓',
    'strawberries': '🍓',
    'grape': '🍇',
    'grapes': '🍇',
    'watermelon': '🍉',
    'avocado': '🥑',
    'avocados': '🥑',
    'peach': '🍑',
    'peaches': '🍑',
    'mango': '🥭',
    'mangos': '🥭',
    'pineapple': '🍍',
    'coconut': '🥥',
    'cherry': '🍒',
    'cherries': '🍒',
    'blueberry': '🫐',
    'blueberries': '🫐',

    // Vegetables
    'carrot': '🥕',
    'carrots': '🥕',
    'broccoli': '🥦',
    'lettuce': '🥬',
    'spinach': '🥬',
    'corn': '🌽',
    'potato': '🥔',
    'potatoes': '🥔',
    'tomato': '🍅',
    'tomatoes': '🍅',
    'onion': '🧅',
    'onions': '🧅',
    'garlic': '🧄',
    'cucumber': '🥒',
    'pepper': '🌶️',
    'peppers': '🫑',
    'mushroom': '🍄',
    'mushrooms': '🍄',
    'eggplant': '🍆',

    // Bread & Grains
    'bread': '🍞',
    'sourdough': '🍞',
    'bagel': '🥯',
    'bagels': '🥯',
    'croissant': '🥐',
    'rice': '🍚',
    'pasta': '🍝',
    'cereal': '🥣',
    'oatmeal': '🥣',

    // Meat & Protein
    'chicken': '🍗',
    'chicken breast': '🍗',
    'beef': '🥩',
    'steak': '🥩',
    'bacon': '🥓',
    'ham': '🍖',
    'turkey': '🦃',
    'fish': '🐟',
    'salmon': '🐟',
    'shrimp': '🦐',
    'sausage': '🌭',

    // Drinks
    'coffee': '☕',
    'tea': '🍵',
    'juice': '🧃',
    'orange juice': '🍊',
    'water': '💧',
    'wine': '🍷',
    'beer': '🍺',
    'soda': '🥤',

    // Snacks
    'chocolate': '🍫',
    'cookie': '🍪',
    'cookies': '🍪',
    'cake': '🍰',
    'ice cream': '🍦',
    'chips': '🥔',
    'popcorn': '🍿',
    'candy': '🍬',
    'nuts': '🌰',
    'peanuts': '🥜',
    'almonds': '🫘',
    'walnuts': '🌰',
    'cashews': '🌰',
    'pecans': '🌰',
    'pistachios': '🫛',

    // Pantry & Condiments
    'honey': '🍯',
    'salt': '🧂',
    'oil': '🫒',
    'olive oil': '🫒',
    'jam': '🫙',
    'jelly': '🫙',
    'peanut butter': '🫙',
    'nutella': '🫙',
    'mayo': '🫙',
    'mayonnaise': '🫙',
    'mustard': '🫙',
    'ketchup': '🫙',
    'sauce': '🫙',
    'syrup': '🫙',
    'maple syrup': '🍁',
    'pickles': '🥒',
    'olives': '🫒',
    'soup': '🥣',
    'beans': '🫘',
    'flour': '🌾',
    'sugar': '🧊',
  };

  // Check for exact match first
  if (emojiMap[lowerName]) {
    return emojiMap[lowerName];
  }

  // Check for partial match
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return emoji;
    }
  }

  // Default emoji - simple dot instead of shopping cart
  return '•';
}
