import { supabase } from './supabase';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface CategorySpending {
  category: string;
  total: number;
}

export interface PurchaseItem {
  id: string;
  item_name: string;
  price: number | null;
  category: string;
  store_name: string | null;
  purchased_at: string;
}

// Client-side category keywords — ensures correct display even if DB has 'other'
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  dairy: ['milk', 'cheese', 'butter', 'yogurt', 'egg', 'eggs', 'cream', 'cheddar', 'mozzarella', 'sour cream', 'cottage', 'ricotta', 'parmesan', 'gouda', 'brie', 'feta', 'whey', 'ghee'],
  produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'spinach', 'avocado', 'cucumber', 'pepper', 'garlic', 'lemon', 'lime', 'strawberry', 'blueberry', 'grape', 'mango', 'celery', 'kale', 'mushroom', 'zucchini', 'corn', 'pear', 'peach', 'melon', 'berry', 'watermelon', 'pineapple', 'cherry', 'plum', 'ginger', 'cilantro', 'parsley', 'basil', 'mint', 'asparagus', 'cabbage', 'cauliflower', 'radish', 'beet', 'squash', 'sweet potato', 'yam', 'plantain', 'fig', 'pomegranate', 'kiwi', 'papaya', 'coconut', 'artichoke', 'leek', 'scallion', 'green bean', 'snap pea', 'eggplant', 'jalapeno', 'habanero', 'serrano'],
  meat: ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'lamb', 'ground', 'chicken', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia', 'deli', 'salami', 'prosciutto', 'pastrami', 'wing', 'drumstick', 'thigh', 'breast', 'ribeye', 'sirloin', 'tenderloin', 'brisket', 'roast', 'meatball', 'patty', 'chorizo', 'pepperoni', 'anchovy', 'sardine', 'trout', 'catfish', 'mahi', 'scallop', 'clam', 'mussel', 'oyster', 'calamari', 'octopus'],
  bakery: ['bread', 'bagel', 'muffin', 'croissant', 'cake', 'cookie', 'donut', 'roll', 'baguette', 'tortilla', 'pita', 'naan', 'flatbread', 'sourdough', 'rye', 'brioche', 'scone', 'biscuit', 'pie', 'pastry', 'danish', 'cinnamon roll'],
  pantry: ['rice', 'pasta', 'flour', 'sugar', 'oil', 'olive oil', 'sauce', 'soup', 'beans', 'canned', 'spice', 'frozen', 'ice cream', 'pizza', 'water', 'juice', 'soda', 'tea', 'wine', 'beer', 'cereal', 'oatmeal', 'pancake', 'waffle', 'syrup', 'coffee', 'granola', 'chips', 'candy', 'chocolate', 'popcorn', 'nuts', 'crackers', 'salsa', 'soy', 'curry', 'noodle', 'ramen', 'salt', 'vinegar', 'honey', 'jam', 'jelly', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'dressing', 'broth', 'stock', 'quinoa', 'couscous', 'lentil', 'chickpea', 'peanut butter', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'trail mix', 'granola bar', 'protein', 'tortilla chip', 'pretzel', 'olive'],
};

function recategorize(name: string, dbCategory: string): string {
  if (dbCategory !== 'other' && dbCategory !== '') return dbCategory;
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }
  return 'other';
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

export async function getMonthlySpending(
  householdId: string,
  year: number,
  month: number
): Promise<number> {
  const { start, end } = getMonthRange(year, month);

  const { data, error } = await supabase
    .from('purchase_history')
    .select('price')
    .eq('household_id', householdId)
    .gte('purchased_at', start)
    .lt('purchased_at', end);

  if (error) throw error;

  return (data || []).reduce((sum, row) => sum + (row.price || 0), 0);
}

export async function getSpendingByCategory(
  householdId: string,
  year: number,
  month: number
): Promise<CategorySpending[]> {
  const { start, end } = getMonthRange(year, month);

  const { data, error } = await supabase
    .from('purchase_history')
    .select('category, price')
    .eq('household_id', householdId)
    .gte('purchased_at', start)
    .lt('purchased_at', end);

  if (error) throw error;

  // Fetch item names too so we can recategorize client-side
  const { data: itemData } = await supabase
    .from('purchase_history')
    .select('item_name, category, price')
    .eq('household_id', householdId)
    .gte('purchased_at', start)
    .lt('purchased_at', end);

  const byCategory: Record<string, number> = {};
  (itemData || data || []).forEach((row: any) => {
    const cat = row.item_name
      ? recategorize(row.item_name, row.category || 'other')
      : (row.category || 'other');
    byCategory[cat] = (byCategory[cat] || 0) + (row.price || 0);
  });

  return Object.entries(byCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getPurchaseItems(
  householdId: string,
  year: number,
  month: number
): Promise<PurchaseItem[]> {
  const { start, end } = getMonthRange(year, month);

  const { data, error } = await supabase
    .from('purchase_history')
    .select('id, item_name, price, category, store_name, purchased_at')
    .eq('household_id', householdId)
    .gte('purchased_at', start)
    .lt('purchased_at', end)
    .order('purchased_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    category: recategorize(row.item_name, row.category || 'other'),
  })) as PurchaseItem[];
}

export async function exportMonthToCSV(
  householdId: string,
  year: number,
  month: number
): Promise<void> {
  const items = await getPurchaseItems(householdId, year, month);

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });
  const header = 'Item,Price,Category,Store,Date\n';
  const rows = items
    .map((item) => {
      const price = item.price != null ? item.price.toFixed(2) : '';
      const name = `"${item.item_name.replace(/"/g, '""')}"`;
      const store = item.store_name ? `"${item.store_name.replace(/"/g, '""')}"` : '';
      const date = new Date(item.purchased_at).toLocaleDateString('en-US');
      return `${name},${price},${item.category},${store},${date}`;
    })
    .join('\n');

  const csv = header + rows;
  const fileName = `MemoryAisle_${monthName}_${year}.csv`;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: `${monthName} ${year} Purchase Report`,
    UTI: 'public.comma-separated-values-text',
  });
}
