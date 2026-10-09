/**
 * BrushHighlight: an orange, rough-edged "brush stroke" drawn behind a word (used on onboarding 1 for "Global").
 *
 * Props:
 *   - children: the word (a <Text>); it is drawn on top of the stroke.
 *   - color: stroke colour (default Colors.accent500, the single orange accent).
 *
 * Accessibility: white text on #FC5E24 is 3.10:1, so it only meets AA for large text (36 px bold qualifies).
 * Do not use this behind small body text.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../constants/design';

// Irregular outline in a 100 x 40 box; stretched to the size of the word (preserveAspectRatio="none").
const BRUSH_PATH =
  'M2 7 L7 3 L16 5 L30 2 L47 4 L63 2 L80 4 L93 2 L98 5 L99 11 L97 17 L99 24 L97 31 L99 37 ' +
  'L91 38 L78 36 L62 39 L46 37 L31 39 L16 37 L6 39 L1 35 L3 28 L1 21 L3 14 L1 9 Z';

export interface BrushHighlightProps {
  children: React.ReactNode;
  color?: string;
}

export function BrushHighlight({ children, color = Colors.accent500 }: BrushHighlightProps) {
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginLeft: -10, paddingHorizontal: 10 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <Path d={BRUSH_PATH} fill={color} />
        </Svg>
      </View>
      {children}
    </View>
  );
}
