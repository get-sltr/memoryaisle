// Barcode Scanner Service
// Looks up product data from Open Food Facts API and local cache

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface ScannedProduct {
  barcode: string;
  product_name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  nutrition?: Record<string, any>;
}

class BarcodeScannerService {
  // Look up a barcode — check cache first, then Open Food Facts
  async lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
    // 1. Check local cache
    const cached = await this.getCachedProduct(barcode);
    if (cached) return cached;

    // 2. Query Open Food Facts API
    const product = await this.fetchFromOpenFoodFacts(barcode);
    if (product) {
      // Cache for future lookups
      await this.cacheProduct(product);
      return product;
    }

    return null;
  }

  // Fetch from Open Food Facts (free, open source API)
  private async fetchFromOpenFoodFacts(barcode: string): Promise<ScannedProduct | null> {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        { headers: { 'User-Agent': 'MemoryAisle/1.0 (contact@memoryaisle.app)' } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      return {
        barcode,
        product_name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands || undefined,
        category: this.mapCategory(p.categories_tags || []),
        image_url: p.image_front_small_url || p.image_url || undefined,
        nutrition: p.nutriments ? {
          calories: p.nutriments['energy-kcal_100g'],
          protein: p.nutriments.proteins_100g,
          carbs: p.nutriments.carbohydrates_100g,
          fat: p.nutriments.fat_100g,
          fiber: p.nutriments.fiber_100g,
          sugar: p.nutriments.sugars_100g,
          sodium: p.nutriments.sodium_100g,
        } : undefined,
      };
    } catch (error) {
      logger.error('Error fetching from Open Food Facts:', error);
      return null;
    }
  }

  // Check Supabase cache
  private async getCachedProduct(barcode: string): Promise<ScannedProduct | null> {
    try {
      const { data, error } = await supabase
        .from('scanned_products')
        .select('*')
        .eq('barcode', barcode)
        .single();

      if (error || !data) return null;

      // Check if cache is older than 30 days
      const age = Date.now() - new Date(data.last_fetched).getTime();
      if (age > 30 * 24 * 60 * 60 * 1000) return null;

      return data;
    } catch {
      return null;
    }
  }

  // Save to cache
  private async cacheProduct(product: ScannedProduct): Promise<void> {
    try {
      await supabase.from('scanned_products').upsert({
        barcode: product.barcode,
        product_name: product.product_name,
        brand: product.brand,
        category: product.category,
        image_url: product.image_url,
        nutrition: product.nutrition,
        last_fetched: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error caching scanned product:', error);
    }
  }

  // Map Open Food Facts categories to our pantry categories
  private mapCategory(tags: string[]): string {
    const tagStr = tags.join(',').toLowerCase();
    if (tagStr.includes('dairy') || tagStr.includes('milk') || tagStr.includes('cheese') || tagStr.includes('yogurt')) return 'dairy';
    if (tagStr.includes('fruit') || tagStr.includes('vegetable') || tagStr.includes('produce')) return 'produce';
    if (tagStr.includes('meat') || tagStr.includes('poultry') || tagStr.includes('fish') || tagStr.includes('seafood')) return 'meat';
    if (tagStr.includes('bread') || tagStr.includes('bakery') || tagStr.includes('pastry')) return 'bakery';
    if (tagStr.includes('frozen')) return 'frozen';
    if (tagStr.includes('beverage') || tagStr.includes('drink') || tagStr.includes('juice') || tagStr.includes('water')) return 'beverages';
    if (tagStr.includes('snack') || tagStr.includes('chip') || tagStr.includes('candy')) return 'snacks';
    return 'pantry';
  }
}

export const barcodeScannerService = new BarcodeScannerService();
