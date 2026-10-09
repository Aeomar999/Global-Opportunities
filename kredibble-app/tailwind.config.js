/**
 * Tailwind / NativeWind config. Every value is read from src/constants/tokens.js (the single source of truth);
 * do not write hex values here. The old class names (primary, background, text, success, error, warning, border)
 * are kept so existing screens keep working; new names (accent, purple, page, surface, muted) are added.
 *
 * @type {import('tailwindcss').Config}
 */
const t = require("./src/constants/tokens");

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Structure (purple). DEFAULT is the primary #792EA4.
        primary: {
          DEFAULT: t.purple[500],
          light: t.purple[400],
          dark: t.purple[700],
          pressed: t.purple[600],
          transparent: t.purple[50],
          chip: t.purple[100],
        },
        purple: { ...t.purple, 10: t.purple10 },
        // Single accent (orange): icons, dots, badges only. accent-600 = filled button, accent-700 = orange text.
        accent: t.accent,
        background: {
          DEFAULT: t.neutral.page,
          alt: t.neutral.surface2,
          card: t.neutral.surface,
        },
        page: t.neutral.page,
        surface: { DEFAULT: t.neutral.surface, 2: t.neutral.surface2 },
        text: {
          DEFAULT: t.neutral.text,
          muted: t.neutral.muted,
          light: t.neutral.text,
        },
        muted: t.neutral.muted,
        // Status: DEFAULT is safe as text; dot is for icons and dots; tint is a soft background.
        success: { DEFAULT: t.status.success.text, dot: t.status.success.dot, tint: t.status.success.tint },
        error: { DEFAULT: t.status.danger.text, dot: t.status.danger.dot, tint: t.status.danger.tint },
        warning: { DEFAULT: t.status.warning.text, dot: t.status.warning.dot, tint: t.status.warning.tint, soft: t.status.warning.soft },
        border: { DEFAULT: t.neutral.border, input: t.neutral.borderInput },
      },
      borderRadius: {
        check: `${t.radius.check}px`,
        inset: `${t.radius.inset}px`,
        control: `${t.radius.control}px`,
        card: `${t.radius.card}px`,
      },
      height: {
        control: `${t.size.controlHeight}px`,
      },
      // Family names are bases: src/lib/typography.tsx swaps in the loaded weight face at render time.
      fontFamily: {
        sans: [t.fontFamily.body, "sans-serif"],
        heading: [t.fontFamily.heading, "sans-serif"],
      }
    },
  },
  plugins: [],
}
