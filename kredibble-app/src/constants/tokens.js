/**
 * Kredibble design tokens: the ONE place where colour, type, radius, height and spacing values are written.
 *
 * Plain CommonJS on purpose, so it can be read by both
 *   - tailwind.config.js (CommonJS, runs in Node), and
 *   - src/constants/design.ts (TypeScript, re-exports these values for code that needs a number or a colour string).
 *
 * Brand: purple #792EA4 is structure (navigation, selection, links, charts). Orange #FC5E24 is the single accent.
 * Source of every decision: docs/mobile-design-brief.md (contrast ratios are listed there).
 *
 * Orange rules (WCAG AA):
 *   - #FC5E24 is for icons, dots, badges and decoration ONLY. It is 3.10:1 on white, so never use it as text colour
 *     and never put white text on it.
 *   - A filled orange button uses accent[600] (#CC4A12) with white text (4.61:1).
 *   - Orange text uses accent[700] (#B53B0A) (5.84:1).
 */

// ─── Colour scales ─────────────────────────────────────────────────────────────

const purple = {
  50: '#F6EFFA', // tint: selected row, chip background
  100: '#ECDDF5', // tint: chip, soft fill
  200: '#D9BDEB', // decorative only (1.69:1 on white)
  400: '#9A52C2', // light: charts, graphics (4.82:1 on white)
  500: '#792EA4', // PRIMARY: tab bar, headers, links, onboarding (7.66:1 on white)
  600: '#6A2792', // dark: pressed state
  700: '#5A2079', // darkest: text on tints (10.95:1 on white)
};

// Primary purple (#792EA4) at 10 % opacity: disabled primary buttons and soft secondary buttons.
const purple10 = 'rgba(121, 46, 164, 0.1)';

const accent = {
  50: '#FFF1EA',
  100: '#FFDFD0',
  500: '#FC5E24', // icons, dots, badges only
  600: '#CC4A12', // filled button, white label
  700: '#B53B0A', // orange text
};

const neutral = {
  page: '#F3F3F7', // screen background
  surface: '#FFFFFF', // cards
  surface2: '#F6F5FA', // inset areas
  border: '#E9E8F0', // decorative card/divider line (not a control edge)
  borderInput: '#8F89A3', // control edge: inputs, unselected radio/checkbox (3.35:1 on white)
  text: '#17121F', // body and headings (18.38:1 on white)
  muted: '#66607A', // secondary text and placeholder (5.97:1 on white, 5.39:1 on page)
  white: '#FFFFFF',
  black: '#000000',
};

// Status colours. "text" is safe as text on white/tint (>= 4.5:1); "dot" is for icons and dots (>= 3:1 on white).
const status = {
  success: { text: '#15803D', dot: '#16A34A', tint: '#E8F6EE' },
  danger: { text: '#B91C1C', dot: '#DC2626', tint: '#FDECEC' },
  // Warning: #D97706 dot/icon (3.19:1 on white), #B45309 text (5.02:1 on white),
  // #F6B612 only as a soft background with dark text (#17121F on it is 10.17:1).
  warning: { text: '#B45309', dot: '#D97706', tint: '#FDF3D8', soft: '#F6B612' },
};

// ─── Typography ────────────────────────────────────────────────────────────────

// Family "bases" used in code. src/lib/typography.tsx maps (base + weight) to the loaded face below.
const fontFamily = {
  body: 'Inter', // everything except titles and key figures
  heading: 'PlusJakartaSans', // screen titles, auth headings, onboarding hero, key figures
};

// Loaded faces (names are the exports of @expo-google-fonts/*; React Native needs one family name per weight).
const fontFaces = {
  Inter: { 300: 'Inter_300Light', 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
  PlusJakartaSans: { 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold', 800: 'PlusJakartaSans_800ExtraBold' },
};

// Real italic faces (only Plus Jakarta Sans italics are loaded; Inter italic falls back to the upright face).
const fontFacesItalic = {
  PlusJakartaSans: { 600: 'PlusJakartaSans_600SemiBold_Italic', 700: 'PlusJakartaSans_700Bold_Italic', 800: 'PlusJakartaSans_800ExtraBold_Italic' },
};

const fontSize = {
  xs: 12, // captions, helper text, chip labels
  sm: 13, // form labels, footer links
  base: 14, // body text, input values
  md: 15, // card titles, primary button text
  screenTitle: 17, // tab screen header title
  lg: 22, // auth screen headings
  xl: 36, // hero / display headings (onboarding)
};

const lineHeight = { body: 18, card: 22, subtext: 20, heading: 42 };

const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: 'bold' };

// ─── Shape and size ────────────────────────────────────────────────────────────

const radius = {
  check: 4, // checkboxes, small chips
  inset: 10, // inset elements inside a card
  control: 12, // buttons, text inputs, pickers (ONE radius for controls)
  searchBar: 15, // home search bar (decision pending, see brief)
  card: 16, // cards, sheet corners
  pill: 9999, // pills, avatars, dots
};

const size = {
  controlHeight: 48, // ONE height for every button and text input (48 dp touch target)
  searchBarHeight: 50,
  logoSize: 56,
  logoSizeHome: 40,
  tabBarHeight: 64,
  tabIconSize: 24,
  tabIndicatorW: 12,
  tabIndicatorH: 3,
  adsBannerHeight: 59,
  featureCardHeight: 121.7,
  progressBarHeight: 4,
  paginationDotActive: 6,
  paginationDotInactive: 4,
  paginationDotGap: 6,
  borderWidth: 1,
  checkboxSize: 16,
  checkboxIconSize: 12,
  socialIconSize: 18,
};

// 4 px base. Keys are the existing design.ts keys.
const spacing = { 0.5: 2, 1: 4, 2: 8, 3: 16, 4: 20, 5: 24, 6: 32, 7: 40, 8: 48, 9: 64 };

module.exports = {
  purple,
  purple10,
  accent,
  neutral,
  status,
  fontFamily,
  fontFaces,
  fontFacesItalic,
  fontSize,
  lineHeight,
  fontWeight,
  radius,
  size,
  spacing,
};
