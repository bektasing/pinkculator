import { App } from '@capacitor/app';
import { isNative } from './native';

/**
 * Android geri tuşu yönetimi. Ekranlar bir işleyici kaydeder; en son kaydedilen
 * işleyici önce çağrılır. İşleyici `true` dönerse olay tüketilmiş sayılır.
 * Hiçbir işleyici tüketmezse uygulama arka plana alınır.
 */
export type BackHandler = () => boolean;

const handlers: BackHandler[] = [];
let installed = false;

export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  };
}

function dispatchBack(): void {
  for (let i = handlers.length - 1; i >= 0; i--) {
    const handler = handlers[i];
    if (handler && handler()) return;
  }
  App.minimizeApp().catch(() => undefined);
}

export function installBackButton(): void {
  if (installed || !isNative) return;
  installed = true;
  App.addListener('backButton', dispatchBack).catch(() => undefined);
}
