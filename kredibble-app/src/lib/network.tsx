import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOffline: boolean;
}

/**
 * Pure evaluation of offline state based on netinfo connectivity and reachability flags.
 */
export function computeIsOffline(isConnected: boolean | null, isInternetReachable: boolean | null): boolean {
  return isConnected === false || isInternetReachable === false;
}

/**
 * Direct async check for current network connectivity.
 */
export async function checkNetworkConnection(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();
  const isConnected = state.isConnected ?? true;
  const isInternetReachable = state.isInternetReachable ?? true;
  return {
    isConnected,
    isInternetReachable,
    isOffline: computeIsOffline(isConnected, isInternetReachable),
  };
}

/**
 * Hook to observe network connectivity using @react-native-community/netinfo.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isOffline = computeIsOffline(isConnected, isInternetReachable);

  return { isConnected, isInternetReachable, isOffline };
}

/**
 * Top offline banner informing user of connectivity status and pending offline sync.
 */
export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <WifiOff size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.text} className="font-sans">
        You are currently offline. Some features may be unavailable.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
