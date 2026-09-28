import { Capacitor } from '@capacitor/core';

/** Capacitor içinde (Android APK) mı çalışıyoruz, yoksa geliştirme tarayıcısında mı? */
export const isNative = Capacitor.isNativePlatform();
