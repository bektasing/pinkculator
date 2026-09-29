/**
 * Kalp Sektirme fiziği — çizimden ve DOM'dan bağımsız, saf ve test edilebilir.
 *
 * Tüm büyüklükler ekran boyutundan türetilir; böylece her telefonda aynı his:
 * - Her vuruşta kalp ekranın üst ~%20'lik kısmına kadar çıkar.
 * - Vuruşlarla yerçekimi ve fırlatma hızı birlikte artar (tepe noktası sabit kalır,
 *   sadece tempo hızlanır), bir üst sınıra kadar.
 */

export interface BounceWorld {
  width: number;
  height: number;
  /** Kalbin çarpışma yarıçapı (px) */
  radius: number;
  /** Çubuğun üst yüzeyinin y'si */
  paddleTop: number;
  paddleWidth: number;
}

export interface BounceState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  /** Dönüş hızı (rad/s) */
  spin: number;
  /** Başarılı vuruş sayısı (= skor) */
  hits: number;
  paddleX: number;
  /** Parmağın x'i; çubuk buna yumuşakça yaklaşır */
  targetX: number;
}

export interface StepResult {
  hit: boolean;
  /** Vuruşun çubuk üzerindeki konumu (−1 sol uç … 1 sağ uç) */
  hitOffset: number;
  wall: boolean;
  lost: boolean;
}

/** Kalbin tepe noktası: ekran yüksekliğinin bu oranı */
export const APEX_RATIO = 0.2;
/** Hızlanma: vuruş başına artış ve üst sınır */
export const SPEEDUP_PER_HIT = 0.025;
export const MAX_SPEED_FACTOR = 1.75;
/** Başlangıç yerçekimi: ekran yüksekliği × bu değer (px/s²) */
const BASE_GRAVITY_PER_HEIGHT = 2.3;
/** En uçtan vuruşta yatay hız: ekran genişliği × bu değer (px/s) */
const MAX_VX_PER_WIDTH = 0.62;
/** Çubuğun parmağı takip hızı (1/s); yüksek = gecikmesiz ama yumuşak */
const PADDLE_FOLLOW = 32;
/** Yatay hıza bağlı dönüş katsayısı */
const SPIN_PER_VX = 1 / 110;

export function speedFactor(hits: number): number {
  return Math.min(1 + hits * SPEEDUP_PER_HIT, MAX_SPEED_FACTOR);
}

export function gravity(world: BounceWorld, hits: number): number {
  const s = speedFactor(hits);
  return world.height * BASE_GRAVITY_PER_HEIGHT * s * s;
}

/** Çubuktan tepe noktasına (üst %20) çıkacak kadar dikey fırlatma hızı (negatif = yukarı). */
export function launchSpeed(world: BounceWorld, hits: number): number {
  const rise = world.paddleTop - world.radius - world.height * APEX_RATIO;
  return -Math.sqrt(2 * gravity(world, hits) * Math.max(rise, 1));
}

export function createState(world: BounceWorld): BounceState {
  return {
    x: world.width / 2,
    y: world.height * 0.4,
    vx: 0,
    vy: 0,
    rotation: 0,
    spin: 0,
    hits: 0,
    paddleX: world.width / 2,
    targetX: world.width / 2,
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Çubuğun gidebileceği sınırlar içinde hedef x */
export function clampPaddle(world: BounceWorld, x: number): number {
  const half = world.paddleWidth / 2;
  return clamp(x, half, world.width - half);
}

const result: StepResult = { hit: false, hitOffset: 0, wall: false, lost: false };

/**
 * Bir sabit adım ilerletir. `state` yerinde güncellenir ve dönen sonuç nesnesi
 * yeniden kullanılır (adım başına bellek ayrılmaz); değerleri hemen okunmalıdır.
 */
export function step(state: BounceState, world: BounceWorld, dt: number): Readonly<StepResult> {
  result.hit = false;
  result.hitOffset = 0;
  result.wall = false;
  result.lost = false;

  // Çubuk: parmağı üstel yumuşatmayla takip eder.
  const target = clampPaddle(world, state.targetX);
  state.paddleX += (target - state.paddleX) * (1 - Math.exp(-PADDLE_FOLLOW * dt));

  const prevBottom = state.y + world.radius;
  state.vy += gravity(world, state.hits) * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.rotation += state.spin * dt;

  // Yan duvarlar
  if (state.x < world.radius) {
    state.x = world.radius;
    state.vx = Math.abs(state.vx);
    state.spin = -state.spin;
    result.wall = true;
  } else if (state.x > world.width - world.radius) {
    state.x = world.width - world.radius;
    state.vx = -Math.abs(state.vx);
    state.spin = -state.spin;
    result.wall = true;
  }

  // Çubuk: sadece aşağı inerken ve alt kenar bu adımda çubuk yüzeyini geçtiyse
  // (süpürme testi: yüksek hızda bile içinden geçemez).
  const bottom = state.y + world.radius;
  if (state.vy > 0 && prevBottom <= world.paddleTop && bottom >= world.paddleTop) {
    const reach = world.paddleWidth / 2 + world.radius * 0.6;
    const offset = (state.x - state.paddleX) / reach;
    if (Math.abs(offset) <= 1) {
      state.y = world.paddleTop - world.radius;
      state.hits += 1;
      state.vy = launchSpeed(world, state.hits);
      state.vx = offset * world.width * MAX_VX_PER_WIDTH * speedFactor(state.hits);
      state.spin = state.vx * SPIN_PER_VX;
      result.hit = true;
      result.hitOffset = offset;
    }
  }

  // Ekranın altından tamamen çıktıysa oyun biter. (Üstte sınır yok; yerçekimi geri getirir.)
  if (state.y - world.radius > world.height) result.lost = true;

  return result;
}
