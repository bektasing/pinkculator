import { drawHeart } from '../effects/heartSprite';
import { BURSTS, HEART_PALETTE, HeartParticles } from '../effects/particles';
import { prefersReducedMotion } from '../effects/reducedMotion';

/**
 * Gizli ekranın kalpleri: kenarlarda hafifçe "nefes alan" sabit kalpler ve alttan
 * yavaşça süzülen kalpler. Uygulamanın ortak kalp çizimi ve parçacık sistemi kullanılır.
 */

interface StaticHeart {
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  alpha: number;
  phase: number;
}

/** Her açılışta aynı yerleşim (rastgele ama sabit tohumlu) */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STATIC_COUNT = 18;

/** Sabit kalplerin girmeyeceği alan (fotoğraf + yazı), canvas koordinatlarında */
export interface KeepOut {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function layoutHearts(width: number, height: number, keepOut: KeepOut | null): StaticHeart[] {
  const random = seeded(29062023);
  const hearts: StaticHeart[] = [];
  const scale = Math.min(width / 390, 1.2);
  for (let attempt = 0; hearts.length < STATIC_COUNT && attempt < 600; attempt++) {
    const size = (18 + random() * 38) * scale;
    const x = size / 2 + random() * (width - size);
    const y = size / 2 + random() * (height - size);
    const r = size * 0.55;
    const covered = keepOut
      ? x + r > keepOut.left && x - r < keepOut.right && y + r > keepOut.top && y - r < keepOut.bottom
      : y > height * 0.36 && y < height * 0.64;
    if (covered) continue;
    // Birbirine çok yakın durmasınlar
    if (hearts.some((h) => Math.hypot(h.x - x, h.y - y) < (h.size + size) * 0.75)) continue;
    hearts.push({
      x,
      y,
      size,
      color: HEART_PALETTE[Math.floor(random() * HEART_PALETTE.length)] ?? HEART_PALETTE[0],
      rotation: (random() - 0.5) * 0.7,
      alpha: 0.55 + random() * 0.4,
      phase: random() * Math.PI * 2,
    });
  }
  return hearts;
}

export interface LoveScene {
  resize: (width: number, height: number) => void;
  update: (dt: number) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
  dispose: () => void;
}

/** `keepOut`: fotoğraf ve yazının kapladığı alan (her yerleşimde sorulur) */
export function createLoveScene(keepOut: () => KeepOut | null = () => null): LoveScene {
  const particles = new HeartParticles();
  let width = 1;
  let height = 1;
  let hearts: StaticHeart[] = [];
  let time = 0;
  let spawnIn = 0;
  let seededFloat = false;
  const reduced = prefersReducedMotion();
  const spawnEvery = reduced ? 0.9 : 0.32;

  const spawn = (y: number) => particles.burst(width * (0.06 + Math.random() * 0.88), y, BURSTS.float);

  return {
    resize(w, h) {
      width = w;
      height = h;
      hearts = layoutHearts(w, h, keepOut());
      if (!seededFloat) {
        // Açılışta ekran boş görünmesin: birkaç kalp zaten yolda olsun.
        seededFloat = true;
        for (let i = 0; i < (reduced ? 3 : 7); i++) spawn(height * (0.45 + Math.random() * 0.6));
      }
    },
    update(dt) {
      time += dt;
      particles.update(dt);
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = spawnEvery * (0.6 + Math.random() * 0.8);
        spawn(height + 24);
      }
    },
    render(ctx) {
      for (const h of hearts) {
        const breathe = reduced ? 1 : 1 + Math.sin(time * 1.6 + h.phase) * 0.045;
        const sway = reduced ? 0 : Math.sin(time * 0.9 + h.phase) * 0.06;
        drawHeart(ctx, h.x, h.y, h.size * breathe, h.color, h.rotation + sway, h.alpha);
      }
      particles.draw(ctx);
    },
    dispose() {
      particles.clear();
    },
  };
}
