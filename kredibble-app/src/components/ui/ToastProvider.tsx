import React, { createContext, useContext, useState, useRef } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { CheckCircle2, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [translateY] = useState(() => new Animated.Value(-150));
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    
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
      })
    ]).start(() => {
      // Wait 3 seconds, then slide up and fade out
      setTimeout(() => {
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
          })
        ]).start(() => setToast(null));
      }, 3000);
    });
  };

  // Calculate safe top padding. We want it to be below the notch on iOS and the status bar on Android.
  const safeTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) + 10;

  return (
    <ToastContext.Provider value={{ showToast }}>
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
          <View style={styles.toastContent}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={20} color="#16A34A" />
            ) : (
              <Info size={20} color="#6671E4" />
            )}
            <Text style={styles.toastText} className="font-sans">
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
    marginHorizontal: 20, // Add margin to prevent stretching to the very edge on long messages
    justifyContent: 'center',
  },
  toastText: {
    flex: 1, // Let text wrap if it's too long
    fontSize: 12, // Reduced from 14
    fontWeight: '500', // Reduced from 600
    color: '#1A1A1A',
  },
});
