// Object Detection Service for Mira
// Uses Google Cloud Vision API to detect grocery items from camera/images

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import * as ImageManipulator from 'expo-image-manipulator';

export interface DetectedItem {
  name: string;
  confidence: number;
  category: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectionResult {
  success: boolean;
  items: DetectedItem[];
  suggestions: string[];
  error?: string;
}

// Grocery categories for better item classification
const GROCERY_CATEGORIES: Record<string, string[]> = {
  produce: [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry',
    'raspberry', 'mango', 'pineapple', 'watermelon', 'cantaloupe', 'peach', 'pear',
    'plum', 'cherry', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'carrot',
    'celery', 'broccoli', 'cauliflower', 'lettuce', 'spinach', 'kale', 'cabbage',
    'cucumber', 'bell pepper', 'pepper', 'mushroom', 'corn', 'zucchini', 'squash',
    'eggplant', 'asparagus', 'green beans', 'peas', 'artichoke', 'beet', 'radish',
  ],
  dairy: [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'cottage cheese',
    'sour cream', 'cream cheese', 'ice cream', 'whipped cream', 'half and half',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon', 'tuna',
    'shrimp', 'bacon', 'sausage', 'ham', 'steak', 'ground beef', 'chicken breast',
  ],
  bakery: [
    'bread', 'bagel', 'muffin', 'croissant', 'roll', 'baguette', 'tortilla',
    'pita', 'cake', 'cookie', 'donut', 'pastry', 'pie', 'bun',
  ],
  pantry: [
    'rice', 'pasta', 'cereal', 'oatmeal', 'flour', 'sugar', 'salt', 'pepper',
    'olive oil', 'vegetable oil', 'vinegar', 'soy sauce', 'ketchup', 'mustard',
    'mayonnaise', 'peanut butter', 'jelly', 'honey', 'syrup', 'coffee', 'tea',
  ],
  beverages: [
    'water', 'juice', 'soda', 'wine', 'beer', 'coffee', 'tea', 'smoothie',
    'energy drink', 'sports drink', 'coconut water', 'almond milk', 'oat milk',
  ],
  frozen: [
    'frozen pizza', 'ice cream', 'frozen vegetables', 'frozen fruit',
    'frozen dinner', 'frozen fish', 'frozen chicken', 'popsicle',
  ],
  snacks: [
    'chips', 'crackers', 'popcorn', 'nuts', 'trail mix', 'granola bar',
    'protein bar', 'candy', 'chocolate', 'gummy', 'pretzels',
  ],
};

// Categorize detected item
function categorizeItem(itemName: string): string {
  const lowerName = itemName.toLowerCase();

  for (const [category, items] of Object.entries(GROCERY_CATEGORIES)) {
    if (items.some(item => lowerName.includes(item) || item.includes(lowerName))) {
      return category;
    }
  }

  return 'other';
}

// Process and compress image for API
async function processImage(imageUri: string): Promise<string> {
  try {
    // Resize and compress the image
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    return manipResult.base64 || '';
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
}

class ObjectDetectionService {
  private isProcessing = false;

  // Detect items from camera image
  async detectFromImage(imageUri: string): Promise<DetectionResult> {
    if (this.isProcessing) {
      return {
        success: false,
        items: [],
        suggestions: [],
        error: 'Detection already in progress',
      };
    }

    this.isProcessing = true;

    try {
      // Process image to base64
      const base64Image = await processImage(imageUri);

      // Call Supabase Edge Function for Vision AI processing
      const { data, error } = await supabase.functions.invoke('detect-objects', {
        body: {
          image: base64Image,
          detectGroceries: true,
        },
      });

      if (error) throw error;

      // Process and categorize detected items
      const items: DetectedItem[] = (data.objects || []).map((obj: any) => ({
        name: obj.name,
        confidence: obj.confidence,
        category: categorizeItem(obj.name),
        boundingBox: obj.boundingPoly ? {
          x: obj.boundingPoly.vertices[0]?.x || 0,
          y: obj.boundingPoly.vertices[0]?.y || 0,
          width: (obj.boundingPoly.vertices[2]?.x || 0) - (obj.boundingPoly.vertices[0]?.x || 0),
          height: (obj.boundingPoly.vertices[2]?.y || 0) - (obj.boundingPoly.vertices[0]?.y || 0),
        } : undefined,
      }));

      // Generate smart suggestions based on detected items
      const suggestions = this.generateSuggestions(items);

      return {
        success: true,
        items,
        suggestions,
      };
    } catch (error: any) {
      logger.error('Error detecting objects:', error);
      return {
        success: false,
        items: [],
        suggestions: [],
        error: error.message || 'Failed to detect objects',
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Detect items from receipt image (OCR)
  async detectFromReceipt(imageUri: string): Promise<DetectionResult> {
    if (this.isProcessing) {
      return {
        success: false,
        items: [],
        suggestions: [],
        error: 'Detection already in progress',
      };
    }

    this.isProcessing = true;

    try {
      const base64Image = await processImage(imageUri);

      const { data, error } = await supabase.functions.invoke('detect-objects', {
        body: {
          image: base64Image,
          detectReceipt: true,
        },
      });

      if (error) throw error;

      // Parse receipt items
      const items: DetectedItem[] = (data.items || []).map((item: any) => ({
        name: item.name,
        confidence: item.confidence || 0.9,
        category: categorizeItem(item.name),
      }));

      return {
        success: true,
        items,
        suggestions: ['Items extracted from receipt. Would you like me to add them to your list?'],
      };
    } catch (error: any) {
      logger.error('Error detecting receipt:', error);
      return {
        success: false,
        items: [],
        suggestions: [],
        error: error.message || 'Failed to read receipt',
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Generate smart suggestions based on detected items
  private generateSuggestions(items: DetectedItem[]): string[] {
    const suggestions: string[] = [];
    const categories = new Set(items.map(i => i.category));

    // Suggest complementary items
    if (categories.has('produce') && !categories.has('dairy')) {
      suggestions.push('Consider adding dairy products like milk or cheese');
    }

    if (items.some(i => i.name.toLowerCase().includes('pasta')) &&
        !items.some(i => i.name.toLowerCase().includes('sauce'))) {
      suggestions.push('Don\'t forget pasta sauce!');
    }

    if (items.some(i => i.name.toLowerCase().includes('bread')) &&
        !items.some(i => i.name.toLowerCase().includes('butter'))) {
      suggestions.push('You might want butter with that bread');
    }

    if (categories.has('meat') && !items.some(i => i.category === 'produce')) {
      suggestions.push('Add some vegetables to balance your meal');
    }

    // Recipe suggestions
    const itemNames = items.map(i => i.name.toLowerCase());
    if (itemNames.includes('chicken') && itemNames.includes('rice')) {
      suggestions.push('Try making chicken stir-fry! Need the recipe?');
    }

    if (itemNames.some(n => n.includes('tomato')) && itemNames.some(n => n.includes('pasta'))) {
      suggestions.push('Perfect for a homemade marinara sauce!');
    }

    return suggestions.slice(0, 3);
  }

  // Quick scan mode for rapid item detection
  async quickScan(imageUri: string): Promise<string[]> {
    const result = await this.detectFromImage(imageUri);
    if (result.success) {
      return result.items
        .filter(i => i.confidence > 0.7)
        .map(i => i.name);
    }
    return [];
  }
}

export const objectDetectionService = new ObjectDetectionService();
