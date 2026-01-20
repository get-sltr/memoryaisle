// Founder Family Service
// Manages founder family codes and membership

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface FounderFamilyCode {
  id: string;
  code: string;
  label: string | null;
  is_active: boolean;
  redeemed_by: string | null;
  redeemed_at: string | null;
  redeemed_by_email: string | null;
  created_at: string;
}

class FounderFamilyService {
  // Generate a new founder family code (founder only)
  async generateCode(label?: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('generate_founder_family_code', {
        p_label: label || null,
      });

      if (error) {
        logger.error('Error generating founder family code:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error in generateCode:', error);
      return null;
    }
  }

  // Redeem a founder family code
  async redeemCode(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('redeem_founder_family_code', {
        p_code: code.toUpperCase().trim(),
      });

      if (error) {
        logger.error('Error redeeming founder family code:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Invalid or already used code' };
      }

      return { success: true };
    } catch (error: any) {
      logger.error('Error in redeemCode:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if current user is a founder family member
  async isFounderFamily(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_founder_family');
      if (error) return false;
      return data === true;
    } catch {
      return false;
    }
  }

  // Get all founder family codes (founder only)
  async getCodes(): Promise<FounderFamilyCode[]> {
    try {
      const { data, error } = await supabase.rpc('get_founder_family_codes');

      if (error) {
        logger.error('Error getting founder family codes:', error);
        return [];
      }

      return (data || []) as FounderFamilyCode[];
    } catch (error) {
      logger.error('Error in getCodes:', error);
      return [];
    }
  }
}

export const founderFamilyService = new FounderFamilyService();
