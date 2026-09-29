import { drawHeart } from './heartSprite';
import { prefersReducedMotion } from './reducedMotion';

/**
 * Kalp parçacık sistemi. DOM elemanı oluşturmaz; tek bir canvas'a çizilir.
 * Parçacık nesneleri havuzdan yeniden kullanılır (çöp toplayıcı baskısı olmasın).
 */

export const HEART_PALETTE = ['#f5cccb', '#f2b8ba', '#eba3a8', '#e4939a', '#d8868e', '#c9777f'] as const;

export interface BurstConfig {
  count: [number, number];
  /** Ana yön (radyan); varsayılan yukarı (−π/2) */
  direction?: number;
  size: [number, number];
  /** Yukarı yönden (−π/2) sapma açısı; π = her yöne */
  spread: number;
  speed: [number, number];
  /** Ömür (ms) */
  life: [number, number];
  /** Dikey ivme (px/s²); negatif değer yukarı süzülme */
  gravity: number;
  /** Hız sönümü (1/s) */
  drag: number;
  /** Salınım genliği (px) */
  sway: [number, number];
  /** Dönüş hızı (rad/s) */
  spin: number;
}

export const BURSTS = {
  /** Her tuş basışı: parmaktan 2–4 küçük kalp */
  tap: {
    count: [2, 4],
    size: [12, 24],
    spread: 0.75,
    speed: [80, 170],
    life: [800, 1000],
    gravity: -70,
    drag: 1.6,
    sway: [5, 11],
    spin: 2.2,
  },
  /** = tuşu: daha büyük patlama */
  equals: {
    count: [10, 14],
    size: [12, 26],
    spread: 1.35,
    speed: [170, 340],
    life: [900, 1150],
    gravity: -50,
    drag: 2.2,
    sway: [6, 12],
    spin: 2.6,
  },
  /** Gizli menü açılışı: ekranı kaplayan patlama */
  grand: {
    count: [72, 84],
    size: [16, 46],
    spread: Math.PI,
    speed: [450, 1550],
    life: [1300, 1700],
    gravity: -40,
    drag: 2.2,
    sway: [8, 18],
    spin: 3,
  },
  /** Yeni rekor: ekranın üstünden yağan kalpler (tek tek, sürekli yayılır) */
  rain: {
    count: [1, 1],
    direction: Math.PI / 2,
    size: [14, 34],
    spread: 0.35,
    speed: [40, 140],
    life: [2600, 3400],
    gravity: 160,
    drag: 0.9,
    sway: [10, 24],
    spin: 1.6,
  },
  /** Oyun içi küçük vuruş/birleşme patlaması */
  pop: {
    count: [3, 4],
    size: [10, 20],
    spread: 1.1,
    speed: [90, 190],
    life: [650, 850],
    gravity: -40,
    drag: 2,
    sway: [4, 9],
    spin: 2.4,
  },
  /** Halka şeklinde patlama (mükemmel yerleştirme vb.) */
  ring: {
    count: [12, 14],
    size: [12, 22],
    spread: Math.PI,
    speed: [150, 240],
    life: [700, 900],
    gravity: -20,
    drag: 2.6,
    sway: [2, 5],
    spin: 2,
  },
  /** Gizli ekran: aşağıdan yavaşça süzülen tek kalp */
  float: {
    count: [1, 1],
    size: [14, 34],
    spread: 0.12,
    speed: [70, 130],
    life: [5200, 7400],
    gravity: -6,
    drag: 0.05,
    sway: [10, 22],
    spin: 0.5,
  },
} satisfies Record<string, BurstConfig>;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
  age: number;
  life: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  gravity: number;
  drag: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const easeInQuad = (t: number) => t * t;

const POP_IN_MS = 140;

export class HeartParticles {
  private items: Particle[] = [];
  private pool: Particle[] = [];
  /** Yeni parçacık eklenince çağrılır (boşta duran çizim döngüsünü uyandırmak için) */
  onWake: (() => void) | null = null;

  get count(): number {
    return this.items.length;
  }

  burst(x: number, y: number, config: BurstConfig): void {
    const reduced = prefersReducedMotion();
    let count = Math.round(rand(config.count[0], config.count[1] + 0.999) - 0.5);
    if (reduced) count = Math.max(1, Math.ceil(count / 3));
    const motionScale = reduced ? 0.6 : 1;

    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() ?? ({} as Particle);
      const angle = (config.direction ?? -Math.PI / 2) + rand(-config.spread, config.spread);
      const speed = rand(config.speed[0], config.speed[1]) * motionScale;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.rotation = rand(-0.45, 0.45);
      p.spin = rand(-config.spin, config.spin) * motionScale;
      p.size = rand(config.size[0], config.size[1]);
      p.color = HEART_PALETTE[Math.floor(Math.random() * HEART_PALETTE.length)] ?? HEART_PALETTE[0];
      p.age = 0;
      p.life = rand(config.life[0], config.life[1]);
      p.swayAmp = rand(config.sway[0], config.sway[1]) * (reduced ? 0.3 : 1);
      p.swayFreq = rand(5, 8);
      p.phase = rand(0, Math.PI * 2);
      p.gravity = config.gravity;
      p.drag = config.drag;
      this.items.push(p);
    }
    this.onWake?.();
  }

  /** dt saniye cinsinden. Canlı parçacık kaldıysa true döner. */
  update(dt: number): boolean {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i] as Particle;
      p.age += dt * 1000;
      if (p.age >= p.life) {
        items[i] = items[items.length - 1] as Particle;
        items.pop();
        this.pool.push(p);
        continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy = p.vy * damping + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }
    return items.length > 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const progress = p.age / p.life;
      const t = p.age / 1000;
      const popIn = p.age < POP_IN_MS ? easeOutBack(p.age / POP_IN_MS) : 1;
      const scale = popIn * (1 - 0.5 * easeInQuad(progress));
      const alpha = progress < 0.45 ? 1 : 1 - easeInQuad((progress - 0.45) / 0.55);
      // Salınım başta sıfır, zamanla açılır.
      const sway = Math.sin(t * p.swayFreq + p.phase) * p.swayAmp * Math.min(1, progress * 3);
      drawHeart(ctx, p.x + sway, p.y, p.size * scale, p.color, p.rotation, alpha);
    }
  }

  clear(): void {
    this.pool.push(...this.items);
    this.items.length = 0;
  }
}
