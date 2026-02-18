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

  const byCategory: Record<string, number> = {};
  (data || []).forEach((row) => {
    const cat = row.category || 'other';
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
  return (data || []) as PurchaseItem[];
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
