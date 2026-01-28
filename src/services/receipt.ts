// Receipt Scanner Service - Compare receipt to list, find missing items, save to history
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface ReceiptItem {
  name: string;
  price?: number | null;
  quantity?: number;
}

export interface ReceiptScanResult {
  success: boolean;
  purchasedItems: ReceiptItem[];
  missingItems: string[];
  message: string;
  storeName?: string;
  total?: number;
  savedToHistory?: number;
}

class ReceiptService {
  // Take photo or pick from gallery
  async captureReceipt(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        logger.log('Camera permission denied');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return null;
      }

      return result.assets[0].base64;
    } catch (error) {
      logger.error('Failed to capture receipt:', error);
      return null;
    }
  }

  // Scan receipt and compare to list
  async scanAndCompare(
    receiptBase64: string,
    listItems: string[],
    householdId?: string,
    storeName?: string
  ): Promise<ReceiptScanResult> {
    try {
      const { data, error } = await supabase.functions.invoke('mira-receipt', {
        body: {
          image: receiptBase64,
          listItems,
          householdId,
          storeName,
        },
      });

      if (error) {
        logger.error('Receipt scan error:', error);
        return {
          success: false,
          purchasedItems: [],
          missingItems: [],
          message: 'Could not scan receipt. Try again?',
        };
      }

      return {
        success: true,
        purchasedItems: data.purchasedItems || [],
        missingItems: data.missingItems || [],
        message: data.message || '',
        storeName: data.storeName,
        total: data.total,
        savedToHistory: data.savedToHistory,
      };
    } catch (error) {
      logger.error('Receipt scan error:', error);
      return {
        success: false,
        purchasedItems: [],
        missingItems: [],
        message: 'Something went wrong.',
      };
    }
  }

  // Get purchase history for household
  async getPurchaseHistory(householdId: string, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('purchase_history')
        .select('*')
        .eq('household_id', householdId)
        .order('purchased_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get purchase history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get purchase history:', error);
      return [];
    }
  }

  // Get price history for an item
  async getPriceHistory(householdId: string, itemName: string) {
    try {
      const { data, error } = await supabase
        .from('purchase_history')
        .select('price, store_name, purchased_at')
        .eq('household_id', householdId)
        .ilike('item_name', `%${itemName}%`)
        .order('purchased_at', { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Failed to get price history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get price history:', error);
      return [];
    }
  }
}

export const receiptService = new ReceiptService();
