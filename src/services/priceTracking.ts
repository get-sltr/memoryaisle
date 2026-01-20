// Price Tracking Service - Track purchase history and price trends
import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { PurchaseHistory } from '../types';

export interface PriceHistoryItem {
  item_name: string;
  price: number;
  store_name: string | null;
  purchased_at: string;
}

export interface PriceTrend {
  item_name: string;
  currentPrice: number;
  previousPrice: number | null;
  priceChange: number | null;
  percentChange: number | null;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  store_name: string | null;
  lastPurchased: string;
  purchaseCount: number;
}

export interface PriceAlert {
  item_name: string;
  message: string;
  type: 'price_drop' | 'price_increase' | 'good_deal';
  savings: number | null;
}

class PriceTrackingService {
  // Get purchase history for a household
  async getPurchaseHistory(
    householdId: string,
    limit: number = 50
  ): Promise<PriceHistoryItem[]> {
    try {
      const { data, error } = await supabase
        .from('purchase_history')
        .select('item_name, price, store_name, purchased_at')
        .eq('household_id', householdId)
        .order('purchased_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching purchase history:', error);
      return [];
    }
  }

  // Get price trends for all tracked items
  async getPriceTrends(householdId: string): Promise<PriceTrend[]> {
    try {
      const { data, error } = await supabase
        .from('purchase_history')
        .select('item_name, price, store_name, purchased_at')
        .eq('household_id', householdId)
        .order('purchased_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by item name
      const itemMap = new Map<string, PriceHistoryItem[]>();
      data.forEach((item) => {
        const name = item.item_name.toLowerCase();
        if (!itemMap.has(name)) {
          itemMap.set(name, []);
        }
        itemMap.get(name)!.push(item);
      });

      // Calculate trends for each item
      const trends: PriceTrend[] = [];
      itemMap.forEach((purchases, itemName) => {
        if (purchases.length === 0 || purchases[0].price === null) return;

        const prices = purchases.map((p) => p.price).filter((p) => p !== null) as number[];
        const currentPrice = prices[0];
        const previousPrice = prices.length > 1 ? prices[1] : null;
        const priceChange = previousPrice ? currentPrice - previousPrice : null;
        const percentChange = previousPrice
          ? ((currentPrice - previousPrice) / previousPrice) * 100
          : null;

        trends.push({
          item_name: purchases[0].item_name,
          currentPrice,
          previousPrice,
          priceChange,
          percentChange,
          lowestPrice: Math.min(...prices),
          highestPrice: Math.max(...prices),
          averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
          store_name: purchases[0].store_name,
          lastPurchased: purchases[0].purchased_at,
          purchaseCount: purchases.length,
        });
      });

      // Sort by purchase count (most tracked items first)
      return trends.sort((a, b) => b.purchaseCount - a.purchaseCount);
    } catch (error) {
      logger.error('Error calculating price trends:', error);
      return [];
    }
  }

  // Get price alerts (items with significant price changes)
  async getPriceAlerts(householdId: string): Promise<PriceAlert[]> {
    try {
      const trends = await this.getPriceTrends(householdId);
      const alerts: PriceAlert[] = [];

      trends.forEach((trend) => {
        if (
          trend.percentChange !== null &&
          trend.previousPrice !== null &&
          trend.priceChange !== null
        ) {
          // Price dropped more than 10%
          if (trend.percentChange < -10) {
            alerts.push({
              item_name: trend.item_name,
              message: `${trend.item_name} dropped ${Math.abs(trend.percentChange).toFixed(0)}%!`,
              type: 'price_drop',
              savings: Math.abs(trend.priceChange),
            });
          }
          // Price increased more than 20%
          else if (trend.percentChange > 20) {
            alerts.push({
              item_name: trend.item_name,
              message: `${trend.item_name} increased ${trend.percentChange.toFixed(0)}%`,
              type: 'price_increase',
              savings: null,
            });
          }
        }

        // Currently at lowest price
        if (trend.currentPrice === trend.lowestPrice && trend.purchaseCount > 2) {
          alerts.push({
            item_name: trend.item_name,
            message: `${trend.item_name} is at its lowest tracked price!`,
            type: 'good_deal',
            savings: trend.averagePrice - trend.currentPrice,
          });
        }
      });

      return alerts;
    } catch (error) {
      logger.error('Error getting price alerts:', error);
      return [];
    }
  }

  // Add a purchase to history
  async addPurchase(
    householdId: string,
    itemName: string,
    price: number,
    storeName?: string,
    source: 'receipt_ocr' | 'plaid' | 'loyalty' = 'receipt_ocr'
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('purchase_history').insert({
        household_id: householdId,
        item_name: itemName,
        price,
        store_name: storeName || null,
        source,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error adding purchase:', error);
      return false;
    }
  }

  // Get spending summary
  async getSpendingSummary(
    householdId: string
  ): Promise<{ thisMonth: number; lastMonth: number; total: number }> {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const { data, error } = await supabase
        .from('purchase_history')
        .select('price, purchased_at')
        .eq('household_id', householdId);

      if (error) throw error;

      let thisMonth = 0;
      let lastMonth = 0;
      let total = 0;

      (data || []).forEach((item) => {
        const price = item.price || 0;
        const date = new Date(item.purchased_at);
        total += price;

        if (date >= thisMonthStart) {
          thisMonth += price;
        } else if (date >= lastMonthStart && date <= lastMonthEnd) {
          lastMonth += price;
        }
      });

      return { thisMonth, lastMonth, total };
    } catch (error) {
      logger.error('Error getting spending summary:', error);
      return { thisMonth: 0, lastMonth: 0, total: 0 };
    }
  }
}

export const priceTrackingService = new PriceTrackingService();
