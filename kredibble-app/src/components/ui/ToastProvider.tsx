import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/design';

type ToastType = 'success' | 'info' | 'error';

interface ToastOptions {
  /** How long the message stays on screen, in milliseconds (default 3000). */
  duration?: number;
  /** Use a card shape instead of a pill, for messages longer than a line or two. */
  multiline?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastState {
  message: string;
  type: ToastType;
  multiline: boolean;
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [translateY] = useState(() => new Animated.Value(-150));
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message: string, type: ToastType = 'success', options: ToastOptions = {}) => {
    // A new message replaces the one on screen instead of stacking timers on top of it.
    if (hideTimer.current) clearTimeout(hideTimer.current);
    translateY.stopAnimation();
    opacity.stopAnimation();
    setToast({ message, type, multiline: Boolean(options.multiline) });

    // Slide down and fade in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 4,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Wait, then slide up and fade out
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    }, options.duration ?? 3000);
  }, [translateY, opacity]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  // Calculate safe top padding. We want it to be below the notch on iOS and the status bar on Android.
  const safeTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) + 10;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              transform: [{ translateY }],
              opacity,
              paddingTop: safeTopPadding,
            }
          ]}
          pointerEvents="none"
        >
          <View style={[styles.toastContent, toast.multiline && styles.toastContentMultiline]}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} color={Colors.successDot} />
            ) : toast.type === 'error' ? (
              <XCircle size={20} color={Colors.errorDot} />
            ) : (
              <Info size={20} color={Colors.primary} />
            )}
            <Text style={[styles.toastText, toast.multiline && styles.toastTextMultiline]} className="font-sans">
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 100,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
    marginHorizontal: 20, // Add margin to prevent stretching to the very edge on long messages
    justifyContent: 'center',
  },
  toastContentMultiline: {
    alignItems: 'flex-start',
    borderRadius: 16,
    paddingVertical: 16,
  },
  toastText: {
    flex: 1, // Let text wrap if it's too long
    fontSize: 12, // Reduced from 14
    fontWeight: '500', // Reduced from 600
    color: Colors.textBody,
  },
  toastTextMultiline: {
    fontSize: 13,
    lineHeight: 19,
  },
});
