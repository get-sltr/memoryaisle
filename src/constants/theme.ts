// Paper aesthetic theme - cream background, serif fonts, subtle textures

export const COLORS = {
  // Paper palette
  paper: '#FDF5E6', // Old lace - cream paper background
  paperDark: '#F5E6D3', // Slightly darker for depth
  ink: '#2C2C2C', // Near-black ink color
  inkLight: '#6B6B6B', // Lighter ink for secondary text
  inkFaded: '#A0A0A0', // Faded text (completed items)

  // Accent colors
  primary: '#8B4513', // Saddle brown - warm accent
  success: '#228B22', // Forest green - for confirmations
  warning: '#DAA520', // Goldenrod - for alerts
  error: '#CD5C5C', // Indian red - for errors

  // UI elements
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
};

export const FONTS = {
  // Serif for that paper list feel
  serif: {
    regular: 'Georgia',
    bold: 'Georgia-Bold',
  },
  // Sans for UI elements
  sans: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  title: 40,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Animation durations (ms)
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  fadeOut: 400, // The signature fading list item animation
};
