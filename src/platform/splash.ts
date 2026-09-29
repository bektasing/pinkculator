import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from './native';

/**
 * Android açılış ekranını, fontlar yüklenip ilk kare çizildikten sonra yumuşakça kapatır
 * (yazılar sistem fontuyla bir an görünüp "zıplamasın"). Tarayıcıda hiçbir şey yapmaz.
 */
export function hideSplashWhenReady(): void {
  if (!isNative) return;
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  // Font yüklemesi takılırsa açılış ekranında kalınmasın.
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  Promise.race([fontsReady, timeout])
    .then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    .then(() => SplashScreen.hide({ fadeOutDuration: 250 }))
    .catch(() => undefined);
}
