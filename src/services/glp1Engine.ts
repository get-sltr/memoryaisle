// GLP-1 Cycle Engine — Pure logic, zero dependencies
// Calculates injection cycle phase and generates Mira AI context

export type GLP1Medication =
  | 'ozempic'
  | 'mounjaro'
  | 'wegovy'
  | 'saxenda'
  | 'zepbound'
  | 'rybelsus';

export type CyclePhase = 'suppression' | 'transition' | 'moderate' | 'returning';

export type Duration =
  | 'less_than_1_month'
  | '1_3_months'
  | '3_6_months'
  | '6_12_months'
  | '1_year_plus';

export interface CyclePhaseInfo {
  phase: CyclePhase;
  dayInCycle: number;
  totalCycleDays: number;
  portionScale: number;
  mealFrequency: string;
  mealsPerDay: number;
  guidance: string;
  emoji: string;
  color: string;
  label: string;
  risks: string[];
}

export interface GLP1Profile {
  medication: GLP1Medication;
  dose?: string | null;
  injection_day?: number | null; // 0=Sunday..6=Saturday
  duration: Duration;
  food_triggers?: string[];
  is_active?: boolean;
}

export interface InjectionRecord {
  injection_date: string; // ISO timestamp
  dose?: string | null;
}

// Medication metadata
export const MEDICATIONS: Record<GLP1Medication, {
  name: string;
  brand: string;
  type: 'weekly' | 'daily';
  doses: string[];
  starterDoses: string[];
}> = {
  ozempic: {
    name: 'Semaglutide',
    brand: 'Ozempic',
    type: 'weekly',
    doses: ['0.25mg', '0.5mg', '1mg', '2mg'],
    starterDoses: ['0.25mg', '0.5mg'],
  },
  mounjaro: {
    name: 'Tirzepatide',
    brand: 'Mounjaro',
    type: 'weekly',
    doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    starterDoses: ['2.5mg', '5mg'],
  },
  wegovy: {
    name: 'Semaglutide',
    brand: 'Wegovy',
    type: 'weekly',
    doses: ['0.25mg', '0.5mg', '1mg', '1.7mg', '2.4mg'],
    starterDoses: ['0.25mg', '0.5mg'],
  },
  saxenda: {
    name: 'Liraglutide',
    brand: 'Saxenda',
    type: 'daily',
    doses: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3mg'],
    starterDoses: ['0.6mg', '1.2mg'],
  },
  zepbound: {
    name: 'Tirzepatide',
    brand: 'Zepbound',
    type: 'weekly',
    doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    starterDoses: ['2.5mg', '5mg'],
  },
  rybelsus: {
    name: 'Semaglutide (oral)',
    brand: 'Rybelsus',
    type: 'daily',
    doses: ['3mg', '7mg', '14mg'],
    starterDoses: ['3mg'],
  },
};

// Phase configuration
const PHASE_CONFIG: Record<CyclePhase, {
  label: string;
  emoji: string;
  color: string;
  basePortionMin: number;
  basePortionMax: number;
  mealsPerDay: number;
  mealFrequency: string;
  guidance: string;
  risks: string[];
}> = {
  suppression: {
    label: 'Peak Suppression',
    emoji: '\u{1F4AA}',
    color: '#4ECDC4',
    basePortionMin: 0.3,
    basePortionMax: 0.5,
    mealsPerDay: 6,
    mealFrequency: '5-6 tiny meals',
    guidance: 'Focus on protein-dense small portions. Sip fluids. Listen to your body.',
    risks: ['dehydration', 'protein deficiency', 'nausea from overeating'],
  },
  transition: {
    label: 'Transition',
    emoji: '\u{1F331}',
    color: '#45B7D1',
    basePortionMin: 0.5,
    basePortionMax: 0.7,
    mealsPerDay: 5,
    mealFrequency: '4-5 smaller meals',
    guidance: 'Appetite returning slowly. Keep portions moderate, protein first.',
    risks: ['eating too fast', 'skipping protein'],
  },
  moderate: {
    label: 'Best Eating Window',
    emoji: '\u{2600}\u{FE0F}',
    color: '#F7B731',
    basePortionMin: 0.7,
    basePortionMax: 0.9,
    mealsPerDay: 4,
    mealFrequency: '3-4 meals',
    guidance: 'Your best window for balanced nutrition. Great time to meal prep.',
    risks: ['not using window effectively'],
  },
  returning: {
    label: 'Appetite Returning',
    emoji: '\u{26A0}\u{FE0F}',
    color: '#FF6B6B',
    basePortionMin: 0.9,
    basePortionMax: 1.0,
    mealsPerDay: 3,
    mealFrequency: '3 meals + snacks',
    guidance: 'Appetite is higher. Plan meals ahead to avoid overeating.',
    risks: ['overeating', 'cravings', 'making impulsive food choices'],
  },
};

// Duration intensity modifier (newer users = more conservative)
function getDurationModifier(duration: Duration): number {
  switch (duration) {
    case 'less_than_1_month': return 0.8;  // more conservative
    case '1_3_months':        return 0.9;
    case '3_6_months':        return 1.0;
    case '6_12_months':       return 1.05;
    case '1_year_plus':       return 1.1;  // body has adapted
  }
}

// Starter dose = milder suppression effect
function isStarterDose(medication: GLP1Medication, dose?: string | null): boolean {
  if (!dose) return true; // unknown dose = treat as starter for safety
  return MEDICATIONS[medication].starterDoses.includes(dose);
}

/**
 * Calculate the current cycle phase based on last injection date.
 * For weekly injectables: 7-day cycle. For daily meds: simplified 1-day cycle.
 */
export function calculateCyclePhase(
  profile: GLP1Profile,
  lastInjection?: InjectionRecord | null,
  now?: Date,
): CyclePhaseInfo {
  const currentDate = now || new Date();
  const medInfo = MEDICATIONS[profile.medication];

  // Daily medications have a simplified constant phase
  if (medInfo.type === 'daily') {
    return {
      phase: 'moderate',
      dayInCycle: 0,
      totalCycleDays: 1,
      portionScale: 0.6,
      mealFrequency: '4-5 smaller meals throughout the day',
      mealsPerDay: 5,
      guidance: 'Daily medication keeps appetite steady. Focus on protein-rich small meals.',
      emoji: PHASE_CONFIG.moderate.emoji,
      color: PHASE_CONFIG.moderate.color,
      label: 'Steady State',
      risks: ['skipping protein', 'not eating enough'],
    };
  }

  // Weekly injectables — calculate days since last injection
  if (!lastInjection) {
    // No injection logged yet — estimate from injection_day preference
    if (profile.injection_day != null) {
      const today = currentDate.getDay(); // 0=Sunday
      let daysSince = today - profile.injection_day;
      if (daysSince < 0) daysSince += 7;
      return buildPhaseInfo(daysSince, 7, profile);
    }
    // No injection day set — default to moderate
    return buildPhaseInfo(4, 7, profile);
  }

  const injectionDate = new Date(lastInjection.injection_date);
  const diffMs = currentDate.getTime() - injectionDate.getTime();
  const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Clamp to 0-6 range (if > 7 days, user missed injection)
  const effectiveDay = Math.min(daysSince, 6);

  return buildPhaseInfo(effectiveDay, 7, profile, lastInjection?.dose);
}

function buildPhaseInfo(
  dayInCycle: number,
  totalCycleDays: number,
  profile: GLP1Profile,
  injectionDose?: string | null,
): CyclePhaseInfo {
  // Determine phase from day
  let phase: CyclePhase;
  if (dayInCycle <= 1)       phase = 'suppression';
  else if (dayInCycle <= 3)  phase = 'transition';
  else if (dayInCycle <= 5)  phase = 'moderate';
  else                       phase = 'returning';

  const config = PHASE_CONFIG[phase];
  const durationMod = getDurationModifier(profile.duration);
  const starter = isStarterDose(profile.medication, injectionDose ?? profile.dose);

  // Starter doses have milder suppression — shift portion scale up
  const starterOffset = starter ? 0.15 : 0;

  // Calculate portion scale with modifiers
  const basePortion = (config.basePortionMin + config.basePortionMax) / 2;
  const portionScale = Math.min(1.0, (basePortion + starterOffset) * durationMod);

  return {
    phase,
    dayInCycle,
    totalCycleDays,
    portionScale: Math.round(portionScale * 100) / 100,
    mealFrequency: config.mealFrequency,
    mealsPerDay: config.mealsPerDay,
    guidance: config.guidance,
    emoji: config.emoji,
    color: config.color,
    label: config.label,
    risks: config.risks,
  };
}

/**
 * Generate a context string for Mira AI based on the user's GLP-1 cycle.
 * This gets appended to the system prompt so Mira gives cycle-aware advice.
 */
export function generateMiraGLP1Context(
  profile: GLP1Profile,
  cycleInfo: CyclePhaseInfo,
  foodTriggers?: string[],
): string {
  const medInfo = MEDICATIONS[profile.medication];
  const triggers = foodTriggers?.length ? foodTriggers : profile.food_triggers;

  let context = `\n\nGLP-1 MEDICATION CONTEXT (CRITICAL - adapt all food suggestions to this):`;
  context += `\nUser is on ${medInfo.brand} (${medInfo.name}), dose: ${profile.dose || 'not specified'}`;
  context += `\nDuration on medication: ${profile.duration.replace(/_/g, ' ')}`;
  context += `\nCurrent cycle phase: ${cycleInfo.label} (Day ${cycleInfo.dayInCycle} of ${cycleInfo.totalCycleDays})`;
  context += `\nPortion scale: ${Math.round(cycleInfo.portionScale * 100)}% of normal portions`;
  context += `\nRecommended: ${cycleInfo.mealFrequency}`;
  context += `\nGuidance: ${cycleInfo.guidance}`;

  if (cycleInfo.risks.length > 0) {
    context += `\nCurrent risks to watch: ${cycleInfo.risks.join(', ')}`;
  }

  if (triggers && triggers.length > 0) {
    context += `\nUser-reported food triggers (may cause nausea/discomfort): ${triggers.join(', ')}`;
  }

  context += `\n\nGLP-1 MEAL RULES:`;
  context += `\n- ALWAYS prioritize protein in every meal suggestion (aim for 60-100g/day minimum)`;
  context += `\n- Suggest smaller, more frequent meals during suppression phase`;
  context += `\n- NEVER use weight-related language (no "weight loss", "burning fat", "slim down", etc.)`;
  context += `\n- Frame everything around "nourishing your body" and "feeling your best"`;
  context += `\n- NEVER give medical advice about medication dosing, timing, or side effects`;
  context += `\n- If user mentions side effects, suggest they consult their healthcare provider`;
  context += `\n- Warn if suggested foods match user's reported triggers`;
  context += `\n- Hydration is critical — mention water intake when relevant`;
  context += `\n- During suppression phase: suggest protein shakes, bone broth, soft foods`;
  context += `\n- During returning phase: suggest pre-planned meals to avoid impulsive eating`;

  return context;
}

/**
 * Food trigger detection — checks if an item name matches any of the user's triggers.
 */
export function detectFoodTrigger(
  itemName: string,
  triggers: string[],
): string | null {
  if (!triggers || triggers.length === 0) return null;

  const lower = itemName.toLowerCase();

  // Trigger keyword mapping for common GLP-1 food triggers
  const TRIGGER_KEYWORDS: Record<string, string[]> = {
    'greasy food': ['fried', 'grease', 'greasy', 'deep-fried', 'french fries', 'chips', 'fryer'],
    'dairy': ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'ice cream', 'whey'],
    'spicy': ['hot sauce', 'jalape', 'chili', 'cayenne', 'sriracha', 'habanero', 'ghost pepper', 'spicy'],
    'carbonated drinks': ['soda', 'cola', 'sprite', 'sparkling', 'fizzy', 'carbonated', 'seltzer'],
    'high sugar': ['candy', 'chocolate', 'cake', 'cookie', 'pastry', 'donut', 'syrup', 'ice cream'],
    'red meat': ['beef', 'steak', 'burger', 'ground beef', 'lamb', 'veal', 'brisket'],
    'fried food': ['fried', 'deep-fried', 'crispy', 'tempura', 'fryer', 'french fries'],
    'caffeine': ['coffee', 'espresso', 'caffeine', 'energy drink', 'red bull'],
    'alcohol': ['beer', 'wine', 'vodka', 'whiskey', 'tequila', 'rum', 'cocktail', 'alcohol'],
    'raw vegetables': ['salad', 'raw', 'lettuce', 'kale', 'spinach raw'],
    'heavy sauces': ['alfredo', 'cream sauce', 'gravy', 'hollandaise', 'bechamel'],
    'citrus': ['orange', 'lemon', 'lime', 'grapefruit', 'citrus', 'tangerine'],
  };

  for (const trigger of triggers) {
    const triggerLower = trigger.toLowerCase();

    // Direct match
    if (lower.includes(triggerLower)) return trigger;

    // Keyword match
    const keywords = TRIGGER_KEYWORDS[triggerLower];
    if (keywords) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) return trigger;
      }
    }
  }

  return null;
}
