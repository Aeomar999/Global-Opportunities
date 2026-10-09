import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Source art is 435 x 151; the three parts are cut from it at these x positions.
const ART_W = 435;
const ART_H = 151;
const LEFT = { x: 0, w: 102 };
const RING = { x: 102, w: 127 };
const RIGHT = { x: 229, w: 206 };

const MOVE_MS = 1100;
const RIGHT_DELAY = 250;
const RING_DELAY = 550;
const GLOW_MS = 1350;
const BLUR = 8;

export const LOGO_INTRO_DURATION = RING_DELAY + GLOW_MS; // 1.9 s

const left = require('../../../assets/images/logo-intro/left.png');
const ring = require('../../../assets/images/logo-intro/ring.png');
const right = require('../../../assets/images/logo-intro/right.png');

const ease = Easing.out(Easing.cubic);

function useReveal(delay: number, duration: number, skip: boolean) {
  const p = useSharedValue(skip ? 1 : 0);
  useEffect(() => {
    if (skip) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: ease }));
  }, [delay, duration, skip, p]);
  return p;
}

export default function LogoIntro() {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const W = Math.min(width - 64, 320);
  const H = (W * ART_H) / ART_W;
  const u = W / ART_W;

  const l = useReveal(0, MOVE_MS, reduced);
  const r = useReveal(RIGHT_DELAY, MOVE_MS, reduced);
  const o = useReveal(RING_DELAY, MOVE_MS, reduced);
  const g = useReveal(RING_DELAY, GLOW_MS, reduced);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: l.value,
    transform: [{ translateX: (1 - l.value) * -16 }],
    filter: [{ blur: (1 - l.value) * BLUR }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: r.value,
    transform: [{ translateX: (1 - r.value) * 16 }],
    filter: [{ blur: (1 - r.value) * BLUR }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: 0.94 + o.value * 0.06 }],
    filter: [{ blur: (1 - o.value) * BLUR }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(g.value, [0, 0.45, 1], [0, 0.5, 0]),
    transform: [{ scale: 1.1 }],
    filter: [{ blur: 10 }],
  }));

  const piece = (p: { x: number; w: number }) => ({
    position: 'absolute' as const,
    left: p.x * u,
    top: 0,
    width: p.w * u,
    height: H,
  });

  return (
    <View
      style={{ width: W, height: H }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Global Opportunity Desk"
    >
      <Animated.Image source={left} style={[piece(LEFT), leftStyle]} resizeMode="stretch" />
      <Animated.Image source={right} style={[piece(RIGHT), rightStyle]} resizeMode="stretch" />
      <Animated.Image source={ring} style={[piece(RING), glowStyle]} resizeMode="stretch" />
      <Animated.Image source={ring} style={[piece(RING), ringStyle]} resizeMode="stretch" />
    </View>
  );
}
