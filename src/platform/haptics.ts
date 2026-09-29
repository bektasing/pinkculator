import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './native';

// Titreşim sarmalayıcısı. Çağrılar bilerek beklenmez (fire-and-forget):
// dokunuşun görsel tepkisi titreşim köprüsünü asla beklememeli.
// Tarayıcıda navigator.vibrate varsa kullanılır, yoksa hiçbir şey yapılmaz.

function webVibrate(pattern: number | number[]): void {
  try {
    // Kullanıcı sayfaya hiç dokunmadıysa tarayıcı titreşimi engeller ve konsola uyarı yazar.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    // yok say
  }
}

function ignore(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}

export function impactLight(): void {
  if (isNative) ignore(Haptics.impact({ style: ImpactStyle.Light }));
  else webVibrate(8);
}

export function impactMedium(): void {
  if (isNative) ignore(Haptics.impact({ style: ImpactStyle.Medium }));
  else webVibrate(16);
}

export function impactHeavy(): void {
  if (isNative) ignore(Haptics.impact({ style: ImpactStyle.Heavy }));
  else webVibrate(28);
}

export function notifySuccess(): void {
  if (isNative) ignore(Haptics.notification({ type: NotificationType.Success }));
  else webVibrate([14, 60, 22]);
}

export function notifyError(): void {
  if (isNative) ignore(Haptics.notification({ type: NotificationType.Error }));
  else webVibrate([30, 50, 30, 50, 30]);
}
