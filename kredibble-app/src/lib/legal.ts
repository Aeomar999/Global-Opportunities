import * as WebBrowser from 'expo-web-browser';

export const PRIVACY_POLICY_URL = 'https://kredibble.com/privacy';
export const TERMS_OF_SERVICE_URL = 'https://kredibble.com/terms';

/**
 * Opens Kredibble Privacy Policy in an in-app browser overlay.
 * Satisfies Apple App Store Guideline 5.1.1 and Google Play Policy.
 */
export async function openPrivacyPolicy(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  } catch (error) {
    console.warn('Failed to open privacy policy:', error);
  }
}

/**
 * Opens Kredibble Terms of Service in an in-app browser overlay.
 */
export async function openTermsOfService(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
  } catch (error) {
    console.warn('Failed to open terms of service:', error);
  }
}
