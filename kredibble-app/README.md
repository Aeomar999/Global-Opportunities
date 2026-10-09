# Kredibble Mobile App

Expo mobile app for Kredibble.

## Get Started

Open terminal and navigate to the mobile app directory:

```bash
cd kredibble-app
```

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

The start script skips Expo's online dependency-version check and starts the local Metro bundler. This avoids `TypeError: fetch failed` when Expo CLI cannot reach Expo's API.

## Run Targets

Android emulator:

```bash
npm run android:windows
```

Web browser:

```bash
npm run web
```

Expo Go on a physical phone:

```bash
npm run start
```

Then scan the QR code from the Expo terminal.

## Useful Commands

```bash
npm run lint
npm run typecheck
npm test
npm run web
npm run start
```

If testing against the backend from a physical phone, the phone cannot use `localhost` for your computer. Use your computer's LAN IP address for API URLs.

## Backend Integration

Login and signup call the versioned backend auth routes:

```text
POST /api/v1/auth/login
POST /api/v1/auth/register
GET  /api/v1/auth/me
```

The mobile API URL is controlled by `EXPO_PUBLIC_API_URL` in `.env`.

- Leave it blank for defaults.
- Android emulator default: `http://10.0.2.2:4000/api/v1`
- Expo web default: `http://localhost:4000/api/v1`
- Physical phone: set it to your computer LAN IP, for example `http://192.168.1.25:4000/api/v1`
- Production: `https://kredibble-api.onrender.com/api/v1` (managed via EAS secrets / `eas.json`)
