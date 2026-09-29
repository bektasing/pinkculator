import type { SecretEntry } from '../calculator/secretCode';
import type { GameId } from '../games/shared/types';

export type { GameId };

export interface Point {
  x: number;
  y: number;
}

/**
 * Hesap makinesi her zaman altta açıktır; menü onun, oyun da menünün üstünde açılır.
 * `origin`: menünün açıldığı nokta (kalp), `gameOrigin`: oyunun açıldığı nokta (kart).
 */
export type Screen =
  | { name: 'calculator' }
  | { name: 'menu'; origin: Point }
  | { name: 'game'; id: GameId; origin: Point; gameOrigin: Point }
  /** Gizli tarih ekranı (bkz. calculator/secretCode.ts); mesaj açılışta bir kez seçilir */
  | { name: 'love'; origin: Point; entry: SecretEntry; message: string };
