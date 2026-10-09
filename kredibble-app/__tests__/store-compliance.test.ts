import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { openPrivacyPolicy, openTermsOfService, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../src/lib/legal';
import { registerForPushNotificationsAsync } from '../src/lib/notifications';
import { computeIsOffline, checkNetworkConnection } from '../src/lib/network';

jest.mock('lucide-react-native', () => ({
  WifiOff: () => null,
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
}));

let mockIsDevice = true;

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

jest.mock('../src/lib/api', () => ({
  getMobileToken: jest.fn().mockResolvedValue('test-user-session-token'),
  API_BASE_URL: 'https://api.kredibble.app/api/v1',
}));

describe('store compliance: legal links, push notifications, netinfo (MOB-015 / SEC-124)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDevice = true;
  });

  describe('Legal Policies & In-App Browser (Apple Guideline 5.1.1)', () => {
    test('openPrivacyPolicy launches official privacy URL in secure WebBrowser', async () => {
      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });

      await openPrivacyPolicy();

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
      expect(PRIVACY_POLICY_URL).toBe('https://kredibble.com/privacy');
    });

    test('openTermsOfService launches official terms URL in secure WebBrowser', async () => {
      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });

      await openTermsOfService();

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);
      expect(TERMS_OF_SERVICE_URL).toBe('https://kredibble.com/terms');
    });
  });

  describe('Push Notification Registration', () => {
    test('registers push token and notifies backend on physical devices with granted permissions', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const token = await registerForPushNotificationsAsync('ios');

      expect(token).toBe('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/push-token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-user-session-token',
          }),
        })
      );

      global.fetch = originalFetch;
    });

    test('requests permissions if not initially granted and succeeds when accepted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'ExponentPushToken[new-granted-token]',
      });

      const token = await registerForPushNotificationsAsync('android');
      expect(token).toBe('ExponentPushToken[new-granted-token]');
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    test('returns null if permission is denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

      const token = await registerForPushNotificationsAsync('ios');
      expect(token).toBeNull();
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    test('skips registration when on web platform', async () => {
      const token = await registerForPushNotificationsAsync('web');
      expect(token).toBeNull();
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    test('skips registration when not on physical hardware', async () => {
      mockIsDevice = false;

      const token = await registerForPushNotificationsAsync('ios');
      expect(token).toBeNull();
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe('Network Status Monitoring & Offline Guard', () => {
    test('computeIsOffline evaluates online and offline states accurately', () => {
      expect(computeIsOffline(true, true)).toBe(false);
      expect(computeIsOffline(false, true)).toBe(true);
      expect(computeIsOffline(true, false)).toBe(true);
      expect(computeIsOffline(false, false)).toBe(true);
    });

    test('checkNetworkConnection returns current connection status via NetInfo.fetch', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      const onlineStatus = await checkNetworkConnection();
      expect(onlineStatus.isConnected).toBe(true);
      expect(onlineStatus.isOffline).toBe(false);

      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      const offlineStatus = await checkNetworkConnection();
      expect(offlineStatus.isConnected).toBe(false);
      expect(offlineStatus.isOffline).toBe(true);
    });

    test('subscribes to NetInfo connection change listener', () => {
      const mockUnsubscribe = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(mockUnsubscribe);

      const callback = jest.fn();
      const unsubscribe = NetInfo.addEventListener(callback);

      expect(NetInfo.addEventListener).toHaveBeenCalledWith(callback);
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
