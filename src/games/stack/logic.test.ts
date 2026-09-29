import { describe, expect, it } from 'vitest';
import {
  COMBO_GROW_FROM,
  COMBO_GROW_RATIO,
  MAX_SPEED_FACTOR,
  MIN_OVERLAP_PX,
  advanceMoving,
  createState,
  createWorld,
  place,
  rescale,
  score,
  slideSpeed,
  spawnMoving,
  speedFactor,
  topBlock,
  travelBounds,
  type StackState,
} from './logic';

const DT = 1 / 60;
const world = createWorld(390, 56);

/** Kayan bloğu tepe bloğa göre `offset` px kaydırılmış olarak hazırlar. */
function withMovingAt(state: StackState, offset: number) {
  const moving = spawnMoving(state, world);
  moving.x = topBlock(state).x + offset;
  return moving;
}

describe('başlangıç', () => {
  it('zemin ortada, başlangıç genişliğinde; skor 0', () => {
    const state = createState(world);
    expect(state.blocks).toHaveLength(1);
    const ground = topBlock(state);
    expect(ground.width).toBeCloseTo(world.baseWidth);
    expect(ground.x + ground.width / 2).toBeCloseTo(world.width / 2);
    expect(score(state)).toBe(0);
    expect(state.moving).toBeNull();
  });

  it('kayan blok yoksa place null döner', () => {
    expect(place(createState(world), world)).toBeNull();
  });
});

describe('kayan blok', () => {
  it('tek katlar soldan, çift katlar sağdan ekranın dışından gelir', () => {
    const state = createState(world);
    const first = spawnMoving(state, world);
    expect(first.level).toBe(1);
    expect(first.dir).toBe(1);
    expect(first.x + first.width).toBeLessThanOrEqual(0);

    withMovingAt(state, 0);
    place(state, world);
    const second = spawnMoving(state, world);
    expect(second.level).toBe(2);
    expect(second.dir).toBe(-1);
    expect(second.x).toBeGreaterThanOrEqual(world.width);
  });

  it('tepe blokla aynı genişlikte doğar', () => {
    const state = createState(world);
    withMovingAt(state, 40);
    place(state, world);
    expect(spawnMoving(state, world).width).toBeCloseTo(topBlock(state).width);
  });

  it('içeri girer ve dönüş noktalarında yön değiştirerek aralıkta kalır', () => {
    const state = createState(world);
    spawnMoving(state, world);
    const [min, max] = travelBounds(world);
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 8; i++) {
      advanceMoving(state, world, DT);
      const m = state.moving!;
      seen.add(m.dir);
      if (i > 60 * 2) {
        const center = m.x + m.width / 2;
        expect(center).toBeGreaterThanOrEqual(min - 1e-6);
        expect(center).toBeLessThanOrEqual(max + 1e-6);
      }
    }
    expect(seen).toEqual(new Set([1, -1]));
  });

  it('hız katlarla artar ama üst sınırı aşmaz', () => {
    expect(speedFactor(1)).toBe(1);
    expect(speedFactor(10)).toBeGreaterThan(speedFactor(5));
    expect(speedFactor(1000)).toBe(MAX_SPEED_FACTOR);
    expect(slideSpeed(world, 1000)).toBeCloseTo(slideSpeed(world, 1) * MAX_SPEED_FACTOR);
  });
});

describe('yerleştirme', () => {
  it('sağa taşan kısım kesilir; kalan kısım örtüşme kadar', () => {
    const state = createState(world);
    const ground = topBlock(state);
    withMovingAt(state, 30);
    const r = place(state, world);
    expect(r?.kind).toBe('cut');
    if (r?.kind !== 'cut') return;
    expect(r.block.x).toBeCloseTo(ground.x + 30);
    expect(r.block.width).toBeCloseTo(ground.width - 30);
    expect(r.piece.x).toBeCloseTo(ground.x + ground.width);
    expect(r.piece.width).toBeCloseTo(30);
    expect(score(state)).toBe(1);
  });

  it('sola taşan kısım kesilir', () => {
    const state = createState(world);
    const ground = topBlock(state);
    withMovingAt(state, -45);
    const r = place(state, world);
    if (r?.kind !== 'cut') throw new Error('cut bekleniyordu');
    expect(r.block.x).toBeCloseTo(ground.x);
    expect(r.block.width).toBeCloseTo(ground.width - 45);
    expect(r.piece.x).toBeCloseTo(ground.x - 45);
    expect(r.piece.width).toBeCloseTo(45);
  });

  it('kalan kısım + kesilen parça = kayan bloğun genişliği', () => {
    const state = createState(world);
    const moving = withMovingAt(state, 17.5);
    const r = place(state, world);
    if (r?.kind !== 'cut') throw new Error('cut bekleniyordu');
    expect(r.block.width + r.piece.width).toBeCloseTo(moving.width);
  });

  it('fark ≤ 5px ise mükemmel: tam hizaya oturur, kesilme olmaz', () => {
    for (const offset of [0, 3, -5, 5]) {
      const state = createState(world);
      const ground = topBlock(state);
      withMovingAt(state, offset);
      const r = place(state, world);
      expect(r?.kind).toBe('perfect');
      expect(topBlock(state).x).toBeCloseTo(ground.x);
      expect(topBlock(state).width).toBeCloseTo(ground.width);
    }
  });

  it('5px\'in hemen üstü mükemmel sayılmaz', () => {
    const state = createState(world);
    withMovingAt(state, 5.5);
    expect(place(state, world)?.kind).toBe('cut');
  });

  it('hiç örtüşme yoksa ıska: oyun biter, skor artmaz, blok bütün olarak düşer', () => {
    const state = createState(world);
    const moving = withMovingAt(state, world.baseWidth + 10);
    const r = place(state, world);
    expect(r?.kind).toBe('miss');
    if (r?.kind !== 'miss') return;
    expect(r.piece.width).toBeCloseTo(moving.width);
    expect(state.over).toBe(true);
    expect(score(state)).toBe(0);
    expect(place(state, world)).toBeNull();
  });

  it('görünmeyecek kadar ince örtüşme de ıska sayılır', () => {
    const state = createState(world);
    withMovingAt(state, world.baseWidth - MIN_OVERLAP_PX / 2);
    expect(place(state, world)?.kind).toBe('miss');
  });
});

describe('kombo', () => {
  it('üst üste mükemmeller komboyu artırır, kesilme sıfırlar', () => {
    const state = createState(world);
    for (let i = 1; i <= 2; i++) {
      withMovingAt(state, 0);
      const r = place(state, world);
      expect(r?.kind === 'perfect' && r.combo).toBe(i);
    }
    withMovingAt(state, 20);
    place(state, world);
    expect(state.combo).toBe(0);
    withMovingAt(state, 0);
    const r = place(state, world);
    expect(r?.kind === 'perfect' && r.combo).toBe(1);
  });

  it(`${COMBO_GROW_FROM}. komboda blok ortadan genişler`, () => {
    const state = createState(world);
    withMovingAt(state, 60); // daralt
    place(state, world);
    const narrow = topBlock(state);
    const narrowCenter = narrow.x + narrow.width / 2;
    for (let i = 1; i < COMBO_GROW_FROM; i++) {
      withMovingAt(state, 0);
      const r = place(state, world);
      expect(r?.kind === 'perfect' && r.grew).toBe(false);
    }
    withMovingAt(state, 0);
    const r = place(state, world);
    expect(r?.kind === 'perfect' && r.grew).toBe(true);
    const grown = topBlock(state);
    expect(grown.width).toBeCloseTo(narrow.width + world.baseWidth * COMBO_GROW_RATIO);
    expect(grown.x + grown.width / 2).toBeCloseTo(narrowCenter);
  });

  it('genişleme başlangıç genişliğini asla aşmaz', () => {
    const state = createState(world);
    withMovingAt(state, 4.9); // mükemmel, tam genişlik
    for (let i = 0; i < 20; i++) {
      withMovingAt(state, 0);
      place(state, world);
      expect(topBlock(state).width).toBeLessThanOrEqual(world.baseWidth + 1e-9);
    }
  });
});

describe('ölçek', () => {
  it('genişlik değişince bloklar orantılı taşınır', () => {
    const state = createState(world);
    const w = { ...world };
    withMovingAt(state, 30);
    place(state, w);
    const before = { ...topBlock(state) };
    rescale(state, w, 780, 112);
    expect(topBlock(state).x).toBeCloseTo(before.x * 2);
    expect(topBlock(state).width).toBeCloseTo(before.width * 2);
    expect(w.baseWidth).toBeCloseTo(world.baseWidth * 2);
  });
});
