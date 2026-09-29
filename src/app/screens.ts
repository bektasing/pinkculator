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
  /** Gizli tarih ekranı (bkz. calculator/secretCode.ts) */
  | { name: 'love'; origin: Point };
