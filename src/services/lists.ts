import { supabase } from './supabase';
import type { GroceryList, ListItem } from '../types';

// Get or create the active list for a household
export async function getActiveList(householdId: string): Promise<GroceryList | null> {
  try {
    // Try to find existing active list
    let { data: list, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If no active list, create one
    if (error?.code === 'PGRST116' || !list) {
      const { data: newList, error: createError } = await supabase
        .from('grocery_lists')
        .insert({
          household_id: householdId,
          name: 'Shopping List',
          status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;
      list = newList;
    } else if (error) {
      throw error;
    }

    return list;
  } catch (error) {
    console.error('Error getting active list:', error);
    return null;
  }
}

// Get items for a list with user names
export async function getListItems(listId: string): Promise<ListItem[]> {
  try {
    const { data, error } = await supabase
      .from('list_items')
      .select(`
        *,
        users:added_by (name)
      `)
      .eq('list_id', listId)
      .eq('is_completed', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Map the user name to added_by_name
    return (data || []).map((item: any) => ({
      ...item,
      added_by_name: item.users?.name,
      users: undefined,
    }));
  } catch (error) {
    console.error('Error getting list items:', error);
    return [];
  }
}

// Add item to list
export async function addItem(
  listId: string,
  name: string,
  quantity: number = 1,
  source: 'manual' | 'ai_suggested' | 'voice' = 'manual'
): Promise<ListItem | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('list_items')
      .insert({
        list_id: listId,
        name,
        quantity,
        added_by: user.id,
        source,
      })
      .select(`
        *,
        users:added_by (name)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      added_by_name: data.users?.name,
      users: undefined,
    };
  } catch (error) {
    console.error('Error adding item:', error);
    return null;
  }
}

// Mark item as completed
export async function completeItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('list_items')
      .update({ is_completed: true })
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error completing item:', error);
    return false;
  }
}

// Delete item from list
export async function deleteItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
}

// Update item quantity
export async function updateItemQuantity(itemId: string, quantity: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('list_items')
      .update({ quantity })
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating quantity:', error);
    return false;
  }
}

// Subscribe to realtime list changes
export function subscribeToList(
  listId: string,
  onInsert: (item: ListItem) => void,
  onUpdate: (item: ListItem) => void,
  onDelete: (itemId: string) => void
) {
  const channel = supabase
    .channel(`list:${listId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'list_items',
        filter: `list_id=eq.${listId}`,
      },
      async (payload) => {
        // Fetch the full item with user name
        const { data } = await supabase
          .from('list_items')
          .select(`*, users:added_by (name)`)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onInsert({
            ...data,
            added_by_name: data.users?.name,
          });
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'list_items',
        filter: `list_id=eq.${listId}`,
      },
      (payload) => {
        onUpdate(payload.new as ListItem);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'list_items',
        filter: `list_id=eq.${listId}`,
      },
      (payload) => {
        onDelete(payload.old.id);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
