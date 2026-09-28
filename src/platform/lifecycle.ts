import { App } from '@capacitor/app';
import { isNative } from './native';

/**
 * Uygulama arka plana gidince / geri gelince haber verir.
 * Android'de Capacitor `pause`/`resume`, her yerde `visibilitychange` dinlenir;
 * aynı geçiş iki kez bildirilmez.
 */
type Listener = () => void;

const pauseListeners = new Set<Listener>();
const resumeListeners = new Set<Listener>();
let hidden = typeof document !== 'undefined' ? document.hidden : false;
let installed = false;

function emitPause(): void {
  if (hidden) return;
  hidden = true;
  pauseListeners.forEach((listener) => listener());
}

function emitResume(): void {
  if (!hidden) return;
  hidden = false;
  resumeListeners.forEach((listener) => listener());
}

function install(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('visibilitychange', () => (document.hidden ? emitPause() : emitResume()));
  window.addEventListener('pagehide', emitPause);
  if (isNative) {
    App.addListener('pause', emitPause).catch(() => undefined);
    App.addListener('resume', emitResume).catch(() => undefined);
  }
}

export function onAppPause(listener: Listener): () => void {
  install();
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

export function onAppResume(listener: Listener): () => void {
  install();
  resumeListeners.add(listener);
  return () => resumeListeners.delete(listener);
}
