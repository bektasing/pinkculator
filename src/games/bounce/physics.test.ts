import { describe, expect, it } from 'vitest';
import {
  APEX_RATIO,
  MAX_SPEED_FACTOR,
  clampPaddle,
  createState,
  gravity,
  launchSpeed,
  speedFactor,
  step,
  type BounceState,
  type BounceWorld,
} from './physics';

const DT = 1 / 60;
const world: BounceWorld = { width: 390, height: 844, radius: 24, paddleTop: 740, paddleWidth: 117 };

/** Kalbi çubuğun hemen üstüne, aşağı doğru hareket ederken yerleştirir. */
function aboutToHit(offsetPx: number, hits = 0): BounceState {
  const state = createState(world);
  state.hits = hits;
  state.x = world.width / 2 + offsetPx;
  state.y = world.paddleTop - world.radius - 2;
  state.vy = 400;
  return state;
}

function runUntil(state: BounceState, predicate: (s: BounceState) => boolean, maxSteps = 2000) {
  for (let i = 0; i < maxSteps; i++) {
    const r = step(state, world, DT);
    if (predicate(state)) return { ...r, steps: i + 1 };
  }
  throw new Error('koşul hiç sağlanmadı');
}

describe('Kalp Sektirme fiziği', () => {
  it('kalp yerçekimiyle hızlanarak düşer', () => {
    const state = createState(world);
    step(state, world, DT);
    const v1 = state.vy;
    step(state, world, DT);
    expect(v1).toBeGreaterThan(0);
    expect(state.vy).toBeGreaterThan(v1);
  });

  it('çubuğun ortasına çarpınca düz yukarı fırlar ve skor artar', () => {
    const state = aboutToHit(0);
    const r = step(state, world, DT);
    expect(r.hit).toBe(true);
    expect(state.hits).toBe(1);
    expect(state.vy).toBeLessThan(0);
    expect(Math.abs(state.vx)).toBeLessThan(1);
  });

  it('sağ kenara yakın vuruş sağa, sol kenara yakın vuruş sola açılır', () => {
    const right = aboutToHit(50);
    step(right, world, DT);
    const left = aboutToHit(-50);
    step(left, world, DT);
    expect(right.vx).toBeGreaterThan(50);
    expect(left.vx).toBeLessThan(-50);
    expect(right.vx).toBeCloseTo(-left.vx, 5);
  });

  it('kenara ne kadar yakınsa açı o kadar büyüktür', () => {
    const near = aboutToHit(15);
    step(near, world, DT);
    const far = aboutToHit(55);
    step(far, world, DT);
    expect(far.vx).toBeGreaterThan(near.vx);
  });

  it('dönüş yönü ve hızı yatay hızla ilişkilidir', () => {
    const state = aboutToHit(50);
    step(state, world, DT);
    expect(Math.sign(state.spin)).toBe(Math.sign(state.vx));
    const faster = aboutToHit(58);
    step(faster, world, DT);
    expect(Math.abs(faster.spin)).toBeGreaterThan(Math.abs(state.spin));
  });

  it('vuruştan sonra kalp ekranın üst ~%20 kısmına kadar çıkar', () => {
    for (const hits of [0, 10, 40]) {
      const state = aboutToHit(0, hits);
      step(state, world, DT);
      const apex = runUntil(state, (s) => s.vy >= 0);
      expect(apex.hit).toBe(false);
      const expected = world.height * APEX_RATIO + world.radius;
      expect(Math.abs(state.y - expected)).toBeLessThan(world.height * 0.02);
    }
  });

  it('her vuruşta yerçekimi ve fırlatma hızı birlikte artar', () => {
    expect(gravity(world, 5)).toBeGreaterThan(gravity(world, 0));
    expect(Math.abs(launchSpeed(world, 5))).toBeGreaterThan(Math.abs(launchSpeed(world, 0)));
  });

  it('hızlanmanın bir üst sınırı vardır', () => {
    expect(speedFactor(0)).toBe(1);
    expect(speedFactor(1000)).toBe(MAX_SPEED_FACTOR);
    expect(gravity(world, 1000)).toBe(gravity(world, 500));
  });

  it('en yüksek hızda bile kalp çubuğun içinden geçmez', () => {
    const state = createState(world);
    state.hits = 1000;
    state.x = world.width / 2;
    state.y = world.paddleTop - world.radius - 1;
    state.vy = 5000; // tek adımda ~83 px
    const r = step(state, world, DT);
    expect(r.hit).toBe(true);
    expect(state.y).toBe(world.paddleTop - world.radius);
  });

  it('yukarı çıkarken çubuk yüzeyini geçmek vuruş sayılmaz', () => {
    const state = createState(world);
    state.x = world.width / 2;
    state.y = world.paddleTop - world.radius + 4;
    state.vy = -900;
    const r = step(state, world, DT);
    expect(r.hit).toBe(false);
    expect(state.hits).toBe(0);
  });

  it('yan duvarlardan seker ve ekranın içinde kalır', () => {
    const state = createState(world);
    state.x = world.width - world.radius - 1;
    state.vx = 600;
    const r = step(state, world, DT);
    expect(r.wall).toBe(true);
    expect(state.vx).toBeLessThan(0);
    expect(state.x).toBeLessThanOrEqual(world.width - world.radius);

    state.x = world.radius + 1;
    state.vx = -600;
    step(state, world, DT);
    expect(state.vx).toBeGreaterThan(0);
    expect(state.x).toBeGreaterThanOrEqual(world.radius);
  });

  it('ekranın üstünden kısa süre çıkabilir ama geri gelir', () => {
    const state = createState(world);
    state.y = -50;
    state.vy = -200;
    runUntil(state, (s) => s.y > 0);
    expect(state.y).toBeGreaterThan(0);
  });

  it('çubuğu ıskalayan kalp ekranın altından çıkınca oyun biter', () => {
    const state = createState(world);
    state.targetX = state.paddleX = clampPaddle(world, 0); // çubuk en solda
    state.x = world.width - world.radius - 5; // kalp en sağda
    const r = runUntil(state, (s) => s.y - world.radius > world.height);
    expect(r.lost).toBe(true);
    expect(state.hits).toBe(0);
  });

  it('çubuk parmağı gecikmesiz ama yumuşak takip eder ve ekran dışına çıkmaz', () => {
    const state = createState(world);
    state.targetX = 300;
    step(state, world, DT);
    const firstStep = state.paddleX - world.width / 2;
    expect(firstStep).toBeGreaterThan((300 - world.width / 2) * 0.3); // ilk karede belirgin hareket
    for (let i = 0; i < 12; i++) step(state, world, DT);
    expect(Math.abs(state.paddleX - 300)).toBeLessThan(1); // ~200 ms'de yetişir

    state.targetX = -500;
    for (let i = 0; i < 30; i++) step(state, world, DT);
    expect(state.paddleX).toBeCloseTo(world.paddleWidth / 2, 1);
  });

  it('en yüksek hızda bile oynanabilir: iniş noktasını takip eden oyuncu 150 vuruş kaçırmaz', () => {
    const state = createState(world);
    let steps = 0;
    while (state.hits < 150 && steps < 60 * 60 * 5) {
      // Oyuncu kalbin çubuk hizasına ineceği x'i tahmin eder (duvar yansımalarıyla) ve
      // çubuğu biraz rastgele bir noktayla oraya götürür.
      const g = gravity(world, state.hits);
      const fall = world.paddleTop - world.radius - state.y;
      const t = (-state.vy + Math.sqrt(Math.max(0, state.vy * state.vy + 2 * g * fall))) / g;
      const span = world.width - 2 * world.radius;
      let lx = (state.x - world.radius + state.vx * t) % (2 * span);
      if (lx < 0) lx += 2 * span;
      const landing = world.radius + (lx > span ? 2 * span - lx : lx);
      state.targetX = landing + Math.sin(steps * 0.37) * world.paddleWidth * 0.3;
      const r = step(state, world, DT);
      expect(r.lost).toBe(false);
      steps++;
    }
    expect(state.hits).toBe(150);
  });
});

