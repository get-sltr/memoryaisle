// Pantry Inventory Service
// CRUD for household kitchen inventory with consumption tracking

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface PantryItem {
  id: string;
  household_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  added_date: string;
  estimated_expiry: string | null;
  auto_replenish: boolean;
  avg_consumption_days: number | null;
  last_restocked: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PANTRY_UNITS = [
  'item', 'lb', 'oz', 'kg', 'g', 'L', 'mL', 'cup', 'bag', 'box', 'can', 'bottle', 'bunch',
] as const;

export const PANTRY_CATEGORIES = [
  { id: 'produce', label: 'Produce', emoji: '🥬' },
  { id: 'dairy', label: 'Dairy', emoji: '🧀' },
  { id: 'meat', label: 'Meat & Seafood', emoji: '🥩' },
  { id: 'bakery', label: 'Bakery', emoji: '🍞' },
  { id: 'pantry', label: 'Pantry', emoji: '🥫' },
  { id: 'frozen', label: 'Frozen', emoji: '🧊' },
  { id: 'beverages', label: 'Beverages', emoji: '🥤' },
  { id: 'snacks', label: 'Snacks', emoji: '🍿' },
  { id: 'condiments', label: 'Condiments', emoji: '🧂' },
  { id: 'other', label: 'Other', emoji: '📦' },
] as const;

interface AddPantryInput {
  itemName: string;
  category?: string;
  quantity?: number;
  unit?: string;
  estimatedExpiry?: string;
  autoReplenish?: boolean;
  notes?: string;
}

class PantryService {
  // Get all pantry items for a household
  async getItems(householdId: string): Promise<{ success: boolean; items: PantryItem[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('household_id', householdId)
        .order('category', { ascending: true })
        .order('item_name', { ascending: true });

      if (error) throw error;
      return { success: true, items: data || [] };
    } catch (error: any) {
      logger.error('Error fetching pantry items:', error);
      return { success: false, items: [], error: error.message };
    }
  }

  // Add or update a pantry item (upsert on household_id + item_name)
  async addItem(
    householdId: string,
    input: AddPantryInput
  ): Promise<{ success: boolean; item?: PantryItem; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .upsert({
          household_id: householdId,
          item_name: input.itemName,
          category: input.category || 'other',
          quantity: input.quantity || 1,
          unit: input.unit || 'item',
          estimated_expiry: input.estimatedExpiry || null,
          auto_replenish: input.autoReplenish || false,
          notes: input.notes || null,
          last_restocked: new Date().toISOString(),
        }, {
          onConflict: 'household_id,item_name',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, item: data };
    } catch (error: any) {
      logger.error('Error adding pantry item:', error);
      return { success: false, error: error.message };
    }
  }

  // Update quantity (e.g., used some, restocked)
  async updateQuantity(
    itemId: string,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: any = { quantity };
      if (quantity <= 0) {
        // Item used up — could auto-add to grocery list if auto_replenish
      }
      const { error } = await supabase
        .from('pantry_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating pantry quantity:', error);
      return { success: false, error: error.message };
    }
  }

  // Update a pantry item
  async updateItem(
    itemId: string,
    updates: Partial<Pick<PantryItem, 'category' | 'quantity' | 'unit' | 'estimated_expiry' | 'auto_replenish' | 'notes'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pantry_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating pantry item:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a pantry item
  async deleteItem(itemId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error deleting pantry item:', error);
      return { success: false, error: error.message };
    }
  }

  // Get items expiring within N days
  async getExpiringItems(
    householdId: string,
    withinDays = 3
  ): Promise<{ success: boolean; items: PantryItem[]; error?: string }> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + withinDays);

      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('household_id', householdId)
        .not('estimated_expiry', 'is', null)
        .lte('estimated_expiry', futureDate.toISOString().split('T')[0])
        .order('estimated_expiry', { ascending: true });

      if (error) throw error;
      return { success: true, items: data || [] };
    } catch (error: any) {
      logger.error('Error fetching expiring items:', error);
      return { success: false, items: [], error: error.message };
    }
  }

  // Get items that need replenishment (auto_replenish = true, quantity <= 0)
  async getReplenishItems(
    householdId: string
  ): Promise<{ success: boolean; items: PantryItem[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('household_id', householdId)
        .eq('auto_replenish', true)
        .lte('quantity', 0);

      if (error) throw error;
      return { success: true, items: data || [] };
    } catch (error: any) {
      logger.error('Error fetching replenish items:', error);
      return { success: false, items: [], error: error.message };
    }
  }

  // Batch add items from a checked-off grocery list
  async addFromGroceryList(
    householdId: string,
    itemNames: string[]
  ): Promise<{ success: boolean; added: number; error?: string }> {
    try {
      let added = 0;
      for (const name of itemNames) {
        const result = await this.addItem(householdId, { itemName: name });
        if (result.success) added++;
      }
      return { success: true, added };
    } catch (error: any) {
      logger.error('Error batch adding to pantry:', error);
      return { success: false, added: 0, error: error.message };
    }
  }

  // Build pantry context string for Mira
  generateMiraPantryContext(items: PantryItem[]): string {
    if (items.length === 0) return '';

    const grouped = items.reduce<Record<string, string[]>>((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(`${item.item_name} (${item.quantity} ${item.unit})`);
      return acc;
    }, {});

    let context = '\n\n--- PANTRY INVENTORY ---\n';
    context += 'The user currently has these items in their kitchen:\n';
    for (const [category, categoryItems] of Object.entries(grouped)) {
      context += `${category}: ${categoryItems.join(', ')}\n`;
    }
    context += '\nIMPORTANT: When suggesting recipes or meal plans, check what the user already has. Only add MISSING ingredients to the shopping list. Say "You already have X, Y, Z — you just need A and B."\n';

    return context;
  }
}

export const pantryService = new PantryService();
