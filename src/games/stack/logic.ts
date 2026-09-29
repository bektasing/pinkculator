/**
 * Kalp Kulesi mantığı — çizimden ve DOM'dan bağımsız, saf ve test edilebilir.
 *
 * Koordinatlar CSS pikseli; x soldan sağa. Katlar `level` ile tutulur (0 = zemin),
 * dikey konum sahnede `level × blockHeight` olarak türetilir.
 * - Kayan blok bir üst kattır ve her zaman kulenin tepe bloğuyla aynı genişliktedir.
 * - Dokununca tepe blokla örtüşen kısım kalır, taşan kısım kesilip düşer.
 * - Fark `perfectTolerance` içindeyse blok tam hizaya oturur (mükemmel); üst üste
 *   3 ve daha fazla mükemmelde blok biraz genişler (başlangıç genişliğini aşmadan).
 */

export interface StackWorld {
  width: number;
  blockHeight: number;
  /** Zemin ve ilk blok genişliği; genişleme bunu aşamaz */
  baseWidth: number;
  perfectTolerance: number;
}

export interface Block {
  /** Sol kenar */
  x: number;
  width: number;
  level: number;
}

export interface Moving extends Block {
  dir: 1 | -1;
}

export interface StackState {
  /** blocks[i].level === i; blocks[0] zemin */
  blocks: Block[];
  moving: Moving | null;
  /** Üst üste mükemmel yerleştirme sayısı */
  combo: number;
  over: boolean;
}

export type PlaceResult =
  | { kind: 'perfect'; block: Block; combo: number; grew: boolean }
  | { kind: 'cut'; block: Block; piece: Block }
  | { kind: 'miss'; piece: Block };

export const BASE_WIDTH_RATIO = 0.56;
/** Mükemmel yerleştirme eşiği (≈ 5dp) */
export const PERFECT_TOLERANCE_PX = 5;
/** Bu kombodan itibaren her mükemmelde blok genişler */
export const COMBO_GROW_FROM = 3;
/** Genişleme miktarı: başlangıç genişliğinin bu oranı */
export const COMBO_GROW_RATIO = 0.06;
/** Bundan dar örtüşme ıska sayılır (görünmez kadar ince kat olmasın) */
export const MIN_OVERLAP_PX = 2;
/** Kayma hızı: ekran genişliği × bu değer (px/s) */
const BASE_SPEED_PER_WIDTH = 0.55;
export const SPEEDUP_PER_LEVEL = 0.03;
export const MAX_SPEED_FACTOR = 1.9;
/** Blok merkezinin gidip geldiği aralığın yarı genişliği (ekran genişliği oranı) */
const TRAVEL_RATIO = 0.45;

export function createWorld(width: number, blockHeight: number): StackWorld {
  return {
    width,
    blockHeight,
    baseWidth: width * BASE_WIDTH_RATIO,
    perfectTolerance: PERFECT_TOLERANCE_PX,
  };
}

export function createState(world: StackWorld): StackState {
  return {
    blocks: [{ x: (world.width - world.baseWidth) / 2, width: world.baseWidth, level: 0 }],
    moving: null,
    combo: 0,
    over: false,
  };
}

export function topBlock(state: StackState): Block {
  return state.blocks[state.blocks.length - 1] as Block;
}

/** Skor = zeminin üstüne konulan kat sayısı */
export function score(state: StackState): number {
  return state.blocks.length - 1;
}

export function speedFactor(level: number): number {
  return Math.min(1 + Math.max(0, level - 1) * SPEEDUP_PER_LEVEL, MAX_SPEED_FACTOR);
}

export function slideSpeed(world: StackWorld, level: number): number {
  return world.width * BASE_SPEED_PER_WIDTH * speedFactor(level);
}

/** Kayan blok merkezinin dönüş noktaları */
export function travelBounds(world: StackWorld): [number, number] {
  const half = world.width * TRAVEL_RATIO;
  return [world.width / 2 - half, world.width / 2 + half];
}

/** Yeni kayan blok: tek katlar soldan, çift katlar sağdan, ekranın hemen dışından girer. */
export function spawnMoving(state: StackState, world: StackWorld): Moving {
  const top = topBlock(state);
  const level = top.level + 1;
  const fromLeft = level % 2 === 1;
  const x = fromLeft ? -top.width : world.width;
  const moving: Moving = { x, width: top.width, level, dir: fromLeft ? 1 : -1 };
  state.moving = moving;
  return moving;
}

/** Kayan bloğu ilerletir; dönüş noktasını geçerse geri yansır. */
export function advanceMoving(state: StackState, world: StackWorld, dt: number): void {
  const m = state.moving;
  if (!m) return;
  const [min, max] = travelBounds(world);
  m.x += m.dir * slideSpeed(world, m.level) * dt;
  const center = m.x + m.width / 2;
  if (m.dir > 0 && center > max) {
    m.x -= 2 * (center - max);
    m.dir = -1;
  } else if (m.dir < 0 && center < min) {
    m.x += 2 * (min - center);
    m.dir = 1;
  }
}

/** Kayan bloğu olduğu yerde bırakır. Kayan blok yoksa veya oyun bittiyse null. */
export function place(state: StackState, world: StackWorld): PlaceResult | null {
  const m = state.moving;
  if (!m || state.over) return null;
  state.moving = null;
  const top = topBlock(state);
  const delta = m.x - top.x;

  if (Math.abs(delta) <= world.perfectTolerance) {
    state.combo += 1;
    let { x, width } = top;
    let grew = false;
    if (state.combo >= COMBO_GROW_FROM && width < world.baseWidth) {
      const next = Math.min(world.baseWidth, width + world.baseWidth * COMBO_GROW_RATIO);
      x -= (next - width) / 2;
      width = next;
      grew = true;
    }
    const block: Block = { x, width, level: m.level };
    state.blocks.push(block);
    return { kind: 'perfect', block, combo: state.combo, grew };
  }

  state.combo = 0;
  const left = Math.max(m.x, top.x);
  const right = Math.min(m.x + m.width, top.x + top.width);
  const overlap = right - left;
  if (overlap < MIN_OVERLAP_PX) {
    state.over = true;
    return { kind: 'miss', piece: { x: m.x, width: m.width, level: m.level } };
  }

  const block: Block = { x: left, width: overlap, level: m.level };
  state.blocks.push(block);
  const piece: Block =
    delta > 0
      ? { x: right, width: m.x + m.width - right, level: m.level }
      : { x: m.x, width: left - m.x, level: m.level };
  return { kind: 'cut', block, piece };
}

/** Ekran genişliği değişirse (nadiren) yatay değerleri orantılı taşır. */
export function rescale(state: StackState, world: StackWorld, width: number, blockHeight: number): void {
  const k = width / world.width;
  for (const b of state.blocks) {
    b.x *= k;
    b.width *= k;
  }
  if (state.moving) {
    state.moving.x *= k;
    state.moving.width *= k;
  }
  world.width = width;
  world.blockHeight = blockHeight;
  world.baseWidth = width * BASE_WIDTH_RATIO;
}
