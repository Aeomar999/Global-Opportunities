/**
 * Typography bridge: gives every <Text> and <TextInput> the right loaded font face, with no change to screens.
 *
 * Why it exists: React Native cannot pick a weight inside a custom font. It needs one family name per weight
 * (Inter_700Bold, PlusJakartaSans_700Bold ...). The screens still say `fontWeight: '600'` or `font-bold`, so at render
 * time this wrapper reads the weight (inline style or a `font-*` class) and the family base, then sets the matching
 * face and resets fontWeight to normal so Android does not fake-bold a bold face.
 *
 * Family rules:
 *   - Plus Jakarta Sans when the style says fontFamily 'PlusJakartaSans' (or the class `font-heading` is used);
 *   - Inter for everything else (the default).
 *
 * Fail safe: installTypography() is only called after the fonts loaded. If loading fails it is never called and
 * the app keeps the system font.
 *
 * Step 1b/2 can remove this bridge once every screen uses explicit font classes.
 */
import React from 'react';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';
import tokens from '../constants/tokens';

const { fontFamily, fontFaces, fontFacesItalic } = tokens;

// Captured BEFORE installTypography() replaces the react-native exports, so the wrappers never call themselves.
const OriginalText = RNText;
const OriginalTextInput = RNTextInput;

const CLASS_WEIGHT: Record<string, number> = { medium: 500, semibold: 600, bold: 700, extrabold: 800 };

/** Turns a style/class weight into a number (400 when missing). */
function toWeight(value: unknown, className?: string): number {
  if (value === 'bold') return 700;
  if (value === 'normal' || value === undefined || value === null) {
    const m = className?.match(/(?:^|\s)font-(medium|semibold|extrabold|bold)(?:\s|$)/);
    return m ? CLASS_WEIGHT[m[1]] : 400;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 400;
}

/** Picks the loaded face for a family base and a weight (nearest available weight). */
export function resolveFace(base: string, weight: number, italic = false): string {
  const italicFaces = (fontFacesItalic as Record<string, Record<number, string>>)[base];
  const faces = (italic && italicFaces) || (fontFaces as Record<string, Record<number, string>>)[base] || fontFaces.Inter;
  const weights = Object.keys(faces).map(Number).sort((a, b) => a - b);
  let best = weights[0];
  for (const w of weights) if (w <= weight) best = w;
  return faces[best];
}

function withFace<P extends { style?: any; className?: string }>(props: P): P {
  const flat = StyleSheet.flatten(props.style) ?? {};
  const wantsHeading = flat.fontFamily === fontFamily.heading || /(?:^|\s)font-heading(?:\s|$)/.test(props.className ?? '');
  const base = wantsHeading ? fontFamily.heading : fontFamily.body;
  // A family that is already a concrete face (for example 'Inter_700Bold') is left alone.
  if (flat.fontFamily && flat.fontFamily !== fontFamily.heading && flat.fontFamily !== fontFamily.body) return props;
  const wantsItalic = flat.fontStyle === 'italic' || /(?:^|\s)italic(?:\s|$)/.test(props.className ?? '');
  const italicFaces = (fontFacesItalic as Record<string, Record<number, string>>)[base];
  const face = resolveFace(base, toWeight(flat.fontWeight, props.className), wantsItalic);
  // When a real italic face is used, fontStyle goes back to normal so Android does not slant it a second time.
  const style = wantsItalic && italicFaces ? { fontFamily: face, fontWeight: 'normal', fontStyle: 'normal' } : { fontFamily: face, fontWeight: 'normal' };
  return { ...props, style: [props.style, style] };
}

const StyledText = React.forwardRef<any, any>(function StyledText(props, ref) {
  return <OriginalText ref={ref} {...withFace(props)} />;
});
StyledText.displayName = 'Text';

const StyledTextInput = React.forwardRef<any, any>(function StyledTextInput(props, ref) {
  return <OriginalTextInput ref={ref} {...withFace(props)} />;
});
StyledTextInput.displayName = 'TextInput';

let installed = false;

/** Replaces react-native's Text and TextInput exports. Call once, after the fonts loaded (native only). */
export function installTypography(): void {
  if (installed || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    Object.defineProperty(rn, 'Text', { configurable: true, enumerable: true, get: () => StyledText });
    Object.defineProperty(rn, 'TextInput', { configurable: true, enumerable: true, get: () => StyledTextInput });
    installed = true;
  } catch {
    // Could not patch: the app keeps the loaded default face for the screens that name it, and the system font elsewhere.
  }
}
