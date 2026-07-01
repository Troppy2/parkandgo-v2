import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.parkandgo.umn',
  appName: 'Park & Go',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#7A0019',
      showSpinner: false,
    },
    Geolocation: {
      permissions: ['location'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#7A0019',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // serverClientId is the Web OAuth client ID from Google Cloud Console.
      // The value is set at runtime via GoogleAuth.initialize() using VITE_GOOGLE_CLIENT_ID.
      // Fill this in as a static fallback after creating the Web OAuth client:
      // serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
