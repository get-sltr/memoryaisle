// ============================================
// MEMORYAISLE DESIGN SYSTEM
// Liquid Glass + Platinum/Gold Aesthetic
// ============================================

// ==================== COLORS ====================

export const COLORS = {
  // Platinum palette - cool, elegant silver-blue
  platinum: {
    lightest: '#F8F9FB',
    light: '#E8ECF2',
    base: '#C9CDD4',
    mid: '#A8AEB8',
    dark: '#8A919D',
  },

  // Gold accents - warm, premium feel
  gold: {
    lightest: '#FEF9E7',
    light: '#F7E5B3',
    base: '#D4A547',
    dark: '#B8860B',
  },

  // Semantic colors - HIG compliant contrast ratios
  // WCAG AA: 4.5:1 for normal text, 3:1 for large text
  text: {
    primary: '#1C1C1E',      // Was #5A6070 - now system label color for proper contrast
    secondary: '#636366',    // Was #8A919D - now system secondary label
    tertiary: '#8E8E93',     // Added tertiary for less important text
    inverse: '#FFFFFF',
  },

  // Frosted glass
  frost: {
    bg: 'rgba(255, 255, 255, 0.28)',
    bgHeavy: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.6)',
    shine: 'rgba(255, 255, 255, 0.8)',
  },

  // Status colors
  success: '#7EB88A',
  warning: '#D4A547',
  error: '#D4614C',

  // Meal type colors
  meals: {
    breakfast: ['#F0B86E', '#E09145'],
    lunch: ['#7EB88A', '#5A9E68'],
    dinner: ['#8E7CC3', '#6A5ACD'],
  },

  // UI
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(210, 190, 160, 0.7)',

  // Background gradient stops - warm golden tones
  background: {
    start: '#FAF6F0',   // warm ivory/cream
    mid1: '#F5EDE0',    // soft warm beige
    mid2: '#EDE3D0',    // golden beige
    end: '#E5D8C0',     // warm gold
    gradient: ['#FAF6F0', '#F5EDE0', '#EDE3D0', '#E5D8C0'] as const,
  },

  // Legacy compatibility (will remove after migration)
  paper: '#FAF6F0',
  paperDark: '#F5EDE0',
  ink: '#1C1C1E',           // Updated for contrast
  inkLight: '#636366',      // Updated for contrast
  inkFaded: '#8E8E93',      // Updated for contrast
  primary: '#D4A547',
  primaryLight: '#F7E5B3',
  primaryDark: '#B8860B',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

// Dark mode palette
export const COLORS_DARK = {
  // Platinum palette - inverted for dark mode
  platinum: {
    lightest: '#1A1D22',
    light: '#252A32',
    base: '#3A424E',
    mid: '#5A6575',
    dark: '#7A8595',
  },

  // Gold accents - slightly brighter for dark mode
  gold: {
    lightest: '#2A2518',
    light: '#4A3D20',
    base: '#E8B84A',
    dark: '#D4A547',
  },

  // Semantic colors - HIG compliant for dark mode
  text: {
    primary: '#FFFFFF',      // System label for dark mode
    secondary: '#EBEBF5',    // System secondary label (99% opacity on dark)
    tertiary: '#EBEBF599',   // System tertiary label (60% opacity)
    inverse: '#1A1D22',
  },

  // Frosted glass - darker
  frost: {
    bg: 'rgba(30, 35, 45, 0.6)',
    bgHeavy: 'rgba(40, 45, 55, 0.8)',
    border: 'rgba(255, 255, 255, 0.12)',
    shine: 'rgba(255, 255, 255, 0.15)',
  },

  // Status colors - brighter for visibility
  success: '#8FC89A',
  warning: '#E8B84A',
  error: '#E8786A',

  // Meal type colors
  meals: {
    breakfast: ['#F0B86E', '#E09145'],
    lunch: ['#8FC89A', '#6AAF78'],
    dinner: ['#9E8CD3', '#7A6ADD'],
  },

  // UI
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(10, 12, 18, 0.8)',

  // Background gradient stops
  background: {
    start: '#1A1D22',
    mid1: '#1E2228',
    mid2: '#22272E',
    end: '#262C35',
    gradient: ['#1A1D22', '#1E2228', '#22272E', '#262C35'] as const,
  },

  // Legacy compatibility
  paper: '#1A1D22',
  paperDark: '#252A32',
  ink: '#FFFFFF',           // Updated for contrast
  inkLight: '#EBEBF5',      // Updated for contrast
  inkFaded: '#EBEBF599',    // Updated for contrast
  primary: '#E8B84A',
  primaryLight: '#F7E5B3',
  primaryDark: '#D4A547',
  shadow: 'rgba(0, 0, 0, 0.4)',
};

export type ThemeColors = typeof COLORS;

// ==================== TYPOGRAPHY ====================
// HIG Compliance: Minimum readable font size is 11pt
// Body text should be at least 17pt for optimal readability

export const FONTS = {
  // Display - elegant serif for headers
  display: {
    regular: 'Playfair Display',
    medium: 'Playfair Display',
    semibold: 'Playfair Display',
  },
  // Body - clean sans-serif (use system font for Dynamic Type support)
  sans: {
    light: 'System',
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  // Handwriting for list items (fallback to system)
  handwriting: {
    regular: 'Bradley Hand',
    bold: 'Bradley Hand',
  },
  // Legacy
  serif: {
    regular: 'Georgia',
    bold: 'Georgia-Bold',
  },
};

// HIG-compliant font sizes
// Minimum: 11pt, Body: 17pt recommended, Captions: 12pt minimum
export const FONT_SIZES = {
  xs: 11,      // Was 10 - minimum readable (captions, footnotes)
  sm: 13,      // Was 12 - small body text, tab labels
  md: 15,      // Was 14 - secondary body text
  lg: 17,      // Was 16 - primary body text (HIG recommended)
  xl: 20,      // Was 18 - emphasized text
  xxl: 22,     // Was 20 - subheadings
  title: 28,   // Was 26 - titles
  hero: 34,    // Was 32 - large display
};

export const FONT_WEIGHTS = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const LETTER_SPACING = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
};

// ==================== SPACING ====================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

// ==================== BORDER RADIUS ====================

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// ==================== SHADOWS ====================

export const SHADOWS = {
  // Glass card shadow
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  // Elevated glass
  glassElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 8,
  },
  // Gold glow for primary buttons
  goldGlow: {
    shadowColor: '#D4A547',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  // Subtle
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
};

// ==================== ANIMATIONS ====================

export const ANIMATION = {
  // Durations (ms)
  fast: 150,
  normal: 300,
  slow: 400,
  slower: 500,

  // Spring configs
  spring: {
    gentle: { damping: 20, stiffness: 180 },
    snappy: { damping: 15, stiffness: 300 },
    bouncy: { damping: 10, stiffness: 200 },
  },

  // Legacy
  fadeOut: 400,
};

// ==================== GLASS STYLES ====================
// Reusable glass morphism configurations

export const GLASS = {
  // Light glass card
  card: {
    blur: 20,
    tint: 'light' as const,
    gradient: ['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.6)'],
    border: 'rgba(255, 255, 255, 0.6)',
    shine: 'rgba(255, 255, 255, 0.8)',
  },
  // Heavy glass (nav bars, input bars)
  heavy: {
    blur: 30,
    tint: 'light' as const,
    gradient: ['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)'],
    border: 'rgba(255, 255, 255, 0.6)',
    shine: 'rgba(255, 255, 255, 0.9)',
  },
  // Dark glass
  dark: {
    blur: 25,
    tint: 'dark' as const,
    gradient: ['rgba(40, 40, 50, 0.8)', 'rgba(30, 30, 40, 0.9)'],
    border: 'rgba(255, 255, 255, 0.1)',
    shine: 'rgba(255, 255, 255, 0.15)',
  },
};

// ==================== NAV BAR ====================

export const NAV_HEIGHT = {
  bottom: 90,       // Was 80 - increased for proper touch targets
  header: 100,
};

// ==================== HIG COMPLIANCE ====================
// Minimum touch target size per Apple HIG
export const HIG = {
  minTouchTarget: 44,       // Minimum 44x44pt touch target
  minFontSize: 11,          // Minimum readable font size
  bodyFontSize: 17,         // Recommended body text size
  tabBarHeight: 49,         // Standard tab bar height (without safe area)
  navBarHeight: 44,         // Standard navigation bar height
  searchBarHeight: 36,      // Standard search bar height
  buttonMinHeight: 44,      // Minimum button height
  listRowMinHeight: 44,     // Minimum list row height
};
