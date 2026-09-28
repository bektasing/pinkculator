import { describe, expect, it } from 'vitest';
import { createGameLoop, FIXED_STEP } from './loop';

function manualLoop() {
  const updates: number[] = [];
  const alphas: number[] = [];
  let pending: ((t: number) => void) | null = null;
  let clock = 1000;
  const loop = createGameLoop(
    { update: (dt) => updates.push(dt), render: (alpha) => alphas.push(alpha) },
    {
      now: () => clock,
      requestFrame: (cb) => {
        pending = cb;
        return 1;
      },
      cancelFrame: () => {
        pending = null;
      },
    },
  );
  const advance = (ms: number) => {
    clock += ms;
    const cb = pending;
    pending = null;
    cb?.(clock);
  };
  return { loop, updates, alphas, advance };
}

describe('oyun döngüsü', () => {
  it('güncellemeler her zaman sabit adımla yapılır', () => {
    const { loop, updates, advance } = manualLoop();
    loop.start();
    advance(16.7);
    advance(33.4);
    expect(updates.length).toBe(3);
    expect(updates.every((dt) => dt === FIXED_STEP)).toBe(true);
  });

  it('artan zaman interpolasyon oranı olarak çizime aktarılır', () => {
    const { loop, alphas, advance } = manualLoop();
    loop.start();
    advance(25); // 1 adım + yarım adım
    expect(alphas.at(-1)).toBeCloseTo(0.5, 1);
  });

  it('yavaş karede en fazla 5 güncelleme yapılır ve fazlası atılır', () => {
    const { loop, updates, alphas, advance } = manualLoop();
    loop.start();
    advance(1000);
    expect(updates.length).toBe(5);
    expect(alphas.at(-1)).toBe(0);
  });

  it('durdurulunca güncelleme yapılmaz', () => {
    const { loop, updates, advance } = manualLoop();
    loop.start();
    loop.stop();
    advance(100);
    expect(updates.length).toBe(0);
    expect(loop.running).toBe(false);
  });

  it('duraklatmada geçen süre yeniden başlatınca sayılmaz', () => {
    const { loop, updates, advance } = manualLoop();
    loop.start();
    advance(17);
    loop.stop();
    advance(5000); // uygulama arka planda
    loop.start();
    advance(17);
    expect(updates.length).toBe(2);
  });
});
