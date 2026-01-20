// Smart allergen detection for family safety

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

export interface AllergenInfo {
  id: AllergenType;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  description: string;
}

export const ALLERGENS: Record<AllergenType, AllergenInfo> = {
  dairy: {
    id: 'dairy',
    label: 'Dairy',
    shortLabel: 'Dairy',
    icon: 'milk',
    color: '#42A5F5',
    description: 'Milk, cheese, butter, cream, yogurt',
  },
  eggs: {
    id: 'eggs',
    label: 'Eggs',
    shortLabel: 'Eggs',
    icon: 'egg',
    color: '#FFB74D',
    description: 'Eggs and egg products',
  },
  tree_nuts: {
    id: 'tree_nuts',
    label: 'Tree Nuts',
    shortLabel: 'Nuts',
    icon: 'nut',
    color: '#8D6E63',
    description: 'Almonds, walnuts, cashews, pecans, etc.',
  },
  peanuts: {
    id: 'peanuts',
    label: 'Peanuts',
    shortLabel: 'Peanut',
    icon: 'peanut',
    color: '#D4A574',
    description: 'Peanuts and peanut products',
  },
  shellfish: {
    id: 'shellfish',
    label: 'Shellfish',
    shortLabel: 'Shell',
    icon: 'shrimp',
    color: '#EF5350',
    description: 'Shrimp, crab, lobster, etc.',
  },
  fish: {
    id: 'fish',
    label: 'Fish',
    shortLabel: 'Fish',
    icon: 'fish',
    color: '#26C6DA',
    description: 'Fish and fish products',
  },
  wheat: {
    id: 'wheat',
    label: 'Wheat',
    shortLabel: 'Wheat',
    icon: 'wheat',
    color: '#FFA726',
    description: 'Wheat and wheat products',
  },
  gluten: {
    id: 'gluten',
    label: 'Gluten',
    shortLabel: 'Gluten',
    icon: 'bread',
    color: '#D4A574',
    description: 'Wheat, barley, rye, oats',
  },
  soy: {
    id: 'soy',
    label: 'Soy',
    shortLabel: 'Soy',
    icon: 'bean',
    color: '#81C784',
    description: 'Soy and soy products',
  },
  sesame: {
    id: 'sesame',
    label: 'Sesame',
    shortLabel: 'Sesame',
    icon: 'seed',
    color: '#A1887F',
    description: 'Sesame seeds and sesame oil',
  },
};

// Keywords that indicate presence of allergens
const ALLERGEN_KEYWORDS: Record<AllergenType, string[]> = {
  dairy: [
    'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ice cream',
    'gelato', 'whey', 'casein', 'lactose', 'ghee', 'paneer', 'ricotta',
    'mozzarella', 'cheddar', 'parmesan', 'brie', 'gouda', 'feta', 'cottage',
    'cream cheese', 'sour cream', 'half and half', 'custard', 'pudding',
    'milkshake', 'latte', 'cappuccino', 'creamer', 'whipped cream',
    'condensed milk', 'evaporated milk', 'buttermilk', 'kefir',
    'queso', 'fondue', 'alfredo', 'béchamel', 'bechamel',
    // Common foods that typically contain dairy
    'pizza', 'lasagna', 'mac and cheese', 'macaroni', 'cheesecake',
    'tiramisu', 'panna cotta', 'flan', 'bread pudding', 'french toast',
    'grilled cheese', 'quesadilla', 'nachos', 'au gratin', 'scalloped',
  ],
  eggs: [
    'egg', 'eggs', 'egg white', 'egg yolk', 'mayonnaise', 'mayo',
    'meringue', 'custard', 'quiche', 'frittata', 'omelette', 'omelet',
    'scrambled', 'hollandaise', 'béarnaise', 'bearnaise', 'aioli',
    'eggnog', 'advocaat', 'albumin', 'globulin', 'lysozyme',
    // Common foods that typically contain eggs
    'cake', 'cookie', 'cookies', 'brownie', 'brownies', 'muffin',
    'pancake', 'waffle', 'french toast', 'bread pudding', 'pasta',
    'noodle', 'brioche', 'challah', 'soufflé', 'souffle',
  ],
  tree_nuts: [
    'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews',
    'pecan', 'pecans', 'pistachio', 'pistachios', 'macadamia',
    'hazelnut', 'hazelnuts', 'brazil nut', 'brazil nuts', 'chestnut',
    'chestnuts', 'pine nut', 'pine nuts', 'praline', 'marzipan',
    'almond milk', 'almond butter', 'cashew milk', 'cashew butter',
    'nutella', 'gianduja', 'nougat', 'tree nut', 'tree nuts',
    // Common foods that often contain tree nuts
    'baklava', 'biscotti', 'granola', 'trail mix', 'pesto',
  ],
  peanuts: [
    'peanut', 'peanuts', 'peanut butter', 'groundnut', 'groundnuts',
    'arachis', 'monkey nuts', 'earth nuts', 'goober',
    // Common foods that contain peanuts
    'pad thai', 'satay', 'kung pao', 'gado gado',
  ],
  shellfish: [
    'shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crawfish',
    'crayfish', 'langoustine', 'scallop', 'scallops', 'clam', 'clams',
    'mussel', 'mussels', 'oyster', 'oysters', 'squid', 'calamari',
    'octopus', 'snail', 'escargot', 'abalone', 'shellfish',
    // Common dishes
    'paella', 'cioppino', 'bouillabaisse', 'jambalaya', 'gumbo',
    'ceviche', 'sushi', 'tempura',
  ],
  fish: [
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout',
    'bass', 'catfish', 'sardine', 'sardines', 'anchovy', 'anchovies',
    'mackerel', 'herring', 'snapper', 'grouper', 'mahi', 'swordfish',
    'flounder', 'sole', 'perch', 'pike', 'carp', 'eel', 'caviar',
    'roe', 'fish sauce', 'worcestershire', 'caesar dressing',
    'lox', 'smoked salmon', 'fish stick', 'fish sticks', 'fish fillet',
    'sashimi', 'poke', 'ceviche',
  ],
  wheat: [
    'wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles',
    'couscous', 'bulgur', 'semolina', 'durum', 'farina', 'spelt',
    'kamut', 'einkorn', 'emmer', 'triticale', 'seitan',
    // Common wheat-containing foods
    'cracker', 'crackers', 'cereal', 'cookie', 'cookies', 'cake',
    'muffin', 'bagel', 'croissant', 'tortilla', 'pita', 'naan',
    'pancake', 'waffle', 'breading', 'battered', 'panko',
    'soy sauce', 'teriyaki',
  ],
  gluten: [
    'wheat', 'barley', 'rye', 'oat', 'oats', 'malt', 'brewer',
    'flour', 'bread', 'pasta', 'noodle', 'noodles', 'beer', 'ale',
    'lager', 'stout', 'couscous', 'bulgur', 'semolina', 'seitan',
    // Common gluten-containing foods
    'cracker', 'crackers', 'cereal', 'cookie', 'cookies', 'cake',
    'muffin', 'bagel', 'croissant', 'tortilla', 'pita', 'naan',
    'pancake', 'waffle', 'breading', 'battered', 'panko',
    'soy sauce', 'teriyaki', 'gravy',
  ],
  soy: [
    'soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu',
    'tempeh', 'miso', 'natto', 'soy sauce', 'soy milk', 'soy protein',
    'textured vegetable protein', 'tvp', 'lecithin',
    // Common soy-containing items
    'teriyaki', 'tamari',
  ],
  sesame: [
    'sesame', 'sesame seed', 'sesame seeds', 'sesame oil', 'tahini',
    'halvah', 'halva', 'hummus', 'baba ganoush', 'falafel',
    // Common sesame-containing items
    'bagel', 'hamburger bun', 'sushi', 'asian', 'middle eastern',
  ],
};

// Items that MAY contain allergens (for "may contain" warnings)
const MAY_CONTAIN_ALLERGENS: Record<AllergenType, string[]> = {
  dairy: ['chocolate', 'caramel', 'toffee', 'fudge', 'nougat'],
  eggs: ['pasta', 'bread', 'baked goods', 'marshmallow'],
  tree_nuts: ['chocolate', 'granola', 'energy bar', 'protein bar', 'cereal'],
  peanuts: ['chocolate', 'candy', 'asian food', 'thai food', 'african food'],
  shellfish: ['asian food', 'chinese food', 'thai food', 'fish sauce'],
  fish: ['asian food', 'caesar', 'worcestershire'],
  wheat: ['oat', 'oats', 'rice crispy', 'corn flakes'],
  gluten: ['oat', 'oats', 'corn', 'rice'],
  soy: ['bread', 'baked goods', 'chocolate', 'vegetable oil'],
  sesame: ['bread', 'baked goods', 'asian food', 'crackers'],
};

export interface AllergenMatch {
  allergen: AllergenType;
  confidence: 'definite' | 'likely' | 'possible';
  matchedKeyword: string;
}

export interface FamilyMemberAllergy {
  memberId: string;
  memberName: string;
  allergies: AllergenType[];
}

export interface AllergenAlert {
  itemName: string;
  affectedMembers: {
    memberId: string;
    memberName: string;
    allergens: AllergenMatch[];
  }[];
}

/**
 * Detects allergens in an item name
 */
export function detectAllergens(itemName: string): AllergenMatch[] {
  const normalizedName = itemName.toLowerCase().trim();
  const matches: AllergenMatch[] = [];
  const seenAllergens = new Set<AllergenType>();

  // Check definite matches
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (seenAllergens.has(allergen as AllergenType)) continue;

    for (const keyword of keywords) {
      if (
        normalizedName === keyword ||
        normalizedName.includes(keyword) ||
        keyword.split(' ').every(word => normalizedName.includes(word))
      ) {
        matches.push({
          allergen: allergen as AllergenType,
          confidence: 'definite',
          matchedKeyword: keyword,
        });
        seenAllergens.add(allergen as AllergenType);
        break;
      }
    }
  }

  // Check "may contain" matches
  for (const [allergen, keywords] of Object.entries(MAY_CONTAIN_ALLERGENS)) {
    if (seenAllergens.has(allergen as AllergenType)) continue;

    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        matches.push({
          allergen: allergen as AllergenType,
          confidence: 'possible',
          matchedKeyword: keyword,
        });
        seenAllergens.add(allergen as AllergenType);
        break;
      }
    }
  }

  return matches;
}

/**
 * Checks if the person adding an item has an allergy to it
 * Returns allergen info for self-alert and highlight badge
 */
export function checkSelfAllergen(
  itemName: string,
  userAllergies: AllergenType[]
): AllergenMatch[] | null {
  if (!userAllergies || userAllergies.length === 0) return null;

  const detectedAllergens = detectAllergens(itemName);
  if (detectedAllergens.length === 0) return null;

  // Only return allergens that affect THIS user
  const relevantAllergens = detectedAllergens.filter(match =>
    userAllergies.includes(match.allergen)
  );

  return relevantAllergens.length > 0 ? relevantAllergens : null;
}

/**
 * Formats the self-alert message shown to user when they add an item
 * they're allergic to
 */
export function formatSelfAllergyAlert(
  itemName: string,
  allergens: AllergenMatch[]
): { title: string; message: string } {
  const allergenNames = allergens.map(a => ALLERGENS[a.allergen].label);

  if (allergenNames.length === 1) {
    return {
      title: 'Allergy Reminder',
      message: `You have a ${allergenNames[0]} allergy. Are you sure you want to add "${itemName}"?`,
    };
  }

  return {
    title: 'Allergy Reminder',
    message: `You have allergies to ${allergenNames.join(' and ')}. Are you sure you want to add "${itemName}"?`,
  };
}

/**
 * Item allergy record - stored with the item for permanent memory
 */
export interface ItemAllergyRecord {
  addedByName: string;
  addedByAllergies: AllergenType[]; // The allergies this person has
  matchedAllergens: AllergenType[]; // Which of their allergies this item contains
  confirmedAt: string; // When they confirmed adding despite allergy
}

/**
 * Gets allergen info for display
 */
export function getAllergenInfo(allergen: AllergenType): AllergenInfo {
  return ALLERGENS[allergen];
}

/**
 * Formats an allergy alert message
 */
export function formatAllergyAlertMessage(alert: AllergenAlert): string {
  if (alert.affectedMembers.length === 1) {
    const member = alert.affectedMembers[0];
    const allergenNames = member.allergens.map(a => ALLERGENS[a.allergen].label);
    if (allergenNames.length === 1) {
      return `Heads up: ${member.memberName} has a ${allergenNames[0]} allergy`;
    }
    return `Heads up: ${member.memberName} is allergic to ${allergenNames.join(', ')}`;
  }

  const memberNames = alert.affectedMembers.map(m => m.memberName);
  return `Heads up: ${memberNames.join(' and ')} have allergies to this item`;
}

/**
 * Gets all allergens that affect a specific family member from a list of items
 */
export function getItemsAffectingMember(
  items: { name: string }[],
  memberAllergies: AllergenType[]
): { itemName: string; allergens: AllergenMatch[] }[] {
  const affectingItems: { itemName: string; allergens: AllergenMatch[] }[] = [];

  for (const item of items) {
    const detectedAllergens = detectAllergens(item.name);
    const relevantAllergens = detectedAllergens.filter(match =>
      memberAllergies.includes(match.allergen)
    );

    if (relevantAllergens.length > 0) {
      affectingItems.push({
        itemName: item.name,
        allergens: relevantAllergens,
      });
    }
  }

  return affectingItems;
}
