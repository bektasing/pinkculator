export type GameId = 'bounce' | 'merge' | 'stack';

export interface Point {
  x: number;
  y: number;
}

/** Hesap makinesi her zaman altta açıktır; menü ve oyunlar onun üstünde açılır. */
export type Screen =
  | { name: 'calculator' }
  | { name: 'menu'; origin: Point }
  | { name: 'game'; id: GameId; origin: Point };
