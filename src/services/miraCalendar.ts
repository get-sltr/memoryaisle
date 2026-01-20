// Mira Calendar Integration Service
// Proactively suggests shopping lists based on upcoming events and family traditions

import {
  getUpcomingHolidays,
  HolidayOccurrence,
  HolidayCategory,
} from '../utils/holidays';
import type {
  WeeklyTradition,
  SpecialDate,
  MiraCalendarSuggestion,
  FamilyProfile,
  AllergenType,
} from '../types';
import { detectAllergens } from '../utils/allergenDetection';

// Common allergen-safe alternatives
const ALLERGEN_ALTERNATIVES: Record<string, { forAllergen: AllergenType; alternative: string }[]> = {
  // Dairy alternatives
  'milk': [{ forAllergen: 'dairy', alternative: 'oat milk' }],
  'cheese': [{ forAllergen: 'dairy', alternative: 'vegan cheese' }],
  'butter': [{ forAllergen: 'dairy', alternative: 'dairy-free butter' }],
  'cream': [{ forAllergen: 'dairy', alternative: 'coconut cream' }],
  'yogurt': [{ forAllergen: 'dairy', alternative: 'coconut yogurt' }],
  'sour cream': [{ forAllergen: 'dairy', alternative: 'dairy-free sour cream' }],

  // Gluten alternatives
  'flour': [{ forAllergen: 'gluten', alternative: 'gluten-free flour' }, { forAllergen: 'wheat', alternative: 'rice flour' }],
  'bread': [{ forAllergen: 'gluten', alternative: 'gluten-free bread' }, { forAllergen: 'wheat', alternative: 'rice bread' }],
  'pasta': [{ forAllergen: 'gluten', alternative: 'gluten-free pasta' }, { forAllergen: 'wheat', alternative: 'rice noodles' }],
  'tortillas': [{ forAllergen: 'gluten', alternative: 'corn tortillas' }, { forAllergen: 'wheat', alternative: 'corn tortillas' }],
  'pizza dough': [{ forAllergen: 'gluten', alternative: 'gluten-free pizza crust' }],

  // Nut alternatives
  'peanut butter': [{ forAllergen: 'peanuts', alternative: 'sunflower seed butter' }],
  'almonds': [{ forAllergen: 'tree_nuts', alternative: 'sunflower seeds' }],
  'walnuts': [{ forAllergen: 'tree_nuts', alternative: 'pumpkin seeds' }],
  'cashews': [{ forAllergen: 'tree_nuts', alternative: 'sunflower seeds' }],

  // Egg alternatives
  'eggs': [{ forAllergen: 'eggs', alternative: 'egg substitute' }],

  // Soy alternatives
  'soy sauce': [{ forAllergen: 'soy', alternative: 'coconut aminos' }],
  'tofu': [{ forAllergen: 'soy', alternative: 'chickpea tofu' }],

  // Shellfish alternatives (just exclude, no good alternatives)
  'shrimp': [{ forAllergen: 'shellfish', alternative: 'firm white fish' }],
  'crab': [{ forAllergen: 'shellfish', alternative: 'imitation crab (fish-based)' }],

  // Sesame alternatives
  'sesame oil': [{ forAllergen: 'sesame', alternative: 'avocado oil' }],
  'tahini': [{ forAllergen: 'sesame', alternative: 'sunflower seed butter' }],
};

// Generate friendly Mira messages
const MIRA_MESSAGES = {
  holiday: (name: string, daysUntil: number) => {
    if (daysUntil === 0) return `It's ${name} today! Let me help you with last-minute shopping.`;
    if (daysUntil === 1) return `${name} is tomorrow! Here's what you might need.`;
    if (daysUntil <= 3) return `${name} is coming up in ${daysUntil} days! Time to start shopping.`;
    return `${name} is in ${daysUntil} days. Want to get ahead on shopping?`;
  },
  tradition: (name: string, dayName: string) => {
    return `${name} is this ${dayName}! Here's your usual shopping list.`;
  },
  birthday: (name: string, daysUntil: number) => {
    if (daysUntil === 0) return `Happy ${name}! Need anything special for the celebration?`;
    if (daysUntil === 1) return `${name} is tomorrow! Don't forget the cake ingredients!`;
    return `${name} is coming up in ${daysUntil} days. Time to plan the celebration!`;
  },
  allergyNote: (personName: string, items: string[]) => {
    return `I've found allergy-safe alternatives for ${personName}: ${items.join(', ')}`;
  },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface FamilyMemberAllergies {
  name: string;
  allergies: AllergenType[];
}

/**
 * Gets allergy-safe alternatives for items based on family allergies
 */
function getAllergySafeAlternatives(
  items: string[],
  familyAllergies: FamilyMemberAllergies[]
): { original: string; alternative: string; forPerson: string }[] {
  const alternatives: { original: string; alternative: string; forPerson: string }[] = [];

  for (const item of items) {
    const normalizedItem = item.toLowerCase();
    const itemAlternatives = ALLERGEN_ALTERNATIVES[normalizedItem];

    if (itemAlternatives) {
      for (const alt of itemAlternatives) {
        // Check if any family member has this allergy
        for (const member of familyAllergies) {
          if (member.allergies.includes(alt.forAllergen)) {
            // Check if alternative isn't already added
            const exists = alternatives.some(
              a => a.original === item && a.forPerson === member.name
            );
            if (!exists) {
              alternatives.push({
                original: item,
                alternative: alt.alternative,
                forPerson: member.name,
              });
            }
          }
        }
      }
    }

    // Also check using the allergen detection utility
    const detected = detectAllergens(item);
    if (detected.length > 0) {
      for (const allergen of detected) {
        for (const member of familyAllergies) {
          if (member.allergies.includes(allergen.allergen)) {
            const exists = alternatives.some(
              a => a.original === item && a.forPerson === member.name
            );
            if (!exists && itemAlternatives) {
              const alt = itemAlternatives.find(a => a.forAllergen === allergen.allergen);
              if (alt) {
                alternatives.push({
                  original: item,
                  alternative: alt.alternative,
                  forPerson: member.name,
                });
              }
            }
          }
        }
      }
    }
  }

  return alternatives;
}

/**
 * Get proactive calendar suggestions for the next few days
 */
export function getMiraCalendarSuggestions(
  familyProfile: FamilyProfile | undefined,
  familyAllergies: FamilyMemberAllergies[],
  daysAhead: number = 7
): MiraCalendarSuggestion[] {
  const suggestions: MiraCalendarSuggestion[] = [];
  const today = new Date();

  // 1. Check upcoming holidays based on family's cultural preferences
  const culturalCategories = (familyProfile?.culturalPreferences || ['secular']) as HolidayCategory[];
  if (familyProfile?.observeSecularHolidays !== false) {
    culturalCategories.push('american');
  }

  const holidays = getUpcomingHolidays(daysAhead, culturalCategories);

  for (const holiday of holidays) {
    if (holiday.daysUntil <= daysAhead && holiday.suggestedItems && holiday.suggestedItems.length > 0) {
      const alternatives = getAllergySafeAlternatives(holiday.suggestedItems, familyAllergies);

      suggestions.push({
        eventName: holiday.name,
        eventDate: holiday.date,
        eventIcon: holiday.icon,
        message: MIRA_MESSAGES.holiday(holiday.name, holiday.daysUntil),
        suggestedList: {
          name: `${holiday.name} Shopping`,
          items: holiday.suggestedItems,
          allergenSafeAlternatives: alternatives.length > 0 ? alternatives : undefined,
        },
        actionPrompt: alternatives.length > 0
          ? `Want me to create an allergy-safe shopping list for ${holiday.name}?`
          : `Want me to create a shopping list for ${holiday.name}?`,
      });
    }
  }

  // 2. Check weekly traditions
  if (familyProfile?.weeklyTraditions) {
    const activeTraditions = familyProfile.weeklyTraditions.filter(t => t.isActive);

    for (const tradition of activeTraditions) {
      // Calculate days until this tradition
      const todayDayOfWeek = today.getDay();
      let daysUntil = tradition.dayOfWeek - todayDayOfWeek;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0) daysUntil = 0; // Today!

      if (daysUntil <= 2 && tradition.usualItems && tradition.usualItems.length > 0) {
        const alternatives = getAllergySafeAlternatives(tradition.usualItems, familyAllergies);
        const traditionDate = new Date(today);
        traditionDate.setDate(today.getDate() + daysUntil);

        suggestions.push({
          eventName: tradition.name,
          eventDate: traditionDate,
          eventIcon: tradition.icon || '🍽️',
          message: MIRA_MESSAGES.tradition(tradition.name, DAY_NAMES[tradition.dayOfWeek]),
          suggestedList: {
            name: `${tradition.name} List`,
            items: tradition.usualItems,
            allergenSafeAlternatives: alternatives.length > 0 ? alternatives : undefined,
          },
          actionPrompt: alternatives.length > 0
            ? `Ready for your allergy-safe ${tradition.name} list?`
            : `Ready to shop for ${tradition.name}?`,
        });
      }
    }
  }

  // 3. Check special dates (birthdays, anniversaries)
  if (familyProfile?.specialDates) {
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (const specialDate of familyProfile.specialDates) {
      // Parse MM-DD format
      const [month, day] = specialDate.date.split('-').map(Number);
      const eventDate = new Date(today.getFullYear(), month - 1, day);

      // If the date has passed this year, check next year
      if (eventDate < today) {
        eventDate.setFullYear(today.getFullYear() + 1);
      }

      const timeDiff = eventDate.getTime() - today.getTime();
      const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      if (daysUntil <= daysAhead && daysUntil >= 0) {
        const items = specialDate.usualItems || ['cake', 'candles', 'balloons', 'party supplies'];
        const alternatives = getAllergySafeAlternatives(items, familyAllergies);

        const icon = specialDate.type === 'birthday' ? '🎂'
          : specialDate.type === 'anniversary' ? '💕'
          : '🎉';

        suggestions.push({
          eventName: specialDate.name,
          eventDate: eventDate,
          eventIcon: icon,
          message: MIRA_MESSAGES.birthday(specialDate.name, daysUntil),
          suggestedList: {
            name: `${specialDate.name} Celebration`,
            items: items,
            allergenSafeAlternatives: alternatives.length > 0 ? alternatives : undefined,
          },
          actionPrompt: specialDate.type === 'birthday'
            ? `Want me to help plan the birthday celebration?`
            : `Want me to create a celebration list?`,
        });
      }
    }
  }

  // Sort by date (soonest first)
  suggestions.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  return suggestions;
}

/**
 * Get the most urgent/important suggestion
 */
export function getTopCalendarSuggestion(
  familyProfile: FamilyProfile | undefined,
  familyAllergies: FamilyMemberAllergies[]
): MiraCalendarSuggestion | null {
  const suggestions = getMiraCalendarSuggestions(familyProfile, familyAllergies, 3);
  return suggestions.length > 0 ? suggestions[0] : null;
}

/**
 * Generate a shopping list from a calendar suggestion
 */
export function generateShoppingListFromSuggestion(
  suggestion: MiraCalendarSuggestion,
  includeAlternatives: boolean = true
): { name: string; items: string[] } {
  if (!suggestion.suggestedList) {
    return { name: suggestion.eventName, items: [] };
  }

  const items = [...suggestion.suggestedList.items];

  if (includeAlternatives && suggestion.suggestedList.allergenSafeAlternatives) {
    // Replace original items with alternatives where needed
    for (const alt of suggestion.suggestedList.allergenSafeAlternatives) {
      const index = items.findIndex(
        item => item.toLowerCase() === alt.original.toLowerCase()
      );
      if (index !== -1) {
        // Add alternative with note
        items[index] = `${alt.alternative} (for ${alt.forPerson})`;
      }
    }
  }

  return {
    name: suggestion.suggestedList.name,
    items: items,
  };
}

/**
 * Get a friendly Mira greeting based on what's coming up
 */
export function getMiraCalendarGreeting(
  familyProfile: FamilyProfile | undefined,
  familyAllergies: FamilyMemberAllergies[]
): string {
  const topSuggestion = getTopCalendarSuggestion(familyProfile, familyAllergies);

  if (topSuggestion) {
    const daysUntil = Math.ceil(
      (topSuggestion.eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil === 0) {
      return `Happy ${topSuggestion.eventName}! ${topSuggestion.eventIcon} Need help with shopping?`;
    } else if (daysUntil === 1) {
      return `${topSuggestion.eventIcon} ${topSuggestion.eventName} is tomorrow! Ready to prep?`;
    } else {
      return `${topSuggestion.eventIcon} ${topSuggestion.eventName} coming up in ${daysUntil} days!`;
    }
  }

  // Default greeting based on day of week
  const day = new Date().getDay();
  const greetings = [
    "Happy Sunday! Planning the week's meals?",
    "Monday shopping day? I'm here to help!",
    "Taco Tuesday coming up? 🌮",
    "Midweek check-in - need anything?",
    "Almost Friday! Planning the weekend?",
    "Happy Friday! Pizza night? 🍕",
    "Weekend vibes! What's cooking?",
  ];

  return greetings[day];
}
