export const Colors = {
  bg: '#070710',
  bgCard: '#111128',
  bgCardAlt: '#0E0E22',
  bgSurface: '#181830',
  accent: '#6C63FF',
  accentSoft: 'rgba(108,99,255,0.15)',
  accentTeal: '#00D4C8',
  accentTealSoft: 'rgba(0,212,200,0.12)',
  success: '#00C48C',
  successSoft: 'rgba(0,196,140,0.12)',
  warning: '#FFB800',
  warningSoft: 'rgba(255,184,0,0.12)',
  danger: '#FF5C5C',
  dangerSoft: 'rgba(255,92,92,0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: '#8B8BA8',
  textTertiary: '#4A4A6A',
  border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(108,99,255,0.35)',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
};

export const Gradients = {
  accent: ['#6C63FF', '#A855F7'] as const,
  teal: ['#00D4C8', '#0096C7'] as const,
  success: ['#00C48C', '#00A878'] as const,
  card: ['#181830', '#111128'] as const,
  bg: ['#0D0D1A', '#070710'] as const,
  dark: ['#1A1A35', '#0D0D1A'] as const,
};

export const Fonts = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 30,
    xxxl: 38,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Shadow = {
  accent: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
};
