// Receipt Scanner Service - Compare receipt to list, find missing items
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export interface ReceiptItem {
  name: string;
  quantity?: number;
}

export interface ReceiptScanResult {
  success: boolean;
  purchasedItems: ReceiptItem[];
  missingItems: string[];
  message: string;
}

class ReceiptService {
  // Take photo or pick from gallery
  async captureReceipt(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.log('Camera permission denied');
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
      console.error('Failed to capture receipt:', error);
      return null;
    }
  }

  // Scan receipt and compare to list
  async scanAndCompare(
    receiptBase64: string,
    listItems: string[]
  ): Promise<ReceiptScanResult> {
    try {
      const { data, error } = await supabase.functions.invoke('mira-receipt', {
        body: {
          image: receiptBase64,
          listItems,
        },
      });

      if (error) {
        console.error('Receipt scan error:', error);
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
      };
    } catch (error) {
      console.error('Receipt scan error:', error);
      return {
        success: false,
        purchasedItems: [],
        missingItems: [],
        message: 'Something went wrong.',
      };
    }
  }
}

export const receiptService = new ReceiptService();
