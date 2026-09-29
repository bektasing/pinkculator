import type { CapacitorConfig } from '@capacitor/cli';
import { APP_ID, APP_NAME } from './src/app/appInfo.ts';

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: 'dist',
  android: {
    // Harici hiçbir kaynak yok. (WebView uzaktan hata ayıklaması varsayılan olarak sadece debug APK'da açık.)
    allowMixedContent: false,
  },
  plugins: {
    // Uygulama kenardan kenara çizilir; durum çubuğunun arkasında ekranın kendi
    // arka planı görünür (hesap makinesinde krem, menüde toz pembe). İkonlar koyu.
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      initialViewportFitValueHint: 'cover',
    },
    // Açılış ekranı ilk çizim hazır olunca JS'ten kapatılır (bkz. platform/splash.ts).
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: '#FBEDE4',
    },
  },
};

export default config;
