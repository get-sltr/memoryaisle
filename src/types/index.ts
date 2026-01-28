// Core data types matching Supabase schema

// Allergen types for family safety
export type AllergenType =
  | 'dairy'
  | 'eggs'
  | 'tree_nuts'
  | 'peanuts'
  | 'shellfish'
  | 'fish'
  | 'wheat'
  | 'gluten'
  | 'soy'
  | 'sesame';

// Personal profile - what makes each person unique
export interface UserProfile {
  // Basics
  nickname?: string;
  avatar?: string;
  birthday?: string;

  // Food preferences
  favoriteFoods?: string[];
  dislikedFoods?: string[];
  allergies?: AllergenType[];
  dietaryPreferences?: ('vegetarian' | 'vegan' | 'keto' | 'gluten-free' | 'halal' | 'kosher')[];

  // Personal touches
  favoriteColor?: string;
  favoriteSnack?: string;
  comfortFood?: string; // "What do you eat when you need a pick-me-up?"

  // Shopping habits
  favoriteStore?: string;
  usualShoppingDay?: string;
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string | null;
  household_id: string | null;
  allergies?: AllergenType[]; // User's personal allergies
  profile?: UserProfile; // Extended personal profile
  phone_verified?: boolean; // Whether phone has been verified (2-step auth)
  phone_verified_at?: string; // When phone was verified
  created_at: string;
}

// Cultural/Religious preferences for calendar awareness
export type CulturalPreference =
  | 'christian'
  | 'jewish'
  | 'muslim'
  | 'hindu'
  | 'buddhist'
  | 'chinese'
  | 'secular';

// Weekly recurring traditions (like Taco Tuesday)
export interface WeeklyTradition {
  id: string;
  name: string;                    // "Taco Tuesday"
  dayOfWeek: number;               // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  meal?: string;                   // Associated meal type
  recipes?: string[];              // Recipe IDs or names
  usualItems?: string[];           // Shopping items typically needed
  icon?: string;                   // Emoji representation
  isActive: boolean;               // Can be toggled on/off
}

// Special annual dates (birthdays, anniversaries)
export interface SpecialDate {
  id: string;
  name: string;                    // "Emma's Birthday", "Wedding Anniversary"
  date: string;                    // "MM-DD" format
  type: 'birthday' | 'anniversary' | 'custom';
  personId?: string;               // Link to family member if birthday
  celebrationIdeas?: string[];     // "Favorite cake: chocolate"
  usualItems?: string[];           // Items typically bought for this
}

// Family profile - shared memories and moments
export interface FamilyProfile {
  // Family identity
  familyName?: string;
  familyMotto?: string; // "The Smiths: Always Hungry, Always Happy"

  // Cultural & Religious preferences (for calendar)
  culturalPreferences?: CulturalPreference[];
  observeSecularHolidays?: boolean;  // US holidays, Halloween, etc.

  // Weekly traditions (Taco Tuesday, Pizza Friday, etc.)
  weeklyTraditions?: WeeklyTradition[];

  // Special dates (birthdays, anniversaries)
  specialDates?: SpecialDate[];

  // Shopping preferences
  usualShoppingDay?: number;        // 0-6, day of week
  preferredShoppingTime?: 'morning' | 'afternoon' | 'evening';

  // Favorite things to do together
  favoriteActivities?: string[];
  favoriteMealsTogether?: string[]; // "Sunday Pancakes", "Taco Tuesday"
  familyTraditions?: string[];

  // Special moments (legacy - use specialDates instead)
  upcomingBirthdays?: { name: string; date: string }[];
  anniversaries?: { name: string; date: string }[];

  // Family favorites
  favoriteRestaurant?: string;
  favoriteTakeout?: string;
  movieNightSnacks?: string[];
  gameNightSnacks?: string[];

  // Goals
  weeklyGoals?: string[];
  healthGoals?: string[];
}

// Calendar event that Mira can use for suggestions
export interface CalendarEvent {
  id: string;
  date: Date;
  type: 'holiday' | 'tradition' | 'birthday' | 'anniversary' | 'custom';
  name: string;
  icon?: string;
  category?: string;
  suggestedRecipes?: string[];
  suggestedItems?: string[];
  allergenNotes?: string[];         // "Dairy-free for Sarah"
  daysUntil: number;
  isRecurring: boolean;
}

import type { ImageSourcePropType } from 'react-native';

// Mira's smart suggestion based on calendar
export interface MiraCalendarSuggestion {
  eventName: string;
  eventDate: Date;
  eventIcon: ImageSourcePropType | string;
  message: string;                  // "Taco Tuesday is tomorrow!"
  suggestedList?: {
    name: string;
    items: string[];
    allergenSafeAlternatives?: { original: string; alternative: string; forPerson: string }[];
  };
  actionPrompt: string;             // "Want me to create an allergy-safe shopping list?"
}

export interface FamilyMember {
  id: string;
  name: string;
  role?: 'parent' | 'child' | 'grandparent' | 'other';
  allergies?: AllergenType[];
  dietary_preferences?: string[];
  profile?: UserProfile;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  member_count?: number; // Number of people in household (user-selected during signup)
  familyProfile?: FamilyProfile; // Extended family profile
  members?: FamilyMember[];
  created_at: string;
}

export interface GroceryList {
  id: string;
  household_id: string;
  name: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
}

// Allergy record stored with item - permanent memory
export interface ItemAllergyRecord {
  addedByName: string;
  allergens: AllergenType[]; // Which allergens the adder is allergic to that this item contains
  confirmedAt: string; // When they confirmed adding despite allergy alert
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
  allergy_record?: ItemAllergyRecord; // Present if adder has allergy to this item
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

// Mira AI types
export interface MiraItem {
  name: string;
  quantity: number;
}

export type MiraIntent =
  | 'add_items'
  | 'remove_item'
  | 'check_item'
  | 'get_suggestions'
  | 'clear_completed'
  | 'general_chat'
  | 'unclear'
  | 'error';

export interface MiraChatResponse {
  success: boolean;
  intent: MiraIntent;
  items: MiraItem[];
  response: string;
  error?: string;
}

export interface MiraSuggestion {
  itemName: string;
  reason: string;
  confidence: number;
  daysPastDue: number;
}

export interface MiraSuggestResponse {
  success: boolean;
  suggestions: MiraSuggestion[];
  message: string;
  error?: string;
}

// ==================== TRIP PLANNING TYPES ====================

// Trip types that Mira can help plan
export type TripType =
  | 'camping'
  | 'road_trip'
  | 'beach_vacation'
  | 'mountain_getaway'
  | 'city_break'
  | 'family_reunion'
  | 'holiday_travel'
  | 'day_trip'
  | 'picnic'
  | 'tailgate'
  | 'custom';

// Meal complexity levels
export type MealComplexity = 'quick_easy' | 'moderate' | 'gourmet';

// Transportation types
export type TransportationType = 'car' | 'rv' | 'plane' | 'train' | 'none';

// Trip meal plan
export interface TripMeal {
  id: string;
  day: number;                        // Day 1, 2, 3...
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;                       // "Campfire Burgers"
  complexity: MealComplexity;
  prepTime?: string;                  // "15 min"
  cookTime?: string;                  // "20 min"
  ingredients: string[];
  instructions?: string[];
  equipmentNeeded?: string[];         // "Portable grill", "Cooler"
  icon?: string;
}

// Trip checklist category
export interface TripChecklistCategory {
  id: string;
  name: string;                       // "Camping Gear", "Food & Snacks", "Safety"
  icon: string;
  items: TripChecklistItem[];
}

// Individual checklist item
export interface TripChecklistItem {
  id: string;
  name: string;
  quantity?: number;
  isPacked: boolean;
  isEssential: boolean;               // Can't leave without this!
  notes?: string;
  category?: string;                  // For grouping
}

// Transportation/Route planning
export interface TripTransportation {
  type: TransportationType;
  vehicleMpg?: number;                // For gas calculation
  estimatedMiles?: number;
  estimatedGasCost?: number;
  stops?: TripStop[];
  notes?: string;
}

// Road trip stop
export interface TripStop {
  id: string;
  name: string;                       // "Gas Station", "Rest Stop", "Scenic View"
  type: 'gas' | 'food' | 'rest' | 'attraction' | 'overnight';
  estimatedTime?: string;             // "2 hours from start"
  location?: string;
  notes?: string;
}

// Complete Trip Plan
export interface TripPlan {
  id: string;
  name: string;                       // "Smith Family Camping Trip 2024"
  type: TripType;
  destination?: string;               // "Yosemite National Park"
  startDate: string;
  endDate: string;
  duration: number;                   // Days
  travelers: number;                  // Number of people

  // Planning sections
  transportation?: TripTransportation;
  meals: TripMeal[];
  checklists: TripChecklistCategory[];
  shoppingList: string[];             // Generated from meals + checklists

  // Budget
  estimatedBudget?: {
    food: number;
    gas: number;
    accommodation: number;
    activities: number;
    total: number;
  };

  // Mira's notes
  miraNote?: string;                  // "Don't forget sunscreen - it'll be hot!"
  allergyNotes?: string[];            // "Packed dairy-free options for Sarah"

  // Status
  status: 'planning' | 'ready' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// Mira's trip suggestion response
export interface MiraTripSuggestion {
  tripType: TripType;
  icon: string;
  title: string;                      // "Weekend Camping Adventure"
  description: string;                // "Perfect for family bonding..."
  suggestedDuration: number;
  keyItems: string[];                 // Top 5 must-haves
  mealIdeas: string[];                // "Campfire s'mores", "Trail mix"
  estimatedBudget?: string;           // "$200-400"
}

// ==================== RECIPE TYPES ====================

// Recipe ingredient
export interface RecipeIngredient {
  item: string;
  amount: string;
  optional?: boolean;
}

// Recipe stored in Supabase
export interface Recipe {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  description?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  source: 'manual' | 'mira';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Trip recipe (extends regular recipe concept)
export interface TripRecipe {
  id: string;
  name: string;
  description: string;
  complexity: MealComplexity;
  suitableFor: TripType[];            // Which trip types this works for
  servings: number;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  ingredients: {
    item: string;
    amount: string;
    optional?: boolean;
  }[];
  instructions: string[];
  equipment: string[];                // "Camp stove", "Cooler", "Cast iron pan"
  tips?: string[];                    // "Pre-marinate at home to save time"
  allergenInfo?: AllergenType[];
  icon?: string;
  imageUrl?: string;
}
