import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getMobileToken, API_BASE_URL } from './api';

// Configure notification presentation when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permissions and registers APNs/FCM tokens with backend.
 * Safely handles simulator/emulators, web, and denied permissions.
 */
export async function registerForPushNotificationsAsync(
  targetPlatform: string = Platform.OS
): Promise<string | null> {
  if (targetPlatform === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    // Physical hardware required for APNs/FCM device push tokens
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    // Send token to backend if caller has an active session
    const authToken = await getMobileToken();
    if (authToken && pushToken) {
      await fetch(`${API_BASE_URL}/users/me/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
      }).catch(err => {
        // Backend push endpoint is non-blocking
        console.warn('Backend push token registration failed:', err);
      });
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6671E4',
      });
    }

    return pushToken;
  } catch (error) {
    console.warn('Error configuring push notifications:', error);
    return null;
  }
}
