import { Preferences } from '@capacitor/preferences';
import { isNative } from './native';

// Kalıcı anahtar-değer deposu. Android'de Capacitor Preferences,
// tarayıcıda localStorage kullanır. Hiçbir çağrı hata fırlatmaz.

const PREFIX = 'pinkculator:';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: PREFIX + key });
      return value;
    }
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isNative) {
      await Preferences.set({ key: PREFIX + key, value });
      return;
    }
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Depolama yazılamıyorsa (ör. gizli sekme) sessizce geç.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (isNative) {
      await Preferences.remove({ key: PREFIX + key });
      return;
    }
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // yok say
  }
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}
