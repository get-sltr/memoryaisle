/**
 * Smart Holiday & Celebration Calendar System
 * Supports global holidays, lunar calendars, and family traditions
 */
import { ImageSourcePropType } from 'react-native';

// Custom Holiday Icons
export const HOLIDAY_ICONS = {
  new_year: require('../../assets/icons/holidays/NewYear.png'),
  valentines: require('../../assets/icons/holidays/valentines_day.png'),
  mothers_day: require('../../assets/icons/holidays/mothers_day.png'),
  fathers_day: require('../../assets/icons/holidays/fathers_day.png'),
  halloween: require('../../assets/icons/holidays/holloween.png'),
  juneteenth: require('../../assets/icons/holidays/juneteenth.png'),
  memorial_day: require('../../assets/icons/holidays/memorial_day.png'),
  independence_day: require('../../assets/icons/holidays/july_4th.png'),
  labor_day: require('../../assets/icons/holidays/labor_day.png'),
  thanksgiving: require('../../assets/icons/holidays/thanksgiving.png'),
  easter: require('../../assets/icons/holidays/easter.png'),
  christmas: require('../../assets/icons/holidays/Christmas.png'),
  good_friday: require('../../assets/icons/holidays/goodfriday.png'),
  rosh_hashanah: require('../../assets/icons/holidays/rosh_hashanah.png'),
  hanukkah: require('../../assets/icons/holidays/hanukkah.png'),
  yom_kippur: require('../../assets/icons/holidays/yom_Kippur.png'),
  passover: require('../../assets/icons/holidays/passover.png'),
  kwanzaa: require('../../assets/icons/holidays/kwanzaa.png'),
  ramadan: require('../../assets/icons/holidays/ramadan.png'),
  eid_fitr: require('../../assets/icons/holidays/eid_al_fitr.png'),
  eid_adha: require('../../assets/icons/holidays/eid_al_adha.png'),
  diwali: require('../../assets/icons/holidays/diwali.png'),
  holi: require('../../assets/icons/holidays/holi.png'),
  vesak: require('../../assets/icons/holidays/vesak.png'),
  lunar_new_year: require('../../assets/icons/holidays/lunar_new_year.png'),
  cinco_de_mayo: require('../../assets/icons/holidays/Cinco de Mayo.png'),
  st_patricks: require('../../assets/icons/holidays/st_patricks_day.png'),
  mardi_gras: require('../../assets/icons/holidays/mardi_gras.png'),
};

// Holiday categories for filtering
export type HolidayCategory =
  | 'secular'      // New Year, Mother's Day, etc.
  | 'christian'    // Christmas, Easter
  | 'jewish'       // Hanukkah, Passover, etc.
  | 'muslim'       // Eid al-Fitr, Eid al-Adha, Ramadan
  | 'hindu'        // Diwali, Holi
  | 'chinese'      // Lunar New Year, Mid-Autumn
  | 'cultural'     // Cinco de Mayo, St. Patrick's
  | 'american';    // Thanksgiving, 4th of July

export interface Holiday {
  id: string;
  name: string;
  category: HolidayCategory;
  description: string;
  traditions?: string[];           // What people typically do
  suggestedMeals?: string[];       // Traditional foods
  suggestedItems?: string[];       // Shopping list suggestions
  icon: ImageSourcePropType;       // Custom icon image
  daysOfCelebration?: number;      // Multi-day holidays
}

export interface HolidayOccurrence extends Holiday {
  date: Date;
  endDate?: Date;                  // For multi-day holidays
  daysUntil: number;
  isToday: boolean;
  isThisWeek: boolean;
}

// ============================================
// HOLIDAY DATABASE
// ============================================

export const HOLIDAYS: Record<string, Holiday> = {
  // SECULAR / UNIVERSAL
  new_year: {
    id: 'new_year',
    name: "New Year's Day",
    category: 'secular',
    description: 'Start of the new year',
    traditions: ['Countdown', 'Fireworks', 'Resolutions'],
    suggestedMeals: ['Champagne toast', 'Party appetizers', 'Brunch'],
    suggestedItems: ['champagne', 'sparkling cider', 'party snacks', 'appetizers', 'cheese platter'],
    icon: HOLIDAY_ICONS.new_year,
  },
  valentines: {
    id: 'valentines',
    name: "Valentine's Day",
    category: 'secular',
    description: 'Day of love and appreciation',
    traditions: ['Cards', 'Gifts', 'Romantic dinner'],
    suggestedMeals: ['Romantic dinner', 'Chocolate desserts', 'Breakfast in bed'],
    suggestedItems: ['chocolate', 'strawberries', 'wine', 'steak', 'flowers', 'whipped cream'],
    icon: HOLIDAY_ICONS.valentines,
  },
  mothers_day: {
    id: 'mothers_day',
    name: "Mother's Day",
    category: 'secular',
    description: 'Celebrating mothers and mother figures',
    traditions: ['Brunch', 'Cards', 'Flowers'],
    suggestedMeals: ['Brunch', 'Her favorite meal', 'Breakfast in bed'],
    suggestedItems: ['flowers', 'brunch ingredients', 'eggs', 'bacon', 'orange juice', 'cake'],
    icon: HOLIDAY_ICONS.mothers_day,
  },
  fathers_day: {
    id: 'fathers_day',
    name: "Father's Day",
    category: 'secular',
    description: 'Celebrating fathers and father figures',
    traditions: ['BBQ', 'Cards', 'Quality time'],
    suggestedMeals: ['BBQ', 'His favorite meal', 'Grilled steaks'],
    suggestedItems: ['steaks', 'burgers', 'hot dogs', 'bbq sauce', 'beer', 'chips'],
    icon: HOLIDAY_ICONS.fathers_day,
  },
  halloween: {
    id: 'halloween',
    name: 'Halloween',
    category: 'secular',
    description: 'Spooky celebration with costumes and candy',
    traditions: ['Trick-or-treating', 'Costumes', 'Pumpkin carving'],
    suggestedMeals: ['Halloween party food', 'Candy', 'Themed treats'],
    suggestedItems: ['candy', 'pumpkin', 'apple cider', 'caramel apples', 'party snacks'],
    icon: HOLIDAY_ICONS.halloween,
  },

  // AMERICAN
  mlk_day: {
    id: 'mlk_day',
    name: 'Martin Luther King Jr. Day',
    category: 'american',
    description: 'Honoring Dr. Martin Luther King Jr.',
    traditions: ['Day of service', 'Reflection'],
    icon: HOLIDAY_ICONS.juneteenth,
  },
  presidents_day: {
    id: 'presidents_day',
    name: "Presidents' Day",
    category: 'american',
    description: 'Honoring US presidents',
    icon: HOLIDAY_ICONS.memorial_day,
  },
  memorial_day: {
    id: 'memorial_day',
    name: 'Memorial Day',
    category: 'american',
    description: 'Honoring fallen military service members',
    traditions: ['BBQ', 'Parades', 'Remembrance'],
    suggestedMeals: ['BBQ cookout', 'Picnic foods'],
    suggestedItems: ['burgers', 'hot dogs', 'buns', 'chips', 'watermelon', 'lemonade', 'coleslaw'],
    icon: HOLIDAY_ICONS.memorial_day,
  },
  independence_day: {
    id: 'independence_day',
    name: 'Independence Day (4th of July)',
    category: 'american',
    description: 'American Independence celebration',
    traditions: ['Fireworks', 'BBQ', 'Parades'],
    suggestedMeals: ['BBQ', 'Picnic', 'Red white and blue desserts'],
    suggestedItems: ['burgers', 'hot dogs', 'ribs', 'corn on cob', 'watermelon', 'potato salad', 'apple pie', 'ice cream'],
    icon: HOLIDAY_ICONS.independence_day,
  },
  labor_day: {
    id: 'labor_day',
    name: 'Labor Day',
    category: 'american',
    description: 'Celebrating workers',
    traditions: ['BBQ', 'End of summer'],
    suggestedMeals: ['BBQ cookout', 'Last summer picnic'],
    suggestedItems: ['burgers', 'hot dogs', 'steaks', 'corn', 'salads', 'beer'],
    icon: HOLIDAY_ICONS.labor_day,
  },
  thanksgiving: {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    category: 'american',
    description: 'Day of gratitude and family gathering',
    traditions: ['Family dinner', 'Gratitude', 'Football'],
    suggestedMeals: ['Turkey dinner', 'Pumpkin pie', 'Traditional sides'],
    suggestedItems: [
      'turkey', 'stuffing', 'cranberry sauce', 'mashed potatoes', 'gravy',
      'green beans', 'sweet potatoes', 'rolls', 'pumpkin pie', 'whipped cream',
      'apple cider', 'butter', 'celery', 'onions', 'chicken broth'
    ],
    icon: HOLIDAY_ICONS.thanksgiving,
  },

  // CHRISTIAN
  easter: {
    id: 'easter',
    name: 'Easter',
    category: 'christian',
    description: 'Celebration of resurrection',
    traditions: ['Church', 'Easter egg hunt', 'Family brunch'],
    suggestedMeals: ['Easter brunch', 'Ham dinner', 'Easter treats'],
    suggestedItems: ['ham', 'eggs', 'lamb', 'asparagus', 'hot cross buns', 'easter candy', 'deviled eggs'],
    icon: HOLIDAY_ICONS.easter,
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    category: 'christian',
    description: 'Celebration of the birth of Jesus Christ',
    traditions: ['Gift giving', 'Church', 'Family dinner', 'Decorating'],
    suggestedMeals: ['Christmas dinner', 'Holiday cookies', 'Eggnog'],
    suggestedItems: [
      'ham', 'turkey', 'prime rib', 'mashed potatoes', 'stuffing',
      'cranberries', 'eggnog', 'christmas cookies', 'gingerbread',
      'candy canes', 'hot cocoa', 'marshmallows', 'pie'
    ],
    icon: HOLIDAY_ICONS.christmas,
    daysOfCelebration: 2,
  },
  good_friday: {
    id: 'good_friday',
    name: 'Good Friday',
    category: 'christian',
    description: 'Commemoration of the crucifixion',
    traditions: ['Church', 'Fasting', 'Reflection'],
    suggestedMeals: ['Fish', 'Meatless meals'],
    suggestedItems: ['fish', 'seafood', 'vegetables', 'bread'],
    icon: HOLIDAY_ICONS.good_friday,
  },

  // JEWISH
  rosh_hashanah: {
    id: 'rosh_hashanah',
    name: 'Rosh Hashanah',
    category: 'jewish',
    description: 'Jewish New Year',
    traditions: ['Synagogue', 'Shofar', 'Family meals'],
    suggestedMeals: ['Apples and honey', 'Challah', 'Brisket'],
    suggestedItems: ['apples', 'honey', 'challah', 'brisket', 'pomegranate', 'wine', 'round challah'],
    icon: HOLIDAY_ICONS.rosh_hashanah,
    daysOfCelebration: 2,
  },
  yom_kippur: {
    id: 'yom_kippur',
    name: 'Yom Kippur',
    category: 'jewish',
    description: 'Day of Atonement - holiest day in Judaism',
    traditions: ['Fasting', 'Synagogue', 'Reflection'],
    suggestedMeals: ['Break-fast meal after sundown'],
    suggestedItems: ['bagels', 'cream cheese', 'lox', 'fruit', 'juice', 'coffee cake'],
    icon: HOLIDAY_ICONS.yom_kippur,
  },
  hanukkah: {
    id: 'hanukkah',
    name: 'Hanukkah',
    category: 'jewish',
    description: 'Festival of Lights',
    traditions: ['Lighting menorah', 'Dreidel', 'Gifts'],
    suggestedMeals: ['Latkes', 'Sufganiyot (jelly donuts)', 'Brisket'],
    suggestedItems: ['potatoes', 'oil', 'onions', 'applesauce', 'sour cream', 'jelly donuts', 'gelt', 'candles'],
    icon: HOLIDAY_ICONS.hanukkah,
    daysOfCelebration: 8,
  },
  passover: {
    id: 'passover',
    name: 'Passover',
    category: 'jewish',
    description: 'Celebration of exodus from Egypt',
    traditions: ['Seder', 'Matzah', 'Family gathering'],
    suggestedMeals: ['Seder plate', 'Matzah ball soup', 'Brisket'],
    suggestedItems: [
      'matzah', 'brisket', 'chicken', 'eggs', 'horseradish',
      'parsley', 'charoset ingredients', 'wine', 'grape juice', 'matzah meal'
    ],
    icon: HOLIDAY_ICONS.passover,
    daysOfCelebration: 8,
  },
  sukkot: {
    id: 'sukkot',
    name: 'Sukkot',
    category: 'jewish',
    description: 'Feast of Tabernacles',
    traditions: ['Building sukkah', 'Eating outdoors'],
    suggestedMeals: ['Harvest foods', 'Stuffed foods'],
    suggestedItems: ['stuffed cabbage', 'squash', 'apples', 'challah'],
    icon: HOLIDAY_ICONS.kwanzaa,
    daysOfCelebration: 7,
  },

  // MUSLIM
  ramadan_start: {
    id: 'ramadan_start',
    name: 'Ramadan Begins',
    category: 'muslim',
    description: 'Start of the holy month of fasting',
    traditions: ['Fasting', 'Prayer', 'Charity', 'Family'],
    suggestedMeals: ['Suhoor (pre-dawn)', 'Iftar (breaking fast)'],
    suggestedItems: ['dates', 'water', 'milk', 'bread', 'soup', 'rice', 'lamb', 'chicken', 'lentils', 'yogurt'],
    icon: HOLIDAY_ICONS.ramadan,
    daysOfCelebration: 30,
  },
  eid_al_fitr: {
    id: 'eid_al_fitr',
    name: 'Eid al-Fitr',
    category: 'muslim',
    description: 'Festival of Breaking the Fast - end of Ramadan',
    traditions: ['Prayer', 'Family visits', 'Gifts', 'Feasting'],
    suggestedMeals: ['Special breakfast', 'Festive meals', 'Sweets'],
    suggestedItems: [
      'lamb', 'rice', 'dates', 'baklava', 'cookies', 'sweets',
      'biryani ingredients', 'kebab', 'hummus', 'pita'
    ],
    icon: HOLIDAY_ICONS.eid_fitr,
    daysOfCelebration: 3,
  },
  eid_al_adha: {
    id: 'eid_al_adha',
    name: 'Eid al-Adha',
    category: 'muslim',
    description: 'Festival of Sacrifice',
    traditions: ['Prayer', 'Sacrifice', 'Charity', 'Family'],
    suggestedMeals: ['Lamb/goat dishes', 'Festive meals'],
    suggestedItems: ['lamb', 'goat', 'rice', 'spices', 'vegetables', 'bread', 'sweets'],
    icon: HOLIDAY_ICONS.eid_adha,
    daysOfCelebration: 4,
  },

  // HINDU
  diwali: {
    id: 'diwali',
    name: 'Diwali',
    category: 'hindu',
    description: 'Festival of Lights',
    traditions: ['Lighting diyas', 'Fireworks', 'Sweets', 'Family'],
    suggestedMeals: ['Indian sweets', 'Festive meals'],
    suggestedItems: ['ghee', 'sugar', 'nuts', 'cardamom', 'saffron', 'rice', 'lentils', 'sweets', 'snacks'],
    icon: HOLIDAY_ICONS.diwali,
    daysOfCelebration: 5,
  },
  holi: {
    id: 'holi',
    name: 'Holi',
    category: 'hindu',
    description: 'Festival of Colors',
    traditions: ['Color throwing', 'Bonfires', 'Sweets'],
    suggestedMeals: ['Gujiya', 'Thandai', 'Festive foods'],
    suggestedItems: ['milk', 'nuts', 'rose water', 'saffron', 'sweets', 'snacks'],
    icon: HOLIDAY_ICONS.holi,
  },
  navratri: {
    id: 'navratri',
    name: 'Navratri',
    category: 'hindu',
    description: 'Nine nights celebrating Goddess Durga',
    traditions: ['Dancing', 'Fasting', 'Prayer'],
    suggestedMeals: ['Vegetarian/vegan fasting foods'],
    suggestedItems: ['fruits', 'milk', 'potatoes', 'buckwheat', 'nuts', 'yogurt'],
    icon: HOLIDAY_ICONS.vesak,
    daysOfCelebration: 9,
  },

  // CHINESE
  lunar_new_year: {
    id: 'lunar_new_year',
    name: 'Lunar New Year',
    category: 'chinese',
    description: 'Chinese New Year celebration',
    traditions: ['Family reunion', 'Red envelopes', 'Fireworks', 'Cleaning'],
    suggestedMeals: ['Dumplings', 'Fish', 'Noodles', 'Spring rolls'],
    suggestedItems: [
      'dumplings', 'fish', 'noodles', 'spring roll wrappers',
      'oranges', 'tangerines', 'rice cake', 'pork', 'bok choy'
    ],
    icon: HOLIDAY_ICONS.lunar_new_year,
    daysOfCelebration: 15,
  },
  mid_autumn: {
    id: 'mid_autumn',
    name: 'Mid-Autumn Festival',
    category: 'chinese',
    description: 'Moon Festival - harvest celebration',
    traditions: ['Mooncakes', 'Lanterns', 'Family gathering'],
    suggestedMeals: ['Mooncakes', 'Pomelo', 'Tea'],
    suggestedItems: ['mooncakes', 'pomelo', 'tea', 'taro'],
    icon: HOLIDAY_ICONS.lunar_new_year,
  },

  // CULTURAL
  cinco_de_mayo: {
    id: 'cinco_de_mayo',
    name: 'Cinco de Mayo',
    category: 'cultural',
    description: 'Mexican heritage celebration',
    traditions: ['Mexican food', 'Mariachi', 'Celebration'],
    suggestedMeals: ['Tacos', 'Enchiladas', 'Margaritas'],
    suggestedItems: [
      'tortillas', 'ground beef', 'chicken', 'cheese', 'salsa',
      'avocados', 'lime', 'cilantro', 'tequila', 'margarita mix', 'chips'
    ],
    icon: HOLIDAY_ICONS.cinco_de_mayo,
  },
  st_patricks: {
    id: 'st_patricks',
    name: "St. Patrick's Day",
    category: 'cultural',
    description: 'Irish heritage celebration',
    traditions: ['Wearing green', 'Parades', 'Irish food'],
    suggestedMeals: ['Corned beef and cabbage', 'Irish soda bread'],
    suggestedItems: ['corned beef', 'cabbage', 'potatoes', 'carrots', 'irish soda bread', 'guinness', 'green food coloring'],
    icon: HOLIDAY_ICONS.st_patricks,
  },
  mardi_gras: {
    id: 'mardi_gras',
    name: 'Mardi Gras',
    category: 'cultural',
    description: 'Fat Tuesday celebration before Lent',
    traditions: ['Parades', 'King cake', 'Beads'],
    suggestedMeals: ['King cake', 'Cajun food', 'Beignets'],
    suggestedItems: ['king cake', 'jambalaya ingredients', 'andouille sausage', 'shrimp', 'rice', 'beignet mix'],
    icon: HOLIDAY_ICONS.mardi_gras,
  },
};

// ============================================
// DATE CALCULATION FUNCTIONS
// ============================================

/**
 * Get Easter date for a given year (Western/Gregorian)
 * Uses the Anonymous Gregorian algorithm
 */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Get nth occurrence of a weekday in a month
 * weekday: 0 = Sunday, 1 = Monday, etc.
 * n: 1 = first, 2 = second, -1 = last
 */
export function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
    return new Date(year, month, day);
  } else {
    // Last occurrence
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    let day = lastDay.getDate() - ((lastWeekday - weekday + 7) % 7);
    return new Date(year, month, day);
  }
}

/**
 * Convert Hijri (Islamic) date to Gregorian
 * Note: This is an approximation. For exact dates, use a proper library.
 * Islamic calendar is lunar-based, ~354 days per year
 */
export function hijriToGregorian(hijriYear: number, hijriMonth: number, hijriDay: number): Date {
  // Approximate calculation - Islamic calendar started July 16, 622 CE
  const hijriEpoch = new Date(622, 6, 16).getTime();
  const daysInHijriYear = 354.36667;
  const daysInHijriMonth = 29.530588853;

  const daysSinceEpoch =
    (hijriYear - 1) * daysInHijriYear +
    (hijriMonth - 1) * daysInHijriMonth +
    hijriDay;

  return new Date(hijriEpoch + daysSinceEpoch * 24 * 60 * 60 * 1000);
}

/**
 * Get approximate Islamic holiday date for a given Gregorian year
 * Ramadan is the 9th month, Eid al-Fitr is 1st of 10th month (Shawwal)
 * Eid al-Adha is 10th of 12th month (Dhul Hijjah)
 */
export function getIslamicHolidayDate(year: number, holiday: 'ramadan' | 'eid_fitr' | 'eid_adha'): Date {
  // Islamic year approximation for given Gregorian year
  // Islamic calendar is about 11 days shorter than Gregorian
  const gregorianDays = (year - 622) * 365.25;
  const islamicYear = Math.floor(gregorianDays / 354.36667) + 1;

  // These dates shift each year - using approximations
  // In practice, you'd want to use a proper Hijri calendar library
  const baseDate = new Date(year, 0, 1);

  // Approximate offsets (these shift ~11 days earlier each year)
  const islamicNewYearOffset = ((year - 2024) * -11) % 354;

  switch (holiday) {
    case 'ramadan':
      // Ramadan starts ~9 months into Islamic year
      return new Date(baseDate.getTime() + ((islamicNewYearOffset + 236) % 354) * 24 * 60 * 60 * 1000);
    case 'eid_fitr':
      // Eid al-Fitr is after Ramadan (~10 months into Islamic year)
      return new Date(baseDate.getTime() + ((islamicNewYearOffset + 266) % 354) * 24 * 60 * 60 * 1000);
    case 'eid_adha':
      // Eid al-Adha is ~12 months into Islamic year
      return new Date(baseDate.getTime() + ((islamicNewYearOffset + 306) % 354) * 24 * 60 * 60 * 1000);
  }
}

/**
 * Get Hebrew calendar date approximation
 * Jewish holidays are based on the lunisolar Hebrew calendar
 */
export function getJewishHolidayDate(year: number, holiday: string): Date {
  // Jewish holidays relative to Gregorian calendar (approximations)
  // These vary by a few weeks each year due to the Hebrew calendar

  // Rosh Hashanah: September/October
  // Yom Kippur: 10 days after Rosh Hashanah
  // Sukkot: 15th of Tishrei (5 days after Yom Kippur)
  // Hanukkah: 25th of Kislev (November/December)
  // Passover: 15th of Nisan (March/April)

  // Simple approximation - in production, use a proper Hebrew calendar library
  const yearOffset = year - 2024;

  const baseRoshHashanah = new Date(2024, 9, 3); // Oct 3, 2024
  const adjustedDays = yearOffset * 11 % 30; // Hebrew calendar adjustment

  switch (holiday) {
    case 'rosh_hashanah':
      return new Date(year, 8, 15 + (adjustedDays % 15)); // Sept 15-30 range
    case 'yom_kippur':
      const rh = getJewishHolidayDate(year, 'rosh_hashanah');
      return new Date(rh.getTime() + 9 * 24 * 60 * 60 * 1000);
    case 'sukkot':
      const yk = getJewishHolidayDate(year, 'yom_kippur');
      return new Date(yk.getTime() + 5 * 24 * 60 * 60 * 1000);
    case 'hanukkah':
      return new Date(year, 11, 10 + (adjustedDays % 15)); // Dec 10-25 range
    case 'passover':
      return new Date(year, 3, 5 + (adjustedDays % 20)); // April 5-25 range
    default:
      return new Date(year, 0, 1);
  }
}

/**
 * Get Chinese Lunar New Year date
 * Falls between Jan 21 and Feb 20
 */
export function getLunarNewYearDate(year: number): Date {
  // Lunar New Year dates (simplified calculation)
  // In production, use a proper lunar calendar library
  const knownDates: Record<number, [number, number]> = {
    2024: [1, 10],  // Feb 10, 2024
    2025: [0, 29],  // Jan 29, 2025
    2026: [1, 17],  // Feb 17, 2026
    2027: [1, 6],   // Feb 6, 2027
    2028: [0, 26],  // Jan 26, 2028
    2029: [1, 13],  // Feb 13, 2029
    2030: [1, 3],   // Feb 3, 2030
  };

  if (knownDates[year]) {
    return new Date(year, knownDates[year][0], knownDates[year][1]);
  }

  // Fallback approximation
  return new Date(year, 1, 1);
}

/**
 * Get Diwali date (based on Hindu lunisolar calendar)
 * Falls in October or November
 */
export function getDiwaliDate(year: number): Date {
  const knownDates: Record<number, [number, number]> = {
    2024: [10, 1],  // Nov 1, 2024
    2025: [9, 20],  // Oct 20, 2025
    2026: [10, 8],  // Nov 8, 2026
    2027: [9, 29],  // Oct 29, 2027
    2028: [9, 17],  // Oct 17, 2028
    2029: [10, 5],  // Nov 5, 2029
    2030: [9, 26],  // Oct 26, 2030
  };

  if (knownDates[year]) {
    return new Date(year, knownDates[year][0], knownDates[year][1]);
  }

  return new Date(year, 9, 25); // Approximation
}

// ============================================
// MAIN CALENDAR FUNCTIONS
// ============================================

/**
 * Get all holiday occurrences for a given year
 */
export function getHolidaysForYear(year: number, categories?: HolidayCategory[]): HolidayOccurrence[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const occurrences: HolidayOccurrence[] = [];

  const addOccurrence = (holiday: Holiday, date: Date, endDate?: Date) => {
    const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    occurrences.push({
      ...holiday,
      date,
      endDate,
      daysUntil,
      isToday: daysUntil === 0,
      isThisWeek: daysUntil >= 0 && daysUntil <= 7,
    });
  };

  // FIXED DATE HOLIDAYS
  addOccurrence(HOLIDAYS.new_year, new Date(year, 0, 1));
  addOccurrence(HOLIDAYS.valentines, new Date(year, 1, 14));
  addOccurrence(HOLIDAYS.st_patricks, new Date(year, 2, 17));
  addOccurrence(HOLIDAYS.cinco_de_mayo, new Date(year, 4, 5));
  addOccurrence(HOLIDAYS.independence_day, new Date(year, 6, 4));
  addOccurrence(HOLIDAYS.halloween, new Date(year, 9, 31));
  addOccurrence(HOLIDAYS.christmas, new Date(year, 11, 25), new Date(year, 11, 26));

  // VARIABLE US HOLIDAYS
  addOccurrence(HOLIDAYS.mlk_day, getNthWeekdayOfMonth(year, 0, 1, 3)); // 3rd Monday Jan
  addOccurrence(HOLIDAYS.presidents_day, getNthWeekdayOfMonth(year, 1, 1, 3)); // 3rd Monday Feb
  addOccurrence(HOLIDAYS.mothers_day, getNthWeekdayOfMonth(year, 4, 0, 2)); // 2nd Sunday May
  addOccurrence(HOLIDAYS.memorial_day, getNthWeekdayOfMonth(year, 4, 1, -1)); // Last Monday May
  addOccurrence(HOLIDAYS.fathers_day, getNthWeekdayOfMonth(year, 5, 0, 3)); // 3rd Sunday June
  addOccurrence(HOLIDAYS.labor_day, getNthWeekdayOfMonth(year, 8, 1, 1)); // 1st Monday Sept
  addOccurrence(HOLIDAYS.thanksgiving, getNthWeekdayOfMonth(year, 10, 4, 4)); // 4th Thursday Nov

  // EASTER-BASED
  const easter = getEasterDate(year);
  addOccurrence(HOLIDAYS.easter, easter);
  addOccurrence(HOLIDAYS.good_friday, new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000));

  // Mardi Gras: 47 days before Easter
  const mardiGras = new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000);
  addOccurrence(HOLIDAYS.mardi_gras, mardiGras);

  // JEWISH HOLIDAYS
  addOccurrence(HOLIDAYS.rosh_hashanah, getJewishHolidayDate(year, 'rosh_hashanah'));
  addOccurrence(HOLIDAYS.yom_kippur, getJewishHolidayDate(year, 'yom_kippur'));
  addOccurrence(HOLIDAYS.sukkot, getJewishHolidayDate(year, 'sukkot'));
  addOccurrence(HOLIDAYS.hanukkah, getJewishHolidayDate(year, 'hanukkah'));
  addOccurrence(HOLIDAYS.passover, getJewishHolidayDate(year, 'passover'));

  // ISLAMIC HOLIDAYS
  addOccurrence(HOLIDAYS.ramadan_start, getIslamicHolidayDate(year, 'ramadan'));
  addOccurrence(HOLIDAYS.eid_al_fitr, getIslamicHolidayDate(year, 'eid_fitr'));
  addOccurrence(HOLIDAYS.eid_al_adha, getIslamicHolidayDate(year, 'eid_adha'));

  // HINDU HOLIDAYS
  addOccurrence(HOLIDAYS.diwali, getDiwaliDate(year));
  // Holi: day after full moon in March (simplified)
  addOccurrence(HOLIDAYS.holi, new Date(year, 2, 14 + (year % 4))); // Approximation

  // CHINESE HOLIDAYS
  addOccurrence(HOLIDAYS.lunar_new_year, getLunarNewYearDate(year));
  // Mid-Autumn: 15th day of 8th lunar month (Sept/Oct)
  addOccurrence(HOLIDAYS.mid_autumn, new Date(year, 8, 17 + (year % 3)));

  // Filter by categories if specified
  if (categories && categories.length > 0) {
    return occurrences
      .filter(h => categories.includes(h.category))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get upcoming holidays within the next N days
 */
export function getUpcomingHolidays(
  days: number = 30,
  categories?: HolidayCategory[]
): HolidayOccurrence[] {
  const today = new Date();
  const year = today.getFullYear();

  // Get holidays for this year and next (for year-end scenarios)
  const holidays = [
    ...getHolidaysForYear(year, categories),
    ...getHolidaysForYear(year + 1, categories),
  ];

  return holidays.filter(h => h.daysUntil >= 0 && h.daysUntil <= days);
}

/**
 * Get holidays for a specific month
 */
export function getHolidaysForMonth(
  year: number,
  month: number,
  categories?: HolidayCategory[]
): HolidayOccurrence[] {
  const holidays = getHolidaysForYear(year, categories);
  return holidays.filter(h => h.date.getMonth() === month);
}

/**
 * Check if a specific date has any holidays
 */
export function getHolidaysOnDate(
  date: Date,
  categories?: HolidayCategory[]
): HolidayOccurrence[] {
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year, categories);

  return holidays.filter(h => {
    const holidayDate = new Date(h.date);
    holidayDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Check if it's the holiday date or within multi-day celebration
    if (holidayDate.getTime() === checkDate.getTime()) return true;

    if (h.endDate) {
      return checkDate >= holidayDate && checkDate <= h.endDate;
    }

    if (h.daysOfCelebration && h.daysOfCelebration > 1) {
      const endDate = new Date(holidayDate);
      endDate.setDate(endDate.getDate() + h.daysOfCelebration - 1);
      return checkDate >= holidayDate && checkDate <= endDate;
    }

    return false;
  });
}

/**
 * Get next occurrence of a specific holiday
 */
export function getNextHoliday(holidayId: string): HolidayOccurrence | null {
  const today = new Date();
  const year = today.getFullYear();

  const holidays = [
    ...getHolidaysForYear(year),
    ...getHolidaysForYear(year + 1),
  ];

  const upcoming = holidays
    .filter(h => h.id === holidayId && h.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming[0] || null;
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format days until holiday in human-readable form
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  if (days <= 14) return 'Next week';
  if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
  return `In ${Math.ceil(days / 30)} months`;
}

/**
 * Format date for display
 */
export function formatHolidayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get greeting based on upcoming holiday
 */
export function getHolidayGreeting(holiday: HolidayOccurrence): string {
  if (holiday.isToday) {
    return `Happy ${holiday.name}!`;
  }
  if (holiday.daysUntil === 1) {
    return `${holiday.name} is tomorrow!`;
  }
  if (holiday.isThisWeek) {
    return `${holiday.name} is coming up this week!`;
  }
  return `${holiday.name} is in ${holiday.daysUntil} days`;
}
