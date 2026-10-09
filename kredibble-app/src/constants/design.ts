/**
 * Kredibble Design System (TypeScript view of the tokens)
 * The values live in ./tokens.js (the single source of truth, shared with tailwind.config.js).
 * This file keeps the names existing screens import and adds the new ones. Never hard-code values in screens.
 */

import tokens from './tokens';

const { purple, accent, neutral, status } = tokens;

// ─── Colors ───────────────────────────────────────────────────────────────────
// Orange (accent) is for icons, dots and badges. A filled orange button is accent600 with white text; orange text is accent700.
// Never orange text on white and never white text on accent500 (3.10:1).

export const Colors = {
  // Brand (purple = structure)
  primary: purple[500],
  primaryLight: purple[400],
  primaryDark: purple[700],
  primaryPressed: purple[600],
  primaryTransparent: purple[50],   // tinted background (selected row)
  primaryChip: purple[100],         // multi-select chip background (text purple700)
  purple50: purple[50],
  purple100: purple[100],
  purple200: purple[200],
  purple400: purple[400],
  purple500: purple[500],
  purple600: purple[600],
  purple700: purple[700],
  primary10: tokens.purple10,        // primary at 10 % opacity: disabled primary button, soft secondary buttons

  // Accent (orange)
  accent500: accent[500],           // icons, dots, badges ONLY
  accent600: accent[600],           // filled button (white label)
  accent700: accent[700],           // orange text
  accent50: accent[50],
  accent100: accent[100],

  // Backgrounds
  bgScreen: neutral.page,           // auth + main screen background
  bgOnboarding: purple[500],        // onboarding screen background
  bgDefault: neutral.page,
  bgAlt: neutral.surface2,
  bgCard: neutral.surface,
  bgAdsBanner: neutral.surface2,    // ads placeholder banner
  bgAdsBannerInner: neutral.border,

  // Text
  textDefault: neutral.text,
  textBody: neutral.text,
  textMuted: neutral.muted,         // subtitles, helper text, secondary labels
  textSecondary: neutral.muted,
  textPlaceholder: neutral.muted,
  textOnPrimary: neutral.white,
  textAds: neutral.muted,           // ads banner label
  textHeading: neutral.text,        // screen-level header titles

  // Borders
  borderDefault: neutral.border,    // decorative card edge
  borderInput: neutral.borderInput, // control edge (3:1)

  // States: success/error/warning are safe as TEXT; the *Dot values are for icons and dots.
  success: status.success.text,
  successDot: status.success.dot,
  successTint: status.success.tint,
  error: status.danger.text,
  errorDot: status.danger.dot,
  errorTint: status.danger.tint,
  warning: status.warning.text,
  warningDot: status.warning.dot,
  warningTint: status.warning.tint,
  warningSoft: status.warning.soft, // soft background with dark text only

  // Tab Bar (purple background, all icons white)
  tabBar: purple[500],
  tabIcon: neutral.white,
  tabIconActive: accent[500],       // active tab icon (orange, as in the approved home design)
  tabIndicator: accent[500],        // active underline (orange)

  // Role selector cards (signup)
  radioUnselected: neutral.borderInput,

  // Utility
  divider: neutral.border,
  white: neutral.white,
  black: neutral.black,
  transparent: 'transparent',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FontFamily = {
  sans: tokens.fontFamily.body,         // 'Inter' (base name; src/lib/typography.tsx picks the loaded weight)
  heading: tokens.fontFamily.heading,   // 'PlusJakartaSans'
} as const;

export const FontFaces = tokens.fontFaces;

export const FontSize = tokens.fontSize;

export const LineHeight = tokens.lineHeight;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,    // card titles, form labels
  semibold: '600' as const,  // screen header titles
  bold: 'bold' as const,     // auth headings, buttons, links
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Base unit is 4px. Scale follows 2/4/8/16/20/24/32/40/48/64.

export const Spacing = tokens.spacing;

export const Layout = {
  screenPaddingH: 24,     // auth screens horizontal edge padding
  homePaddingH: 20,       // home + tab screens horizontal edge padding
  screenPaddingTop: 28,   // top padding inside scrollable auth screens
  screenPaddingBottom: 24,
  sectionGap: 32,         // gap between major content sections
  fieldGap: 20,           // gap between form fields
  labelGap: 8,            // gap between a label and its input
  buttonGap: 16,          // gap between stacked secondary buttons
  inlineGap: 12,          // gap between an icon and its adjacent label
  checkboxGap: 8,         // gap between checkbox and its text
  featureCardGap: 20,     // gap between home screen feature cards (rows + columns)
  maxContentWidth: 800,   // web cap — content never wider than this
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
// ONE radius for controls (buttons, inputs, pickers): 12. md and lg are kept so existing imports compile; both are 12.

export const Radius = {
  sm: tokens.radius.check,       // checkboxes, small chips
  check: tokens.radius.check,
  inset: tokens.radius.inset,
  control: tokens.radius.control, // buttons, text inputs, pickers
  md: tokens.radius.control,      // legacy name (was 8) -> control
  lg: tokens.radius.control,      // legacy name -> control
  searchBar: tokens.radius.searchBar,
  card: tokens.radius.card,       // cards, sheet corners
  full: tokens.radius.pill,       // pills, avatar circles
  pill: tokens.radius.pill,
} as const;

// ─── Sizing ───────────────────────────────────────────────────────────────────

export const Size = {
  // Buttons & inputs: ONE height (48)
  controlHeight: tokens.size.controlHeight,
  buttonHeight: tokens.size.controlHeight,
  inputHeight: tokens.size.controlHeight,
  searchBarHeight: tokens.size.searchBarHeight,

  logoSize: tokens.size.logoSize,
  logoSizeHome: tokens.size.logoSizeHome,

  tabBarHeight: tokens.size.tabBarHeight,
  tabIconSize: tokens.size.tabIconSize,
  tabIndicatorW: tokens.size.tabIndicatorW,
  tabIndicatorH: tokens.size.tabIndicatorH,

  adsBannerHeight: tokens.size.adsBannerHeight,
  featureCardHeight: tokens.size.featureCardHeight,

  progressBarHeight: tokens.size.progressBarHeight,

  paginationDotActive: tokens.size.paginationDotActive,
  paginationDotInactive: tokens.size.paginationDotInactive,
  paginationDotGap: tokens.size.paginationDotGap,
  borderWidth: tokens.size.borderWidth,
  checkboxSize: tokens.size.checkboxSize,
  checkboxIconSize: tokens.size.checkboxIconSize,
  socialIconSize: tokens.size.socialIconSize,
} as const;

// ─── Feature Card Decoration ──────────────────────────────────────────────────
// White blur ellipses placed at top-left and bottom-right corners of every
// home screen feature card.

export const CardDecor = {
  ellipseW: 37.93,
  ellipseH: 45.32,
  blur: '12px',           // CSS filter: blur() — web only
  color: Colors.white,
} as const;

// Buttons and search bars have no drop shadow (design decision, 2026-10-08), so there is no Shadow token.
