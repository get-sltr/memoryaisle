// Core data types matching Supabase schema

export interface User {
  id: string;
  email: string;
  name: string | null;
  household_id: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface GroceryList {
  id: string;
  household_id: string;
  name: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  added_by: string;
  added_by_name?: string; // For display: "John added Tea"
  is_completed: boolean;
  completed_at: string | null;
  source: 'manual' | 'ai_suggested' | 'voice';
  created_at: string;
}

export interface PurchaseHistory {
  id: string;
  household_id: string;
  item_name: string;
  price: number | null;
  store_name: string | null;
  purchased_at: string;
  source: 'receipt_ocr' | 'plaid' | 'loyalty';
  created_at: string;
}

export interface PurchasePattern {
  id: string;
  household_id: string;
  item_name: string;
  avg_interval_days: number;
  last_purchased: string;
  next_predicted: string;
  confidence: number; // 0-1
  created_at: string;
  updated_at: string;
}

// Realtime sync event types
export interface ListItemAddedEvent {
  type: 'ITEM_ADDED';
  item: ListItem;
  added_by_name: string;
}

export interface ListItemCompletedEvent {
  type: 'ITEM_COMPLETED';
  item_id: string;
  completed_by: string;
}

export type RealtimeEvent = ListItemAddedEvent | ListItemCompletedEvent;
