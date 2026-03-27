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
  },
};

export default config;
