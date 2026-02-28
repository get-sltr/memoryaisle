// Mira Trip Planning Service
// Complete trip planning from camping to gourmet vacations

import type {
  TripType,
  TripPlan,
  TripMeal,
  TripChecklistCategory,
  TripChecklistItem,
  TripRecipe,
  MiraTripSuggestion,
  MealComplexity,
  AllergenType,
} from '../types';

// ==================== TRIP TEMPLATES ====================

interface TripTemplate {
  type: TripType;
  icon: string;
  name: string;
  description: string;
  suggestedDuration: { min: number; max: number };
  checklists: Omit<TripChecklistCategory, 'id'>[];
  mealSuggestions: { complexity: MealComplexity; meals: string[] }[];
  tips: string[];
  estimatedDailyBudget: { min: number; max: number };
}

export const TRIP_TEMPLATES: Record<TripType, TripTemplate> = {
  camping: {
    type: 'camping',
    icon: '🏕️',
    name: 'Camping Adventure',
    description: 'Connect with nature and create unforgettable family memories under the stars.',
    suggestedDuration: { min: 2, max: 7 },
    checklists: [
      {
        name: 'Shelter & Sleeping',
        icon: '⛺',
        items: [
          { id: 'tent', name: 'Tent', isPacked: false, isEssential: true },
          { id: 'sleepbag', name: 'Sleeping bags', isPacked: false, isEssential: true },
          { id: 'sleeppad', name: 'Sleeping pads/air mattresses', isPacked: false, isEssential: true },
          { id: 'pillows', name: 'Pillows', isPacked: false, isEssential: false },
          { id: 'tarp', name: 'Ground tarp', isPacked: false, isEssential: false },
          { id: 'blankets', name: 'Extra blankets', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Cooking & Food',
        icon: '🍳',
        items: [
          { id: 'stove', name: 'Camp stove or portable grill', isPacked: false, isEssential: true },
          { id: 'fuel', name: 'Fuel/propane', isPacked: false, isEssential: true },
          { id: 'cooler', name: 'Cooler with ice', isPacked: false, isEssential: true },
          { id: 'pots', name: 'Pots and pans', isPacked: false, isEssential: true },
          { id: 'utensils', name: 'Cooking utensils', isPacked: false, isEssential: true },
          { id: 'plates', name: 'Plates, bowls, cups', isPacked: false, isEssential: true },
          { id: 'cutlery', name: 'Forks, knives, spoons', isPacked: false, isEssential: true },
          { id: 'canopener', name: 'Can opener', isPacked: false, isEssential: true },
          { id: 'firestarter', name: 'Fire starters/matches', isPacked: false, isEssential: true },
          { id: 'foil', name: 'Aluminum foil', isPacked: false, isEssential: false },
          { id: 'trashbags', name: 'Trash bags', isPacked: false, isEssential: true },
          { id: 'papertowels', name: 'Paper towels', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Clothing & Personal',
        icon: '👕',
        items: [
          { id: 'layers', name: 'Layered clothing', isPacked: false, isEssential: true },
          { id: 'raingear', name: 'Rain gear/jacket', isPacked: false, isEssential: true },
          { id: 'hikingboots', name: 'Hiking boots/sturdy shoes', isPacked: false, isEssential: true },
          { id: 'sandals', name: 'Camp sandals', isPacked: false, isEssential: false },
          { id: 'hat', name: 'Hat/cap', isPacked: false, isEssential: false },
          { id: 'swimwear', name: 'Swimwear', isPacked: false, isEssential: false },
          { id: 'toiletries', name: 'Toiletries', isPacked: false, isEssential: true },
          { id: 'towels', name: 'Quick-dry towels', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Safety & First Aid',
        icon: '🩹',
        items: [
          { id: 'firstaid', name: 'First aid kit', isPacked: false, isEssential: true },
          { id: 'sunscreen', name: 'Sunscreen', isPacked: false, isEssential: true },
          { id: 'bugspray', name: 'Bug spray/repellent', isPacked: false, isEssential: true },
          { id: 'flashlight', name: 'Flashlights/headlamps', isPacked: false, isEssential: true },
          { id: 'batteries', name: 'Extra batteries', isPacked: false, isEssential: true },
          { id: 'multitool', name: 'Multi-tool/knife', isPacked: false, isEssential: true },
          { id: 'whistle', name: 'Emergency whistle', isPacked: false, isEssential: false },
          { id: 'map', name: 'Map/compass', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Entertainment',
        icon: '🎮',
        items: [
          { id: 'cards', name: 'Cards/board games', isPacked: false, isEssential: false },
          { id: 'books', name: 'Books/magazines', isPacked: false, isEssential: false },
          { id: 'fishing', name: 'Fishing gear', isPacked: false, isEssential: false },
          { id: 'binoculars', name: 'Binoculars', isPacked: false, isEssential: false },
          { id: 'camera', name: 'Camera', isPacked: false, isEssential: false },
          { id: 'smores', name: "S'mores supplies", isPacked: false, isEssential: false, notes: 'Marshmallows, chocolate, graham crackers' },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Hot dogs', 'Sandwiches', 'Trail mix', 'Granola bars', 'Instant oatmeal'] },
      { complexity: 'moderate', meals: ['Campfire burgers', 'Foil packet dinners', 'Pancakes', 'Grilled chicken', 'Pasta salad'] },
      { complexity: 'gourmet', meals: ['Cast iron steaks', 'Dutch oven chili', 'Campfire paella', 'Grilled salmon', 'Berry cobbler'] },
    ],
    tips: [
      'Check weather forecast and pack accordingly',
      'Arrive during daylight to set up camp',
      'Store food properly to avoid wildlife',
      'Bring more water than you think you need',
      'Leave no trace - pack out all trash',
    ],
    estimatedDailyBudget: { min: 30, max: 80 },
  },

  road_trip: {
    type: 'road_trip',
    icon: '🚗',
    name: 'Road Trip Adventure',
    description: 'Hit the open road and explore new places together as a family.',
    suggestedDuration: { min: 3, max: 14 },
    checklists: [
      {
        name: 'Vehicle Essentials',
        icon: '🔧',
        items: [
          { id: 'spareire', name: 'Spare tire (checked)', isPacked: false, isEssential: true },
          { id: 'jumper', name: 'Jumper cables', isPacked: false, isEssential: true },
          { id: 'carcharger', name: 'Car phone chargers', isPacked: false, isEssential: true },
          { id: 'emergkit', name: 'Emergency roadside kit', isPacked: false, isEssential: true },
          { id: 'registration', name: 'Registration & insurance', isPacked: false, isEssential: true },
          { id: 'maps', name: 'Physical maps (backup)', isPacked: false, isEssential: false },
          { id: 'sunshade', name: 'Windshield sunshade', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Snacks & Drinks',
        icon: '🍿',
        items: [
          { id: 'water', name: 'Water bottles', isPacked: false, isEssential: true },
          { id: 'snackbox', name: 'Snack box/container', isPacked: false, isEssential: true },
          { id: 'fruits', name: 'Fresh fruits', isPacked: false, isEssential: false },
          { id: 'nuts', name: 'Nuts & trail mix', isPacked: false, isEssential: false },
          { id: 'crackers', name: 'Crackers & cheese', isPacked: false, isEssential: false },
          { id: 'sandwiches', name: 'Pre-made sandwiches', isPacked: false, isEssential: false },
          { id: 'treats', name: 'Special treats for kids', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Comfort & Entertainment',
        icon: '🎧',
        items: [
          { id: 'pillows', name: 'Travel pillows', isPacked: false, isEssential: false },
          { id: 'blankets', name: 'Blankets', isPacked: false, isEssential: false },
          { id: 'tablets', name: 'Tablets/devices (charged)', isPacked: false, isEssential: false },
          { id: 'headphones', name: 'Headphones', isPacked: false, isEssential: false },
          { id: 'games', name: 'Travel games', isPacked: false, isEssential: false },
          { id: 'books', name: 'Books/audiobooks', isPacked: false, isEssential: false },
          { id: 'playlist', name: 'Road trip playlist', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Personal & Hygiene',
        icon: '🧴',
        items: [
          { id: 'toiletries', name: 'Toiletry bag', isPacked: false, isEssential: true },
          { id: 'wipes', name: 'Wet wipes', isPacked: false, isEssential: true },
          { id: 'tissues', name: 'Tissues', isPacked: false, isEssential: true },
          { id: 'sanitizer', name: 'Hand sanitizer', isPacked: false, isEssential: true },
          { id: 'trashbag', name: 'Car trash bags', isPacked: false, isEssential: true },
          { id: 'meds', name: 'Medications', isPacked: false, isEssential: true },
          { id: 'motionsick', name: 'Motion sickness meds', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Gas station snacks', 'Drive-thru meals', 'Pre-packed sandwiches', 'Granola bars', 'Fruit cups'] },
      { complexity: 'moderate', meals: ['Picnic lunch at rest stop', 'Deli sandwiches', 'Wraps', 'Salads in containers', 'Cheese boards'] },
      { complexity: 'gourmet', meals: ['Local restaurant discoveries', 'Food truck finds', 'Regional specialties', 'Farm-to-table stops'] },
    ],
    tips: [
      'Plan stops every 2-3 hours for stretching',
      'Download offline maps before leaving',
      'Check tire pressure and fluids before departure',
      'Pack a cooler with healthy snacks',
      'Research interesting stops along the way',
    ],
    estimatedDailyBudget: { min: 100, max: 250 },
  },

  beach_vacation: {
    type: 'beach_vacation',
    icon: '🏖️',
    name: 'Beach Getaway',
    description: 'Sun, sand, and surf await your family beach adventure.',
    suggestedDuration: { min: 3, max: 10 },
    checklists: [
      {
        name: 'Beach Gear',
        icon: '🏄',
        items: [
          { id: 'sunscreen', name: 'Sunscreen (SPF 30+)', isPacked: false, isEssential: true },
          { id: 'umbrella', name: 'Beach umbrella', isPacked: false, isEssential: true },
          { id: 'chairs', name: 'Beach chairs', isPacked: false, isEssential: false },
          { id: 'towels', name: 'Beach towels', isPacked: false, isEssential: true },
          { id: 'cooler', name: 'Beach cooler', isPacked: false, isEssential: true },
          { id: 'toys', name: 'Sand toys/buckets', isPacked: false, isEssential: false },
          { id: 'floaties', name: 'Pool floaties', isPacked: false, isEssential: false },
          { id: 'snorkel', name: 'Snorkel gear', isPacked: false, isEssential: false },
          { id: 'boogieboard', name: 'Boogie boards', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Sun Protection',
        icon: '☀️',
        items: [
          { id: 'hats', name: 'Sun hats', isPacked: false, isEssential: true },
          { id: 'sunglasses', name: 'Sunglasses', isPacked: false, isEssential: true },
          { id: 'rashguards', name: 'Rash guards/UV shirts', isPacked: false, isEssential: false },
          { id: 'coverups', name: 'Cover-ups', isPacked: false, isEssential: false },
          { id: 'aloe', name: 'Aloe vera gel', isPacked: false, isEssential: true },
          { id: 'lipbalm', name: 'SPF lip balm', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Clothing',
        icon: '👙',
        items: [
          { id: 'swimsuits', name: 'Swimsuits (multiple)', isPacked: false, isEssential: true },
          { id: 'sandals', name: 'Flip flops/sandals', isPacked: false, isEssential: true },
          { id: 'watershoes', name: 'Water shoes', isPacked: false, isEssential: false },
          { id: 'casual', name: 'Casual clothes', isPacked: false, isEssential: true },
          { id: 'dinner', name: 'Nice dinner outfit', isPacked: false, isEssential: false },
          { id: 'lightjacket', name: 'Light jacket (evenings)', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Beach Snacks',
        icon: '🍉',
        items: [
          { id: 'water', name: 'Water bottles', isPacked: false, isEssential: true },
          { id: 'fruit', name: 'Fresh fruit (grapes, berries)', isPacked: false, isEssential: false },
          { id: 'sandwiches', name: 'Beach sandwiches', isPacked: false, isEssential: false },
          { id: 'chips', name: 'Chips & snacks', isPacked: false, isEssential: false },
          { id: 'popsicles', name: 'Frozen treats', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Beach sandwiches', 'Fruit salad', 'Chips & dip', 'Popsicles', 'Wraps'] },
      { complexity: 'moderate', meals: ['Grilled fish tacos', 'Shrimp boil', 'Ceviche', 'Poke bowls', 'Coconut rice'] },
      { complexity: 'gourmet', meals: ['Fresh caught seafood', 'Lobster dinner', 'Beachfront dining', 'Sunset BBQ feast'] },
    ],
    tips: [
      'Apply sunscreen 30 minutes before sun exposure',
      'Reapply sunscreen every 2 hours',
      'Stay hydrated - bring extra water',
      'Check tide schedules before swimming',
      'Rinse off sand before getting in the car',
    ],
    estimatedDailyBudget: { min: 80, max: 200 },
  },

  mountain_getaway: {
    type: 'mountain_getaway',
    icon: '🏔️',
    name: 'Mountain Retreat',
    description: 'Escape to the mountains for fresh air and stunning views.',
    suggestedDuration: { min: 2, max: 7 },
    checklists: [
      {
        name: 'Hiking Essentials',
        icon: '🥾',
        items: [
          { id: 'boots', name: 'Hiking boots', isPacked: false, isEssential: true },
          { id: 'backpack', name: 'Day pack/backpack', isPacked: false, isEssential: true },
          { id: 'water', name: 'Water bottles/hydration pack', isPacked: false, isEssential: true },
          { id: 'snacks', name: 'Trail snacks', isPacked: false, isEssential: true },
          { id: 'poles', name: 'Hiking poles', isPacked: false, isEssential: false },
          { id: 'map', name: 'Trail map', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Clothing Layers',
        icon: '🧥',
        items: [
          { id: 'base', name: 'Base layers', isPacked: false, isEssential: true },
          { id: 'fleece', name: 'Fleece/mid layer', isPacked: false, isEssential: true },
          { id: 'jacket', name: 'Waterproof jacket', isPacked: false, isEssential: true },
          { id: 'pants', name: 'Hiking pants', isPacked: false, isEssential: true },
          { id: 'hat', name: 'Warm hat', isPacked: false, isEssential: true },
          { id: 'gloves', name: 'Gloves', isPacked: false, isEssential: false },
          { id: 'socks', name: 'Wool hiking socks', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Safety',
        icon: '🆘',
        items: [
          { id: 'firstaid', name: 'First aid kit', isPacked: false, isEssential: true },
          { id: 'whistle', name: 'Emergency whistle', isPacked: false, isEssential: true },
          { id: 'headlamp', name: 'Headlamp', isPacked: false, isEssential: true },
          { id: 'sunscreen', name: 'Sunscreen', isPacked: false, isEssential: true },
          { id: 'bugspray', name: 'Bug spray', isPacked: false, isEssential: true },
          { id: 'bearspray', name: 'Bear spray (if needed)', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Trail mix', 'Energy bars', 'Sandwiches', 'Instant soup', 'Dried fruit'] },
      { complexity: 'moderate', meals: ['Cabin chili', 'Hearty stew', 'Mountain breakfast', 'Grilled trout', 'Hot cocoa'] },
      { complexity: 'gourmet', meals: ['Fondue night', 'Prime rib dinner', 'Fireside feast', 'Local game dishes'] },
    ],
    tips: [
      'Check altitude and prepare for elevation changes',
      'Dress in layers for changing temperatures',
      'Start hikes early in the morning',
      'Let someone know your hiking plans',
      'Watch for weather changes',
    ],
    estimatedDailyBudget: { min: 60, max: 180 },
  },

  city_break: {
    type: 'city_break',
    icon: '🏙️',
    name: 'City Adventure',
    description: 'Explore urban attractions, culture, and cuisine.',
    suggestedDuration: { min: 2, max: 5 },
    checklists: [
      {
        name: 'Travel Documents',
        icon: '📄',
        items: [
          { id: 'id', name: 'ID/passports', isPacked: false, isEssential: true },
          { id: 'tickets', name: 'Tickets/reservations', isPacked: false, isEssential: true },
          { id: 'cards', name: 'Credit/debit cards', isPacked: false, isEssential: true },
          { id: 'insurance', name: 'Travel insurance info', isPacked: false, isEssential: false },
          { id: 'hotel', name: 'Hotel confirmation', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Day Pack',
        icon: '🎒',
        items: [
          { id: 'daypack', name: 'Small backpack/bag', isPacked: false, isEssential: true },
          { id: 'waterbottle', name: 'Reusable water bottle', isPacked: false, isEssential: true },
          { id: 'charger', name: 'Phone charger/power bank', isPacked: false, isEssential: true },
          { id: 'camera', name: 'Camera', isPacked: false, isEssential: false },
          { id: 'guidebook', name: 'Guidebook/map', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Clothing',
        icon: '👔',
        items: [
          { id: 'comfy', name: 'Comfortable walking shoes', isPacked: false, isEssential: true },
          { id: 'casual', name: 'Casual day outfits', isPacked: false, isEssential: true },
          { id: 'nice', name: 'Nice dinner outfit', isPacked: false, isEssential: false },
          { id: 'jacket', name: 'Light jacket', isPacked: false, isEssential: true },
          { id: 'umbrella', name: 'Compact umbrella', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Street food', 'Food court', 'Café lunch', 'Hotel breakfast', 'Takeout'] },
      { complexity: 'moderate', meals: ['Local bistro', 'Food market', 'Rooftop dining', 'Cultural cuisine', 'Brunch spot'] },
      { complexity: 'gourmet', meals: ['Michelin-starred restaurant', 'Chef\'s tasting menu', 'Fine dining experience', 'Wine pairing dinner'] },
    ],
    tips: [
      'Research public transportation options',
      'Book popular attractions in advance',
      'Wear comfortable walking shoes',
      'Try local specialties',
      'Leave room in luggage for souvenirs',
    ],
    estimatedDailyBudget: { min: 100, max: 300 },
  },

  family_reunion: {
    type: 'family_reunion',
    icon: '👨‍👩‍👧‍👦',
    name: 'Family Reunion',
    description: 'Gather the extended family for quality time together.',
    suggestedDuration: { min: 2, max: 4 },
    checklists: [
      {
        name: 'Group Activities',
        icon: '🎯',
        items: [
          { id: 'games', name: 'Group games', isPacked: false, isEssential: false },
          { id: 'sports', name: 'Sports equipment', isPacked: false, isEssential: false },
          { id: 'photos', name: 'Photo supplies', isPacked: false, isEssential: false },
          { id: 'decor', name: 'Decorations', isPacked: false, isEssential: false },
          { id: 'name', name: 'Name tags', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Food & Drinks',
        icon: '🍽️',
        items: [
          { id: 'potluck', name: 'Potluck dish', isPacked: false, isEssential: true },
          { id: 'serving', name: 'Serving dishes', isPacked: false, isEssential: false },
          { id: 'drinks', name: 'Beverages', isPacked: false, isEssential: true },
          { id: 'disposable', name: 'Disposable plates/cups', isPacked: false, isEssential: true },
          { id: 'cake', name: 'Celebration cake', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Potluck dishes', 'BBQ buffet', 'Sandwich bar', 'Pizza party', 'Taco bar'] },
      { complexity: 'moderate', meals: ['Family recipes', 'Themed dinner', 'Grilled feast', 'Comfort food spread'] },
      { complexity: 'gourmet', meals: ['Catered event', 'Family cooking competition', 'Heritage recipes', 'Formal dinner'] },
    ],
    tips: [
      'Create a shared photo album',
      'Plan activities for all ages',
      'Coordinate dishes to avoid duplicates',
      'Set up a kids\' area',
      'Document family stories/memories',
    ],
    estimatedDailyBudget: { min: 50, max: 150 },
  },

  holiday_travel: {
    type: 'holiday_travel',
    icon: '✈️',
    name: 'Holiday Travel',
    description: 'Visit family and friends during the holiday season.',
    suggestedDuration: { min: 3, max: 10 },
    checklists: [
      {
        name: 'Travel Essentials',
        icon: '🧳',
        items: [
          { id: 'luggage', name: 'Luggage', isPacked: false, isEssential: true },
          { id: 'gifts', name: 'Wrapped gifts', isPacked: false, isEssential: false },
          { id: 'snacks', name: 'Travel snacks', isPacked: false, isEssential: true },
          { id: 'entertainment', name: 'Entertainment for kids', isPacked: false, isEssential: false },
          { id: 'chargers', name: 'Device chargers', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Holiday Items',
        icon: '🎄',
        items: [
          { id: 'gifts', name: 'Gifts for host family', isPacked: false, isEssential: false },
          { id: 'outfit', name: 'Holiday outfit', isPacked: false, isEssential: false },
          { id: 'dish', name: 'Contribution dish', isPacked: false, isEssential: false },
          { id: 'decorations', name: 'Small decorations', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Airport food', 'Easy appetizers', 'Store-bought desserts', 'Snack plates'] },
      { complexity: 'moderate', meals: ['Side dish contribution', 'Homemade dessert', 'Breakfast casserole', 'Holiday cookies'] },
      { complexity: 'gourmet', meals: ['Prime rib', 'Beef Wellington', 'Full holiday spread', 'Elegant dessert table'] },
    ],
    tips: [
      'Book travel early for better prices',
      'Pack gifts in carry-on if flying',
      'Bring a contribution for meals',
      'Plan downtime during busy schedules',
      'Take lots of photos',
    ],
    estimatedDailyBudget: { min: 80, max: 200 },
  },

  day_trip: {
    type: 'day_trip',
    icon: '🚐',
    name: 'Day Trip',
    description: 'Quick getaway to explore nearby attractions.',
    suggestedDuration: { min: 1, max: 1 },
    checklists: [
      {
        name: 'Essentials',
        icon: '✅',
        items: [
          { id: 'water', name: 'Water bottles', isPacked: false, isEssential: true },
          { id: 'snacks', name: 'Packed snacks', isPacked: false, isEssential: true },
          { id: 'phone', name: 'Phone & charger', isPacked: false, isEssential: true },
          { id: 'wallet', name: 'Wallet & cash', isPacked: false, isEssential: true },
          { id: 'sunglasses', name: 'Sunglasses', isPacked: false, isEssential: false },
          { id: 'camera', name: 'Camera', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Packed lunch', 'Drive-thru', 'Convenience snacks', 'Picnic sandwiches'] },
      { complexity: 'moderate', meals: ['Local restaurant', 'Food trucks', 'Scenic picnic'] },
      { complexity: 'gourmet', meals: ['Farm-to-table lunch', 'Winery tasting', 'Local specialties'] },
    ],
    tips: [
      'Leave early to maximize time',
      'Check hours of attractions',
      'Bring cash for small vendors',
      'Pack light',
      'Have a backup plan for weather',
    ],
    estimatedDailyBudget: { min: 30, max: 100 },
  },

  picnic: {
    type: 'picnic',
    icon: '🧺',
    name: 'Family Picnic',
    description: 'Enjoy outdoor dining in a park or scenic location.',
    suggestedDuration: { min: 1, max: 1 },
    checklists: [
      {
        name: 'Picnic Supplies',
        icon: '🍽️',
        items: [
          { id: 'blanket', name: 'Picnic blanket', isPacked: false, isEssential: true },
          { id: 'basket', name: 'Picnic basket/cooler', isPacked: false, isEssential: true },
          { id: 'plates', name: 'Plates & utensils', isPacked: false, isEssential: true },
          { id: 'napkins', name: 'Napkins', isPacked: false, isEssential: true },
          { id: 'cups', name: 'Cups', isPacked: false, isEssential: true },
          { id: 'corkscrew', name: 'Bottle opener', isPacked: false, isEssential: false },
          { id: 'trash', name: 'Trash bags', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Activities',
        icon: '⚽',
        items: [
          { id: 'frisbee', name: 'Frisbee', isPacked: false, isEssential: false },
          { id: 'ball', name: 'Ball', isPacked: false, isEssential: false },
          { id: 'cards', name: 'Card games', isPacked: false, isEssential: false },
          { id: 'kite', name: 'Kite', isPacked: false, isEssential: false },
          { id: 'books', name: 'Books', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Sandwiches', 'Chips', 'Fresh fruit', 'Cookies', 'Juice boxes'] },
      { complexity: 'moderate', meals: ['Pasta salad', 'Fried chicken', 'Caprese skewers', 'Bruschetta', 'Lemonade'] },
      { complexity: 'gourmet', meals: ['Charcuterie board', 'Gourmet cheese selection', 'Wine & baguette', 'Fancy desserts'] },
    ],
    tips: [
      'Check if park allows food/drinks',
      'Bring bug spray',
      'Pack food in sealed containers',
      'Arrive early for good spots',
      'Bring shade if no trees',
    ],
    estimatedDailyBudget: { min: 20, max: 60 },
  },

  tailgate: {
    type: 'tailgate',
    icon: '🏈',
    name: 'Tailgate Party',
    description: 'Pre-game festivities with food, friends, and fun.',
    suggestedDuration: { min: 1, max: 1 },
    checklists: [
      {
        name: 'Cooking Setup',
        icon: '🔥',
        items: [
          { id: 'grill', name: 'Portable grill', isPacked: false, isEssential: true },
          { id: 'charcoal', name: 'Charcoal/propane', isPacked: false, isEssential: true },
          { id: 'lighter', name: 'Lighter/matches', isPacked: false, isEssential: true },
          { id: 'utensils', name: 'Grilling utensils', isPacked: false, isEssential: true },
          { id: 'table', name: 'Folding table', isPacked: false, isEssential: false },
          { id: 'cooler', name: 'Cooler with ice', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Game Day Gear',
        icon: '📣',
        items: [
          { id: 'chairs', name: 'Camping chairs', isPacked: false, isEssential: true },
          { id: 'tent', name: 'Pop-up tent/canopy', isPacked: false, isEssential: false },
          { id: 'jersey', name: 'Team gear', isPacked: false, isEssential: false },
          { id: 'games', name: 'Tailgate games (cornhole)', isPacked: false, isEssential: false },
          { id: 'speaker', name: 'Portable speaker', isPacked: false, isEssential: false },
          { id: 'tickets', name: 'Game tickets', isPacked: false, isEssential: true },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Hot dogs', 'Burgers', 'Chips', 'Store-bought dips', 'Beer/sodas'] },
      { complexity: 'moderate', meals: ['BBQ ribs', 'Wings', 'Pulled pork sliders', 'Loaded nachos', 'Chili'] },
      { complexity: 'gourmet', meals: ['Smoked brisket', 'Gourmet burgers', 'Lobster rolls', 'Craft cocktails'] },
    ],
    tips: [
      'Arrive early for parking',
      'Check stadium rules on grills',
      'Bring lots of napkins/wipes',
      'Stay hydrated',
      'Clean up your space',
    ],
    estimatedDailyBudget: { min: 50, max: 150 },
  },

  custom: {
    type: 'custom',
    icon: '✨',
    name: 'Custom Trip',
    description: 'Create your own unique adventure.',
    suggestedDuration: { min: 1, max: 30 },
    checklists: [
      {
        name: 'Documents & Travel',
        icon: '📄',
        items: [
          { id: 'custom_passport', name: 'Passport/ID', isPacked: false, isEssential: true },
          { id: 'custom_boarding', name: 'Boarding passes', isPacked: false, isEssential: true },
          { id: 'custom_hotel_conf', name: 'Hotel confirmation', isPacked: false, isEssential: true },
          { id: 'custom_insurance', name: 'Travel insurance docs', isPacked: false, isEssential: false },
          { id: 'custom_wallet', name: 'Wallet/credit cards', isPacked: false, isEssential: true },
          { id: 'custom_cash', name: 'Cash/local currency', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Clothing & Personal',
        icon: '👕',
        items: [
          { id: 'custom_clothes', name: 'Weather-appropriate clothes', isPacked: false, isEssential: true },
          { id: 'custom_shoes', name: 'Comfortable walking shoes', isPacked: false, isEssential: true },
          { id: 'custom_toiletries', name: 'Toiletries', isPacked: false, isEssential: true },
          { id: 'custom_meds', name: 'Medications', isPacked: false, isEssential: true },
          { id: 'custom_sunscreen', name: 'Sunscreen', isPacked: false, isEssential: false },
          { id: 'custom_jacket', name: 'Light jacket/layers', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'Electronics',
        icon: '🔌',
        items: [
          { id: 'custom_charger', name: 'Phone charger', isPacked: false, isEssential: true },
          { id: 'custom_powerbank', name: 'Power bank', isPacked: false, isEssential: false },
          { id: 'custom_camera', name: 'Camera', isPacked: false, isEssential: false },
          { id: 'custom_adapter', name: 'Travel adapter', isPacked: false, isEssential: false },
          { id: 'custom_headphones', name: 'Headphones', isPacked: false, isEssential: false },
        ],
      },
      {
        name: 'First Aid & Safety',
        icon: '🩹',
        items: [
          { id: 'custom_firstaid', name: 'First aid kit', isPacked: false, isEssential: true },
          { id: 'custom_sanitizer', name: 'Hand sanitizer', isPacked: false, isEssential: false },
          { id: 'custom_masks', name: 'Face masks', isPacked: false, isEssential: false },
          { id: 'custom_emergency', name: 'Emergency contacts list', isPacked: false, isEssential: true },
        ],
      },
      {
        name: 'Food & Snacks',
        icon: '🍎',
        items: [
          { id: 'custom_water', name: 'Water bottles', isPacked: false, isEssential: true },
          { id: 'custom_snacks', name: 'Snacks for travel', isPacked: false, isEssential: false },
          { id: 'custom_dietary', name: 'Dietary essentials', isPacked: false, isEssential: false },
        ],
      },
    ],
    mealSuggestions: [
      { complexity: 'quick_easy', meals: ['Sandwiches', 'Salads', 'Wraps', 'Fruit', 'Trail mix'] },
      { complexity: 'moderate', meals: ['Pasta dishes', 'Grilled chicken', 'Stir fry', 'Tacos'] },
      { complexity: 'gourmet', meals: ['Steak dinner', 'Seafood platter', 'Local cuisine', 'Fine dining'] },
    ],
    tips: [
      'Plan ahead and research your destination',
      'Make a detailed packing list',
      'Keep important documents accessible',
      'Enjoy the journey!',
    ],
    estimatedDailyBudget: { min: 50, max: 200 },
  },
};

// ==================== TRIP COST ESTIMATES ====================

const TRIP_COST_ESTIMATES: Record<TripType, { hotelPerNight: number; flightPerPerson: number }> = {
  camping:          { hotelPerNight: 0,   flightPerPerson: 0 },
  road_trip:        { hotelPerNight: 140, flightPerPerson: 0 },
  beach_vacation:   { hotelPerNight: 200, flightPerPerson: 350 },
  mountain_getaway: { hotelPerNight: 180, flightPerPerson: 300 },
  city_break:       { hotelPerNight: 200, flightPerPerson: 350 },
  family_reunion:   { hotelPerNight: 150, flightPerPerson: 300 },
  holiday_travel:   { hotelPerNight: 180, flightPerPerson: 400 },
  day_trip:         { hotelPerNight: 0,   flightPerPerson: 0 },
  picnic:           { hotelPerNight: 0,   flightPerPerson: 0 },
  tailgate:         { hotelPerNight: 0,   flightPerPerson: 0 },
  custom:           { hotelPerNight: 180, flightPerPerson: 350 },
};

// ==================== TRIP RECIPES ====================

export const TRIP_RECIPES: TripRecipe[] = [
  // CAMPING - Quick & Easy
  {
    id: 'camp_hotdogs',
    name: 'Classic Campfire Hot Dogs',
    description: 'The quintessential camping meal - simple and delicious.',
    complexity: 'quick_easy',
    suitableFor: ['camping', 'picnic', 'tailgate'],
    servings: 4,
    prepTime: '5 min',
    cookTime: '10 min',
    totalTime: '15 min',
    ingredients: [
      { item: 'Hot dogs', amount: '8' },
      { item: 'Hot dog buns', amount: '8' },
      { item: 'Ketchup', amount: 'to taste' },
      { item: 'Mustard', amount: 'to taste' },
      { item: 'Relish', amount: 'to taste', optional: true },
      { item: 'Onions (diced)', amount: '1/2 cup', optional: true },
    ],
    instructions: [
      'Thread hot dogs onto roasting sticks',
      'Hold over campfire, rotating frequently',
      'Cook until heated through and slightly charred (5-8 min)',
      'Toast buns lightly on grill grate',
      'Assemble with favorite toppings',
    ],
    equipment: ['Roasting sticks', 'Campfire or grill'],
    tips: ['Make diagonal cuts for even cooking', 'Pre-toast buns for better texture'],
    icon: '🌭',
  },
  {
    id: 'camp_smores',
    name: 'Perfect S\'mores',
    description: 'No camping trip is complete without this gooey treat.',
    complexity: 'quick_easy',
    suitableFor: ['camping'],
    servings: 4,
    prepTime: '2 min',
    cookTime: '3 min',
    totalTime: '5 min',
    ingredients: [
      { item: 'Graham crackers', amount: '8 sheets' },
      { item: 'Marshmallows', amount: '16 large' },
      { item: 'Chocolate bars', amount: '4' },
    ],
    instructions: [
      'Thread marshmallow onto roasting stick',
      'Hold over campfire coals (not flames)',
      'Rotate slowly for even golden brown',
      'Break graham cracker in half',
      'Place chocolate on one half',
      'Sandwich hot marshmallow with crackers',
      'Slide off stick and enjoy!',
    ],
    equipment: ['Roasting sticks', 'Campfire'],
    tips: ['Use coals not flames for even browning', 'Try peanut butter cups instead of chocolate'],
    icon: '🍫',
  },
  // CAMPING - Moderate
  {
    id: 'camp_burgers',
    name: 'Campfire Smash Burgers',
    description: 'Juicy burgers with that perfect char-grilled flavor.',
    complexity: 'moderate',
    suitableFor: ['camping', 'tailgate', 'picnic'],
    servings: 4,
    prepTime: '10 min',
    cookTime: '15 min',
    totalTime: '25 min',
    ingredients: [
      { item: 'Ground beef (80/20)', amount: '1.5 lbs' },
      { item: 'Burger buns', amount: '4' },
      { item: 'Salt', amount: '1 tsp' },
      { item: 'Black pepper', amount: '1/2 tsp' },
      { item: 'American cheese', amount: '4 slices' },
      { item: 'Lettuce', amount: '4 leaves' },
      { item: 'Tomato', amount: '1, sliced' },
      { item: 'Onion', amount: '1, sliced' },
    ],
    instructions: [
      'Form beef into 4 loosely packed balls',
      'Heat cast iron or grill grate over fire',
      'Place balls on hot surface, smash with spatula',
      'Season with salt and pepper',
      'Cook 3-4 minutes until edges are crispy',
      'Flip, add cheese, cook 2 more minutes',
      'Toast buns on grill',
      'Assemble burgers with toppings',
    ],
    equipment: ['Cast iron skillet or grill grate', 'Spatula', 'Campfire or portable grill'],
    tips: ['Don\'t press the burger after smashing', 'Let meat rest at room temp before cooking'],
    icon: '🍔',
  },
  {
    id: 'camp_foil_packets',
    name: 'Foil Packet Dinners',
    description: 'Easy one-packet meals with endless customization.',
    complexity: 'moderate',
    suitableFor: ['camping'],
    servings: 4,
    prepTime: '15 min',
    cookTime: '25 min',
    totalTime: '40 min',
    ingredients: [
      { item: 'Chicken breasts or sausage', amount: '1 lb' },
      { item: 'Baby potatoes', amount: '1 lb, halved' },
      { item: 'Mixed vegetables', amount: '2 cups' },
      { item: 'Olive oil', amount: '2 tbsp' },
      { item: 'Italian seasoning', amount: '1 tbsp' },
      { item: 'Garlic powder', amount: '1 tsp' },
      { item: 'Salt and pepper', amount: 'to taste' },
    ],
    instructions: [
      'Tear 4 large sheets of heavy-duty foil',
      'Divide potatoes among sheets',
      'Top with protein and vegetables',
      'Drizzle with oil, season well',
      'Fold foil into sealed packets',
      'Place on campfire coals or grill',
      'Cook 20-25 minutes, flipping halfway',
      'Carefully open (steam!) and serve',
    ],
    equipment: ['Heavy-duty aluminum foil', 'Campfire or grill', 'Tongs'],
    tips: ['Double wrap for extra protection', 'Pre-cut veggies at home to save time'],
    icon: '🥔',
  },
  // CAMPING - Gourmet
  {
    id: 'camp_steak',
    name: 'Cast Iron Campfire Steak',
    description: 'Restaurant-quality steak cooked over an open fire.',
    complexity: 'gourmet',
    suitableFor: ['camping'],
    servings: 4,
    prepTime: '10 min',
    cookTime: '15 min',
    totalTime: '25 min + 30 min rest',
    ingredients: [
      { item: 'Ribeye steaks', amount: '4 (1-inch thick)' },
      { item: 'Butter', amount: '4 tbsp' },
      { item: 'Fresh rosemary', amount: '4 sprigs' },
      { item: 'Fresh thyme', amount: '8 sprigs' },
      { item: 'Garlic cloves', amount: '4, smashed' },
      { item: 'Coarse salt', amount: '2 tbsp' },
      { item: 'Black pepper', amount: '1 tbsp' },
    ],
    instructions: [
      'Remove steaks from cooler 30 min before cooking',
      'Season generously with salt and pepper',
      'Heat cast iron over hot coals until smoking',
      'Add steaks, sear 3-4 minutes per side',
      'Add butter, herbs, and garlic',
      'Baste steaks with melted butter',
      'Remove at 125°F for medium-rare',
      'Rest 5 minutes before slicing',
    ],
    equipment: ['Cast iron skillet', 'Campfire with hot coals', 'Meat thermometer', 'Tongs'],
    tips: ['Pat steaks dry for better sear', 'Use hardwood for better coals'],
    icon: '🥩',
  },
  {
    id: 'camp_paella',
    name: 'Campfire Paella',
    description: 'An impressive one-pan Spanish feast over open flame.',
    complexity: 'gourmet',
    suitableFor: ['camping', 'beach_vacation'],
    servings: 6,
    prepTime: '20 min',
    cookTime: '40 min',
    totalTime: '1 hour',
    ingredients: [
      { item: 'Bomba or short-grain rice', amount: '2 cups' },
      { item: 'Chicken thighs', amount: '1 lb, cubed' },
      { item: 'Chorizo', amount: '8 oz, sliced' },
      { item: 'Shrimp', amount: '1/2 lb, deveined' },
      { item: 'Chicken broth', amount: '4 cups' },
      { item: 'Saffron threads', amount: '1/4 tsp' },
      { item: 'Smoked paprika', amount: '1 tbsp' },
      { item: 'Bell peppers', amount: '2, sliced' },
      { item: 'Onion', amount: '1, diced' },
      { item: 'Garlic', amount: '4 cloves' },
      { item: 'Olive oil', amount: '1/4 cup' },
      { item: 'Lemon', amount: '1, wedged' },
      { item: 'Fresh parsley', amount: 'for garnish' },
    ],
    instructions: [
      'Bloom saffron in warm broth',
      'Heat large pan over campfire',
      'Brown chicken and chorizo, set aside',
      'Sauté onion, peppers, garlic',
      'Add rice, toast 2 minutes',
      'Add paprika, stir well',
      'Pour in saffron broth',
      'Arrange meat on top, do not stir',
      'Cook 20 min until rice absorbs liquid',
      'Add shrimp last 5 minutes',
      'Let rest 5 min, serve with lemon',
    ],
    equipment: ['Large paella pan or cast iron skillet', 'Campfire with adjustable height'],
    tips: ['Don\'t stir after adding broth', 'Socarrat (crispy bottom) is the prize'],
    allergenInfo: ['shellfish'],
    icon: '🥘',
  },
  // ROAD TRIP - Quick & Easy
  {
    id: 'road_sandwiches',
    name: 'Road Trip Wraps',
    description: 'Mess-free, filling wraps perfect for eating on the go.',
    complexity: 'quick_easy',
    suitableFor: ['road_trip', 'day_trip', 'picnic'],
    servings: 4,
    prepTime: '15 min',
    cookTime: '0 min',
    totalTime: '15 min',
    ingredients: [
      { item: 'Large flour tortillas', amount: '4' },
      { item: 'Deli turkey or ham', amount: '1/2 lb' },
      { item: 'Cheese slices', amount: '4' },
      { item: 'Lettuce', amount: '1 cup, shredded' },
      { item: 'Tomato', amount: '1, sliced thin' },
      { item: 'Mayo or hummus', amount: '4 tbsp' },
    ],
    instructions: [
      'Lay tortillas flat',
      'Spread mayo/hummus leaving 1-inch border',
      'Layer meat, cheese, lettuce, tomato',
      'Fold bottom up, then sides in',
      'Roll tightly from bottom',
      'Wrap in foil or parchment for easy eating',
    ],
    equipment: ['Cutting board', 'Foil or parchment paper'],
    tips: ['Make night before and refrigerate', 'Pack sauces separately to prevent sogginess'],
    icon: '🌯',
  },
  // BEACH - Moderate
  {
    id: 'beach_tacos',
    name: 'Grilled Fish Tacos',
    description: 'Fresh, light tacos perfect for a beach day.',
    complexity: 'moderate',
    suitableFor: ['beach_vacation', 'camping'],
    servings: 4,
    prepTime: '15 min',
    cookTime: '10 min',
    totalTime: '25 min',
    ingredients: [
      { item: 'White fish fillets (mahi, cod)', amount: '1 lb' },
      { item: 'Corn tortillas', amount: '8 small' },
      { item: 'Cabbage', amount: '2 cups, shredded' },
      { item: 'Lime', amount: '2' },
      { item: 'Cilantro', amount: '1/2 cup, chopped' },
      { item: 'Sour cream', amount: '1/2 cup' },
      { item: 'Chipotle in adobo', amount: '1 tbsp' },
      { item: 'Cumin', amount: '1 tsp' },
      { item: 'Garlic powder', amount: '1 tsp' },
      { item: 'Olive oil', amount: '2 tbsp' },
    ],
    instructions: [
      'Mix sour cream with chipotle for sauce',
      'Season fish with cumin, garlic, salt',
      'Grill fish 3-4 min per side',
      'Warm tortillas on grill',
      'Flake fish into chunks',
      'Assemble: tortilla, fish, cabbage, cilantro',
      'Drizzle with sauce, squeeze lime',
    ],
    equipment: ['Grill or grill pan', 'Tongs'],
    tips: ['Don\'t overcook fish - it continues cooking off heat', 'Make extra sauce'],
    allergenInfo: ['fish'],
    icon: '🌮',
  },
  // ROAD TRIP - Moderate
  {
    id: 'road_cheese_board',
    name: 'Road Trip Snack Board',
    description: 'An easy-to-eat assortment perfect for the passenger seat.',
    complexity: 'moderate',
    suitableFor: ['road_trip', 'day_trip'],
    servings: 4,
    prepTime: '10 min',
    cookTime: '0 min',
    totalTime: '10 min',
    ingredients: [
      { item: 'Sliced cheese', amount: '8 oz' },
      { item: 'Crackers', amount: '1 sleeve' },
      { item: 'Grapes', amount: '1 cup' },
      { item: 'Salami slices', amount: '4 oz' },
      { item: 'Mixed nuts', amount: '1/2 cup' },
      { item: 'Dark chocolate', amount: '2 oz' },
    ],
    instructions: [
      'Arrange all items in a container with compartments',
      'Pack napkins and wet wipes',
      'Keep cooler bag for cheese and grapes',
      'Pass around and enjoy on the drive!',
    ],
    equipment: ['Divided container', 'Small cooler bag'],
    tips: ['Pre-slice everything for easy eating', 'Avoid messy dips'],
    icon: '🧀',
  },
  // ROAD TRIP - Gourmet
  {
    id: 'road_gourmet_picnic',
    name: 'Scenic Stop Gourmet Picnic',
    description: 'Elevate your rest stop with a restaurant-worthy spread.',
    complexity: 'gourmet',
    suitableFor: ['road_trip', 'day_trip', 'picnic'],
    servings: 4,
    prepTime: '30 min',
    cookTime: '0 min',
    totalTime: '30 min',
    ingredients: [
      { item: 'Baguette', amount: '1 loaf' },
      { item: 'Brie cheese', amount: '6 oz' },
      { item: 'Prosciutto', amount: '4 oz' },
      { item: 'Fig spread', amount: '1 jar' },
      { item: 'Arugula', amount: '2 cups' },
      { item: 'Cherry tomatoes', amount: '1 pint' },
      { item: 'Olive oil', amount: '2 tbsp' },
      { item: 'Balsamic glaze', amount: '2 tbsp' },
      { item: 'Sparkling water', amount: '4 bottles' },
    ],
    instructions: [
      'Find a scenic rest stop or park',
      'Lay out picnic blanket',
      'Slice baguette at an angle',
      'Arrange all items on cutting board',
      'Drizzle arugula with olive oil and balsamic',
      'Make open-faced sandwiches with brie, prosciutto, fig',
      'Enjoy with sparkling water',
    ],
    equipment: ['Picnic blanket', 'Cutting board', 'Bread knife'],
    tips: ['Take brie out 20 min before for best texture', 'Pack everything in a quality cooler'],
    icon: '🥖',
  },
  // BEACH - Gourmet
  {
    id: 'beach_poke_bowl',
    name: 'Fresh Poke Bowls',
    description: 'Hawaiian-style raw fish bowls perfect for beach vibes.',
    complexity: 'gourmet',
    suitableFor: ['beach_vacation'],
    servings: 4,
    prepTime: '25 min',
    cookTime: '20 min',
    totalTime: '45 min',
    ingredients: [
      { item: 'Sushi-grade ahi tuna', amount: '1 lb' },
      { item: 'Sushi rice', amount: '2 cups' },
      { item: 'Soy sauce', amount: '3 tbsp' },
      { item: 'Sesame oil', amount: '2 tbsp' },
      { item: 'Rice vinegar', amount: '2 tbsp' },
      { item: 'Avocado', amount: '2' },
      { item: 'Cucumber', amount: '1' },
      { item: 'Edamame', amount: '1 cup' },
      { item: 'Green onions', amount: '4' },
      { item: 'Sesame seeds', amount: '2 tbsp' },
      { item: 'Sriracha mayo', amount: '4 tbsp' },
    ],
    instructions: [
      'Cook sushi rice and let cool',
      'Cube tuna into 1-inch pieces',
      'Mix tuna with soy sauce, sesame oil, green onions',
      'Slice cucumber and avocado',
      'Build bowls: rice, tuna, avocado, cucumber, edamame',
      'Top with sesame seeds and sriracha mayo',
    ],
    equipment: ['Sharp knife', 'Mixing bowls'],
    tips: ['Keep tuna very cold until serving', 'Prep toppings in advance'],
    allergenInfo: ['fish', 'soy', 'sesame'],
    icon: '🍣',
  },
  // MOUNTAIN - Moderate
  {
    id: 'mountain_chili',
    name: 'Hearty Cabin Chili',
    description: 'Warm up after a hike with this comforting classic.',
    complexity: 'moderate',
    suitableFor: ['mountain_getaway', 'camping'],
    servings: 6,
    prepTime: '15 min',
    cookTime: '45 min',
    totalTime: '1 hour',
    ingredients: [
      { item: 'Ground beef', amount: '1.5 lbs' },
      { item: 'Onion', amount: '1 large' },
      { item: 'Bell pepper', amount: '1' },
      { item: 'Kidney beans', amount: '2 cans' },
      { item: 'Diced tomatoes', amount: '2 cans' },
      { item: 'Tomato paste', amount: '3 tbsp' },
      { item: 'Chili powder', amount: '2 tbsp' },
      { item: 'Cumin', amount: '1 tbsp' },
      { item: 'Garlic', amount: '4 cloves' },
      { item: 'Beef broth', amount: '1 cup' },
    ],
    instructions: [
      'Brown beef in large pot, drain fat',
      'Add onion and pepper, cook 5 min',
      'Add garlic and spices, stir 1 min',
      'Add beans, tomatoes, paste, broth',
      'Simmer 30-40 minutes, stirring occasionally',
      'Serve with cheese, sour cream, cornbread',
    ],
    equipment: ['Large pot or dutch oven'],
    tips: ['Tastes even better the next day', 'Freeze leftovers in portions'],
    icon: '🍲',
  },
  // MOUNTAIN - Gourmet
  {
    id: 'mountain_fondue',
    name: 'Alpine Cheese Fondue',
    description: 'A cozy, interactive meal perfect for mountain evenings.',
    complexity: 'gourmet',
    suitableFor: ['mountain_getaway'],
    servings: 4,
    prepTime: '15 min',
    cookTime: '20 min',
    totalTime: '35 min',
    ingredients: [
      { item: 'Gruyère cheese', amount: '8 oz, shredded' },
      { item: 'Emmental cheese', amount: '8 oz, shredded' },
      { item: 'Dry white wine', amount: '1 cup' },
      { item: 'Garlic clove', amount: '1' },
      { item: 'Cornstarch', amount: '1 tbsp' },
      { item: 'Kirsch (optional)', amount: '2 tbsp' },
      { item: 'Nutmeg', amount: 'pinch' },
      { item: 'Baguette cubes', amount: '1 loaf' },
      { item: 'Apple slices', amount: '2 apples' },
      { item: 'Steamed broccoli', amount: '2 cups' },
    ],
    instructions: [
      'Rub fondue pot with cut garlic',
      'Heat wine over medium heat',
      'Toss cheese with cornstarch',
      'Add cheese gradually, stirring in figure-8',
      'Stir until smooth and creamy',
      'Add kirsch and nutmeg',
      'Serve with bread, apples, and veggies',
    ],
    equipment: ['Fondue pot with burner', 'Long fondue forks'],
    tips: ['Never let it boil', 'Keep stirring to prevent separation'],
    allergenInfo: ['dairy'],
    icon: '🫕',
  },
  // PICNIC - Gourmet
  {
    id: 'picnic_charcuterie',
    name: 'Gourmet Picnic Board',
    description: 'An elegant spread of meats, cheeses, and accompaniments.',
    complexity: 'gourmet',
    suitableFor: ['picnic', 'day_trip'],
    servings: 4,
    prepTime: '20 min',
    cookTime: '0 min',
    totalTime: '20 min',
    ingredients: [
      { item: 'Prosciutto', amount: '4 oz' },
      { item: 'Salami', amount: '4 oz' },
      { item: 'Brie cheese', amount: '4 oz wedge' },
      { item: 'Aged cheddar', amount: '4 oz' },
      { item: 'Manchego', amount: '4 oz' },
      { item: 'Marcona almonds', amount: '1/2 cup' },
      { item: 'Dried apricots', amount: '1/2 cup' },
      { item: 'Fig jam', amount: '4 oz jar' },
      { item: 'Honey', amount: 'small jar' },
      { item: 'Crackers assortment', amount: '1 box' },
      { item: 'Fresh grapes', amount: '1 bunch' },
      { item: 'Cornichons', amount: '1/2 cup' },
    ],
    instructions: [
      'Choose a large board or platter',
      'Place cheese wedges at different points',
      'Fan out meats between cheeses',
      'Add small bowls for jam and honey',
      'Fill gaps with nuts, fruit, cornichons',
      'Arrange crackers around edges',
      'Add small serving utensils',
    ],
    equipment: ['Large cutting board or platter', 'Cheese knives', 'Small bowls'],
    tips: ['Take out of cooler 20 min before serving', 'Add fresh herbs for color'],
    allergenInfo: ['dairy', 'tree_nuts'],
    icon: '🧀',
  },
  // CITY BREAK - Quick
  {
    id: 'city_quick_bites',
    name: 'Hotel Room Snack Plate',
    description: 'Easy no-cook bites for between sightseeing.',
    complexity: 'quick_easy',
    suitableFor: ['city_break', 'holiday_travel'],
    servings: 2,
    prepTime: '5 min',
    cookTime: '0 min',
    totalTime: '5 min',
    ingredients: [
      { item: 'Mixed nuts', amount: '1/2 cup' },
      { item: 'Fresh fruit', amount: '2 pieces' },
      { item: 'Cheese sticks', amount: '4' },
      { item: 'Crackers', amount: '1 sleeve' },
      { item: 'Dark chocolate', amount: '2 oz' },
    ],
    instructions: [
      'Arrange all items on a plate or tray',
      'Perfect for late night hotel snacking',
    ],
    equipment: ['None required'],
    tips: ['Pick up items from a local grocery store', 'Great for saving money on dining'],
    icon: '🍇',
  },
  // CITY BREAK - Moderate
  {
    id: 'city_food_tour',
    name: 'DIY Food Market Tour',
    description: 'Curate your own tasting experience at local markets.',
    complexity: 'moderate',
    suitableFor: ['city_break', 'day_trip'],
    servings: 4,
    prepTime: '1 hour',
    cookTime: '0 min',
    totalTime: '1 hour',
    ingredients: [
      { item: 'Local cheeses', amount: 'variety' },
      { item: 'Fresh bread', amount: '1 loaf' },
      { item: 'Cured meats', amount: 'selection' },
      { item: 'Local olives', amount: '1 cup' },
      { item: 'Seasonal fruit', amount: 'variety' },
      { item: 'Local wine or juice', amount: '1 bottle' },
    ],
    instructions: [
      'Research local food markets before your trip',
      'Visit in the morning for best selection',
      'Sample before buying when offered',
      'Ask vendors for their recommendations',
      'Find a nice park or square to enjoy your finds',
    ],
    equipment: ['Tote bag', 'Small knife', 'Napkins'],
    tips: ['Bring cash for small vendors', 'Ask locals for their favorite stalls'],
    icon: '🏪',
  },
  // CITY BREAK - Gourmet
  {
    id: 'city_cooking_class',
    name: 'Local Cooking Class Experience',
    description: 'Learn regional cuisine from local chefs.',
    complexity: 'gourmet',
    suitableFor: ['city_break'],
    servings: 4,
    prepTime: '30 min',
    cookTime: '2 hours',
    totalTime: '2.5 hours',
    ingredients: [
      { item: 'Provided by cooking school', amount: 'all included' },
    ],
    instructions: [
      'Book a cooking class before your trip',
      'Choose a cuisine that interests you',
      'Arrive with an empty stomach',
      'Take notes and photos',
      'Ask for recipes to recreate at home',
    ],
    equipment: ['Provided by cooking school'],
    tips: ['Book popular classes weeks in advance', 'Check reviews on TripAdvisor'],
    icon: '👨‍🍳',
  },
  // TAILGATE - Moderate
  {
    id: 'tailgate_wings',
    name: 'Game Day Buffalo Wings',
    description: 'Crispy, saucy wings that are stadium-worthy.',
    complexity: 'moderate',
    suitableFor: ['tailgate', 'family_reunion'],
    servings: 6,
    prepTime: '15 min',
    cookTime: '45 min',
    totalTime: '1 hour',
    ingredients: [
      { item: 'Chicken wings', amount: '3 lbs' },
      { item: 'Butter', amount: '1/2 cup' },
      { item: 'Hot sauce', amount: '1/2 cup' },
      { item: 'Garlic powder', amount: '1 tsp' },
      { item: 'Celery sticks', amount: '1 bunch' },
      { item: 'Blue cheese dressing', amount: '1 cup' },
    ],
    instructions: [
      'Pat wings dry with paper towels',
      'Grill wings over medium heat 20-25 min per side',
      'Melt butter, mix with hot sauce and garlic',
      'Toss grilled wings in sauce',
      'Serve with celery and blue cheese',
    ],
    equipment: ['Portable grill', 'Tongs', 'Large bowl'],
    tips: ['Double the sauce - people love extra', 'Make ranch for those who prefer it'],
    icon: '🍗',
  },
  // TAILGATE - Gourmet
  {
    id: 'tailgate_brisket',
    name: 'Smoked Brisket Sliders',
    description: 'Low and slow smoked brisket for the ultimate tailgate.',
    complexity: 'gourmet',
    suitableFor: ['tailgate'],
    servings: 12,
    prepTime: '30 min',
    cookTime: '8 hours',
    totalTime: '8.5 hours',
    ingredients: [
      { item: 'Beef brisket', amount: '5 lbs' },
      { item: 'BBQ rub', amount: '1/4 cup' },
      { item: 'Slider buns', amount: '24' },
      { item: 'BBQ sauce', amount: '2 cups' },
      { item: 'Coleslaw', amount: '2 cups' },
      { item: 'Pickles', amount: '1 jar' },
    ],
    instructions: [
      'Season brisket generously with rub night before',
      'Start smoker at 225°F',
      'Smoke brisket fat-side up 6-8 hours',
      'Wrap in butcher paper at 165°F internal',
      'Continue until 203°F internal',
      'Rest 1 hour before slicing',
      'Slice thin against the grain',
      'Serve on sliders with slaw and pickles',
    ],
    equipment: ['Smoker', 'Meat thermometer', 'Butcher paper'],
    tips: ['Start the night before for game day ready', 'Save the burnt ends for snacking'],
    icon: '🥩',
  },
  // FAMILY REUNION - Moderate
  {
    id: 'reunion_pulled_pork',
    name: 'Crowd-Pleasing Pulled Pork',
    description: 'Feed the whole family with this easy slow-cooker favorite.',
    complexity: 'moderate',
    suitableFor: ['family_reunion', 'tailgate'],
    servings: 12,
    prepTime: '15 min',
    cookTime: '8 hours',
    totalTime: '8 hours',
    ingredients: [
      { item: 'Pork shoulder', amount: '5 lbs' },
      { item: 'BBQ sauce', amount: '2 cups' },
      { item: 'Apple cider vinegar', amount: '1/4 cup' },
      { item: 'Brown sugar', amount: '2 tbsp' },
      { item: 'Paprika', amount: '1 tbsp' },
      { item: 'Garlic powder', amount: '1 tbsp' },
      { item: 'Hamburger buns', amount: '12' },
      { item: 'Coleslaw', amount: 'for serving' },
    ],
    instructions: [
      'Mix dry seasonings and rub on pork',
      'Place pork in slow cooker',
      'Add vinegar and 1/2 cup BBQ sauce',
      'Cook on low 8 hours until fork tender',
      'Shred with two forks',
      'Mix in remaining BBQ sauce',
      'Serve on buns with coleslaw',
    ],
    equipment: ['Slow cooker', 'Two forks'],
    tips: ['Make a day ahead - it reheats beautifully', 'Offer multiple BBQ sauce options'],
    icon: '🐷',
  },
  // FAMILY REUNION - Gourmet
  {
    id: 'reunion_heritage_recipe',
    name: 'Family Heritage Recipe',
    description: 'Pass down traditions with a special family dish.',
    complexity: 'gourmet',
    suitableFor: ['family_reunion', 'holiday_travel'],
    servings: 8,
    prepTime: '1 hour',
    cookTime: 'varies',
    totalTime: 'varies',
    ingredients: [
      { item: 'Ingredients from family recipe', amount: 'as needed' },
      { item: 'Love and tradition', amount: 'plenty' },
    ],
    instructions: [
      'Gather the original recipe from family elders',
      'Shop for authentic ingredients',
      'Involve multiple generations in cooking',
      'Share stories while preparing',
      'Document the process with photos',
      'Write down any "secret" tips shared',
    ],
    equipment: ['Whatever the recipe requires'],
    tips: ['Record video of older family members cooking', 'Make copies of the recipe for everyone'],
    icon: '👵',
  },
  // HOLIDAY TRAVEL - Moderate
  {
    id: 'holiday_breakfast_casserole',
    name: 'Make-Ahead Breakfast Casserole',
    description: 'Prep the night before for a stress-free holiday morning.',
    complexity: 'moderate',
    suitableFor: ['holiday_travel', 'family_reunion'],
    servings: 8,
    prepTime: '20 min',
    cookTime: '45 min',
    totalTime: '1 hour + overnight',
    ingredients: [
      { item: 'Eggs', amount: '12' },
      { item: 'Milk', amount: '1 cup' },
      { item: 'Bread cubes', amount: '4 cups' },
      { item: 'Breakfast sausage', amount: '1 lb' },
      { item: 'Cheddar cheese', amount: '2 cups shredded' },
      { item: 'Bell pepper', amount: '1, diced' },
      { item: 'Onion', amount: '1, diced' },
    ],
    instructions: [
      'Brown sausage with peppers and onion',
      'Layer bread cubes in greased 9x13 pan',
      'Top with sausage mixture and cheese',
      'Whisk eggs and milk, pour over',
      'Cover and refrigerate overnight',
      'Bake at 350°F for 45 minutes',
      'Let rest 10 minutes before serving',
    ],
    equipment: ['9x13 baking dish', 'Skillet'],
    tips: ['Add mushrooms or spinach for variation', 'Can be frozen before baking'],
    allergenInfo: ['dairy', 'eggs', 'gluten'],
    icon: '🍳',
  },
  // HOLIDAY TRAVEL - Gourmet
  {
    id: 'holiday_prime_rib',
    name: 'Perfect Prime Rib Roast',
    description: 'The showstopper centerpiece for holiday gatherings.',
    complexity: 'gourmet',
    suitableFor: ['holiday_travel', 'family_reunion'],
    servings: 8,
    prepTime: '20 min',
    cookTime: '3 hours',
    totalTime: '3.5 hours + rest',
    ingredients: [
      { item: 'Prime rib roast', amount: '6-7 lbs, bone-in' },
      { item: 'Garlic', amount: '8 cloves, minced' },
      { item: 'Fresh rosemary', amount: '3 tbsp, chopped' },
      { item: 'Fresh thyme', amount: '2 tbsp, chopped' },
      { item: 'Butter', amount: '4 tbsp, softened' },
      { item: 'Kosher salt', amount: '2 tbsp' },
      { item: 'Black pepper', amount: '1 tbsp' },
      { item: 'Horseradish cream', amount: 'for serving' },
    ],
    instructions: [
      'Remove roast from fridge 2 hours before cooking',
      'Mix butter, garlic, herbs, salt, and pepper',
      'Rub mixture all over roast',
      'Roast at 450°F for 20 minutes',
      'Reduce to 325°F, roast 15 min per pound',
      'Remove at 120°F for medium-rare',
      'Rest 20-30 minutes tented with foil',
      'Slice and serve with horseradish',
    ],
    equipment: ['Roasting pan with rack', 'Meat thermometer'],
    tips: ['Ask butcher to French the bones', 'Save drippings for Yorkshire pudding'],
    icon: '🍖',
  },
  // DAY TRIP - Quick
  {
    id: 'daytrip_trail_mix',
    name: 'Energy Trail Mix',
    description: 'Custom mix for sustained energy on adventures.',
    complexity: 'quick_easy',
    suitableFor: ['day_trip', 'mountain_getaway', 'camping'],
    servings: 4,
    prepTime: '5 min',
    cookTime: '0 min',
    totalTime: '5 min',
    ingredients: [
      { item: 'Mixed nuts', amount: '1 cup' },
      { item: 'Dried cranberries', amount: '1/2 cup' },
      { item: 'Dark chocolate chips', amount: '1/2 cup' },
      { item: 'Pretzel pieces', amount: '1/2 cup' },
      { item: 'Coconut flakes', amount: '1/4 cup' },
    ],
    instructions: [
      'Combine all ingredients in a bowl',
      'Mix well',
      'Portion into snack bags',
    ],
    equipment: ['Mixing bowl', 'Snack bags'],
    tips: ['Customize with your favorite add-ins', 'Add seeds for extra protein'],
    allergenInfo: ['tree_nuts'],
    icon: '🥜',
  },
  // DAY TRIP - Moderate
  {
    id: 'daytrip_pasta_salad',
    name: 'Make-Ahead Pasta Salad',
    description: 'Travels well and tastes better after marinating.',
    complexity: 'moderate',
    suitableFor: ['day_trip', 'picnic', 'beach_vacation'],
    servings: 6,
    prepTime: '20 min',
    cookTime: '10 min',
    totalTime: '30 min + chill',
    ingredients: [
      { item: 'Rotini pasta', amount: '1 lb' },
      { item: 'Cherry tomatoes', amount: '1 pint, halved' },
      { item: 'Cucumber', amount: '1, diced' },
      { item: 'Red onion', amount: '1/4, thinly sliced' },
      { item: 'Feta cheese', amount: '1 cup, crumbled' },
      { item: 'Kalamata olives', amount: '1/2 cup' },
      { item: 'Italian dressing', amount: '3/4 cup' },
      { item: 'Fresh basil', amount: '1/4 cup, chopped' },
    ],
    instructions: [
      'Cook pasta according to package, drain and cool',
      'Combine pasta with vegetables and olives',
      'Add dressing and toss well',
      'Fold in feta and basil',
      'Refrigerate at least 2 hours',
      'Toss again before serving',
    ],
    equipment: ['Large pot', 'Large bowl'],
    tips: ['Make the night before for best flavor', 'Pack dressing separately if traveling far'],
    allergenInfo: ['gluten', 'dairy'],
    icon: '🥗',
  },
  // PICNIC - Quick
  {
    id: 'picnic_quick_sandwich',
    name: 'Classic Picnic Sandwiches',
    description: 'Simple, satisfying sandwiches everyone loves.',
    complexity: 'quick_easy',
    suitableFor: ['picnic', 'day_trip', 'road_trip'],
    servings: 4,
    prepTime: '10 min',
    cookTime: '0 min',
    totalTime: '10 min',
    ingredients: [
      { item: 'Sliced bread', amount: '8 slices' },
      { item: 'Deli turkey', amount: '8 oz' },
      { item: 'Swiss cheese', amount: '4 slices' },
      { item: 'Lettuce', amount: '4 leaves' },
      { item: 'Tomato', amount: '1, sliced' },
      { item: 'Mayo', amount: '2 tbsp' },
      { item: 'Mustard', amount: '2 tbsp' },
    ],
    instructions: [
      'Spread condiments on bread',
      'Layer meat, cheese, lettuce, tomato',
      'Top with second slice',
      'Cut diagonally',
      'Wrap individually in parchment',
    ],
    equipment: ['Cutting board', 'Parchment paper'],
    tips: ['Pack condiments separately to prevent soggy bread', 'Wrap tightly for travel'],
    allergenInfo: ['gluten', 'dairy'],
    icon: '🥪',
  },
  // PICNIC - Moderate
  {
    id: 'picnic_fried_chicken',
    name: 'Picnic Fried Chicken',
    description: 'Cold fried chicken is a picnic tradition.',
    complexity: 'moderate',
    suitableFor: ['picnic', 'family_reunion'],
    servings: 6,
    prepTime: '30 min',
    cookTime: '30 min',
    totalTime: '1 hour',
    ingredients: [
      { item: 'Chicken pieces', amount: '3 lbs' },
      { item: 'Buttermilk', amount: '2 cups' },
      { item: 'All-purpose flour', amount: '2 cups' },
      { item: 'Paprika', amount: '1 tbsp' },
      { item: 'Garlic powder', amount: '1 tsp' },
      { item: 'Salt', amount: '1 tbsp' },
      { item: 'Black pepper', amount: '1 tsp' },
      { item: 'Vegetable oil', amount: 'for frying' },
    ],
    instructions: [
      'Soak chicken in buttermilk 2 hours or overnight',
      'Mix flour with seasonings',
      'Heat oil to 350°F',
      'Dredge chicken in flour mixture',
      'Fry 12-15 minutes until golden and cooked through',
      'Drain on wire rack',
      'Cool completely before packing',
    ],
    equipment: ['Deep pot or dutch oven', 'Wire rack', 'Thermometer'],
    tips: ['Cold fried chicken tastes amazing', 'Make the night before'],
    allergenInfo: ['gluten', 'dairy'],
    icon: '🍗',
  },
];

// ==================== MIRA TRIP PLANNING ====================

/**
 * Get trip suggestions based on conversation
 */
export function getMiraTripSuggestions(): MiraTripSuggestion[] {
  return Object.values(TRIP_TEMPLATES).map(template => ({
    tripType: template.type,
    icon: template.icon,
    title: template.name,
    description: template.description,
    suggestedDuration: template.suggestedDuration.min,
    keyItems: template.checklists[0]?.items.slice(0, 5).map(i => i.name) || [],
    mealIdeas: template.mealSuggestions[0]?.meals.slice(0, 3) || [],
    estimatedBudget: `$${template.estimatedDailyBudget.min * template.suggestedDuration.min}-${template.estimatedDailyBudget.max * template.suggestedDuration.max}`,
  }));
}

/**
 * Create a new trip plan from template
 */
export function createTripPlan(
  type: TripType,
  name: string,
  startDate: string,
  endDate: string,
  travelers: number
): TripPlan {
  const template = TRIP_TEMPLATES[type];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Generate unique IDs for checklist items
  const checklists: TripChecklistCategory[] = template.checklists.map((cat, catIndex) => ({
    id: `cat_${catIndex}_${Date.now()}`,
    name: cat.name,
    icon: cat.icon,
    items: cat.items.map((item, itemIndex) => ({
      ...item,
      id: `item_${catIndex}_${itemIndex}_${Date.now()}`,
    })),
  }));

  // Generate meal plan
  const meals: TripMeal[] = [];
  for (let day = 1; day <= duration; day++) {
    const dayMeals: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];
    dayMeals.forEach((mealType, index) => {
      const complexityIndex = Math.floor(Math.random() * template.mealSuggestions.length);
      const mealOptions = template.mealSuggestions[complexityIndex];
      const randomMeal = mealOptions.meals[Math.floor(Math.random() * mealOptions.meals.length)];

      meals.push({
        id: `meal_${day}_${index}_${Date.now()}`,
        day,
        mealType,
        name: randomMeal,
        complexity: mealOptions.complexity,
        ingredients: [], // Would be populated from recipes
        icon: mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥪' : '🍽️',
      });
    });
  }

  // Generate shopping list from checklist items that need purchasing
  const shoppingList: string[] = [];
  checklists.forEach(cat => {
    if (cat.name.includes('Food') || cat.name.includes('Snack')) {
      cat.items.forEach(item => {
        if (!shoppingList.includes(item.name)) {
          shoppingList.push(item.name);
        }
      });
    }
  });

  // Add common food items based on trip type
  const foodItems = template.mealSuggestions.flatMap(ms => ms.meals);
  foodItems.slice(0, 5).forEach(item => {
    if (!shoppingList.includes(item)) {
      shoppingList.push(item);
    }
  });

  return {
    id: `trip_${Date.now()}`,
    name,
    type,
    startDate,
    endDate,
    duration,
    travelers,
    meals,
    checklists,
    shoppingList,
    estimatedBudget: (() => {
      const costs = TRIP_COST_ESTIMATES[type];
      const hotelPerNight = costs.hotelPerNight;
      const hotelNights = duration > 1 ? duration - 1 : 0;
      const accommodation = hotelPerNight * hotelNights;
      const flights = costs.flightPerPerson * travelers;
      const food = 50 * travelers * duration;
      const activities = 30 * travelers * duration;
      const gas = type === 'road_trip' ? calculateGasCost(500, 25) : 0;
      const total = accommodation + flights + food + activities + gas;
      return { food, gas, accommodation, flights, hotelPerNight, activities, total };
    })(),
    miraNote: template.tips[0],
    status: 'planning',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get recipes suitable for a trip type
 */
export function getRecipesForTrip(
  tripType: TripType,
  complexity?: MealComplexity
): TripRecipe[] {
  return TRIP_RECIPES.filter(recipe => {
    const typeMatch = tripType === 'custom' || recipe.suitableFor.includes(tripType);
    const complexityMatch = !complexity || recipe.complexity === complexity;
    return typeMatch && complexityMatch;
  });
}

/**
 * Calculate estimated gas cost for road trip
 */
export function calculateGasCost(
  miles: number,
  vehicleMpg: number,
  gasPrice: number = 3.50
): number {
  const gallonsNeeded = miles / vehicleMpg;
  return Math.round(gallonsNeeded * gasPrice * 100) / 100;
}

/**
 * Generate packing list based on trip details
 */
export function generatePackingList(
  tripType: TripType,
  duration: number,
  travelers: number
): TripChecklistCategory[] {
  const template = TRIP_TEMPLATES[tripType];

  return template.checklists.map((cat, catIndex) => ({
    id: `cat_${catIndex}_${Date.now()}`,
    name: cat.name,
    icon: cat.icon,
    items: cat.items.map((item, itemIndex) => ({
      ...item,
      id: `item_${catIndex}_${itemIndex}_${Date.now()}`,
      quantity: item.name.includes('per person') ? travelers : 1,
    })),
  }));
}

/**
 * Get Mira's response for trip planning questions
 */
export function getMiraTripResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Camping queries
  if (lowerQuery.includes('camping') || lowerQuery.includes('camp')) {
    return "🏕️ I'd love to help plan your camping trip! I'll help you with:\n\n" +
      "• Complete packing checklist (tent, sleeping gear, cooking supplies)\n" +
      "• Meal planning from easy hot dogs to gourmet campfire steaks\n" +
      "• Shopping list for all your needs\n" +
      "• Safety essentials\n\n" +
      "How many days are you planning to camp, and how many people?";
  }

  // Road trip queries
  if (lowerQuery.includes('road trip') || lowerQuery.includes('drive')) {
    return "🚗 Road trip time! I'll help you plan:\n\n" +
      "• Car snacks and drinks for the journey\n" +
      "• Estimated gas cost based on your route\n" +
      "• Comfort items for long drives\n" +
      "• Entertainment for the kids\n" +
      "• Meal stops and picnic ideas\n\n" +
      "Where are you headed, and how long is the drive?";
  }

  // Beach queries
  if (lowerQuery.includes('beach') || lowerQuery.includes('ocean') || lowerQuery.includes('hawaii')) {
    return "🏖️ Beach vacation! I'll help with:\n\n" +
      "• Sun protection essentials\n" +
      "• Beach gear and toys\n" +
      "• Snacks that travel well\n" +
      "• Fresh seafood meal ideas\n" +
      "• Light, refreshing recipes\n\n" +
      "How many days at the beach?";
  }

  // General trip query
  return "✨ I can help plan any trip! Just tell me:\n\n" +
    "• 🏕️ Camping\n" +
    "• 🚗 Road Trip\n" +
    "• 🏖️ Beach Vacation\n" +
    "• 🏔️ Mountain Getaway\n" +
    "• 🏙️ City Break\n" +
    "• 👨‍👩‍👧‍👦 Family Reunion\n" +
    "• 🧺 Picnic\n" +
    "• 🏈 Tailgate Party\n\n" +
    "What adventure are you planning?";
}

/**
 * Generate allergy-safe alternatives for trip meals
 */
export function getTripAllergyAlternatives(
  recipe: TripRecipe,
  familyAllergies: AllergenType[]
): { original: string; alternative: string }[] {
  const alternatives: { original: string; alternative: string }[] = [];

  // Check if recipe has allergens that family members have
  if (recipe.allergenInfo) {
    for (const allergen of recipe.allergenInfo) {
      if (familyAllergies.includes(allergen)) {
        // Suggest alternative recipe or modifications
        alternatives.push({
          original: recipe.name,
          alternative: `${allergen}-free version available`,
        });
      }
    }
  }

  return alternatives;
}
