import { hexToRgb, rgbToCss, type RGB } from '../../effects/color';
import { drawHeartScaled } from '../../effects/heartSprite';
import { BURSTS } from '../../effects/particles';
import { prefersReducedMotion } from '../../effects/reducedMotion';
import { impactLight } from '../../platform/haptics';
import type { SceneFactory } from '../shared/types';
import { createState, launchSpeed, step, type BounceState, type BounceWorld } from './physics';

/**
 * Kalp Sektirme (Instagram DM emoji oyunu tarzı).
 * Fizik physics.ts'te; burası sadece boyutlar, his (squash & stretch, pop, parçacık,
 * titreşim) ve çizimdir.
 */

// Her 10 puanda arka plan bir sonraki pembe tona geçer (hep paletimizin içinde).
const BACKGROUNDS: [string, string][] = [
  ['#f8d5da', '#fbe9e4'], // toz pembe
  ['#fbd8cc', '#fdede3'], // şeftali pembe
  ['#ecd3e4', '#f7e9ef'], // lila pembe
  ['#f3c3cb', '#fae1e1'], // gül
];
const POINTS_PER_STAGE = 10;
const BG_TRANSITION_S = 1.4;

const HEART_COLOR = '#ec96a0';
/** Arkadaki skor: zeminin koyu, gül-kahveye çalan tonu, %25 opaklık */
const SCORE_INK = hexToRgb('#7a3f45');
const HEART_SHADOW = '#c9777f';

/** Sönümlü yay (squash, pop animasyonları için). */
interface Spring {
  value: number;
  velocity: number;
}
const spring = (): Spring => ({ value: 0, velocity: 0 });

function stepSpring(s: Spring, dt: number, stiffness: number, damping: number): void {
  s.velocity += (-stiffness * s.value - damping * s.velocity) * dt;
  s.value += s.velocity * dt;
  if (Math.abs(s.value) < 1e-4 && Math.abs(s.velocity) < 1e-3) {
    s.value = 0;
    s.velocity = 0;
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Hacimli, puffy çubuk: gölge + koyu kalınlık + gradient yüz + parlama. Boyut değişince yeniden çizilir. */
function makePaddleSprite(width: number, height: number, ratio: number): HTMLCanvasElement {
  const pad = 14;
  const edge = Math.round(height * 0.22);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((width + pad * 2) * ratio);
  canvas.height = Math.ceil((height + edge + pad * 2) * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(ratio, ratio);
  const r = height / 2;
  const pill = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
  };

  // Altındaki yumuşak pembe gölge
  ctx.save();
  ctx.shadowColor = 'rgba(201, 110, 124, 0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  pill(pad, pad + edge, width, height);
  ctx.fillStyle = '#a25557';
  ctx.fill();
  ctx.restore();

  // Yüz
  const face = ctx.createLinearGradient(0, pad, 0, pad + height);
  face.addColorStop(0, '#dd8f98');
  face.addColorStop(0.5, '#c9777f');
  face.addColorStop(1, '#b8656f');
  pill(pad, pad, width, height);
  ctx.fillStyle = face;
  ctx.fill();

  // Üst parlama
  ctx.save();
  pill(pad, pad, width, height);
  ctx.clip();
  const gloss = ctx.createRadialGradient(pad + width * 0.3, pad + r * 0.4, 0, pad + width * 0.3, pad + r * 0.4, width * 0.45);
  gloss.addColorStop(0, 'rgba(255, 236, 234, 0.55)');
  gloss.addColorStop(1, 'rgba(255, 236, 234, 0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(pad, pad, width, height);
  ctx.restore();
  pill(pad + r * 0.8, pad + height * 0.18, width * 0.62, Math.max(3, height * 0.16));
  ctx.fillStyle = 'rgba(255, 246, 243, 0.4)';
  ctx.fill();

  return canvas;
}

export const createBounceScene: SceneFactory = ({ particles, gameOver, insets }) => {
  const world: BounceWorld = { width: 1, height: 1, radius: 20, paddleTop: 1, paddleWidth: 1 };
  let state: BounceState = createState(world);
  let heartSize = 56;
  let paddleHeight = 24;
  let paddleSprite: HTMLCanvasElement | null = null;
  let spriteRatio = 1;

  let started = false;
  let over = false;
  let time = 0;

  // İnterpolasyon için önceki adımın değerleri
  let prevX = 0;
  let prevY = 0;
  let prevRotation = 0;
  let prevPaddleX = 0;

  // His: kalp çarpma yassılması (dikey / yatay), çubuk basılması, skor pop'u
  const squashY = spring();
  const squashX = spring();
  const paddlePress = spring();
  const scorePop = spring();

  // Arka plan geçişi
  let stage = 0;
  let bgFrom: [RGB, RGB] = [hexToRgb(BACKGROUNDS[0]![0]), hexToRgb(BACKGROUNDS[0]![1])];
  let bgTo = bgFrom;
  let bgT = 1;

  const snapshot = () => {
    prevX = state.x;
    prevY = state.y;
    prevRotation = state.rotation;
    prevPaddleX = state.paddleX;
  };

  const resetAll = () => {
    state = createState(world);
    started = false;
    over = false;
    stage = 0;
    bgFrom = bgTo = [hexToRgb(BACKGROUNDS[0]![0]), hexToRgb(BACKGROUNDS[0]![1])];
    bgT = 1;
    for (const s of [squashX, squashY, paddlePress, scorePop]) {
      s.value = 0;
      s.velocity = 0;
    }
    particles.clear();
    snapshot();
  };

  const currentBackground = (): [RGB, RGB] => {
    const t = easeInOut(Math.min(bgT, 1));
    return [mixRgb(bgFrom[0], bgTo[0], t), mixRgb(bgFrom[1], bgTo[1], t)];
  };

  return {
    resize(width, height) {
      const inset = insets();
      const oldWidth = world.width;
      const oldHeight = world.height;
      heartSize = Math.max(50, Math.min(64, width * 0.144));
      paddleHeight = Math.max(18, Math.min(26, width * 0.062));
      world.width = width;
      world.height = height;
      world.radius = heartSize * 0.42;
      world.paddleWidth = width * 0.3;
      const paddleBottom = height - inset.bottom - Math.max(44, height * 0.06);
      world.paddleTop = paddleBottom - paddleHeight;

      spriteRatio = Math.min(window.devicePixelRatio || 1, 3);
      paddleSprite = makePaddleSprite(world.paddleWidth, paddleHeight, spriteRatio);

      if (!started) {
        state = createState(world);
      } else {
        // Oyun sırasında boyut değişirse konumları orantılı taşı.
        const kx = width / oldWidth;
        const ky = height / oldHeight;
        state.x *= kx;
        state.paddleX *= kx;
        state.targetX *= kx;
        state.y *= ky;
      }
      snapshot();
    },

    start() {
      started = true;
    },

    update(dt) {
      snapshot();
      time += dt;
      particles.update(dt);
      stepSpring(squashY, dt, 700, 17);
      stepSpring(squashX, dt, 700, 17);
      stepSpring(paddlePress, dt, 900, 24);
      stepSpring(scorePop, dt, 380, 14);
      if (bgT < 1) bgT += dt / BG_TRANSITION_S;

      if (!started) {
        // Başlangıçta kalp ortanın biraz üstünde durur; sadece çubuk hareket eder.
        const y = state.y;
        const vy = state.vy;
        step(state, world, dt);
        state.y = y;
        state.vy = vy;
        return;
      }
      if (over) return;

      const r = step(state, world, dt);
      if (r.hit) {
        squashY.value = 1;
        squashY.velocity = 0;
        paddlePress.value = 1;
        scorePop.velocity = prefersReducedMotion() ? 6 : 14;
        particles.burst(state.x, world.paddleTop, BURSTS.pop);
        impactLight();

        const nextStage = Math.floor(state.hits / POINTS_PER_STAGE) % BACKGROUNDS.length;
        if (nextStage !== stage) {
          bgFrom = currentBackground();
          const colors = BACKGROUNDS[nextStage] ?? BACKGROUNDS[0]!;
          bgTo = [hexToRgb(colors[0]), hexToRgb(colors[1])];
          bgT = 0;
          stage = nextStage;
        }
      }
      if (r.wall) {
        squashX.value = 0.7;
        squashX.velocity = 0;
      }
      if (r.lost) {
        over = true;
        gameOver(state.hits);
      }
    },

    render(ctx, alpha) {
      const { width, height } = world;

      // Arka plan
      const [top, bottom] = currentBackground();
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, rgbToCss(top));
      bg.addColorStop(1, rgbToCss(bottom));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Arkada büyük, soluk skor (ekran genişliğinin ~%40'ı yüksekliğinde)
      const popScale = 1 + scorePop.value * 0.18;
      const fontSize = width * 0.57;
      ctx.save();
      ctx.translate(width / 2, height * 0.42);
      ctx.scale(popScale, popScale);
      ctx.font = `800 ${fontSize}px Nunito`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgbToCss(mixRgb(top, SCORE_INK, 0.42), 0.25);
      ctx.fillText(String(state.hits), 0, fontSize * 0.04);
      ctx.restore();

      // Çubuk (basılınca hafifçe iner ve yassılır)
      const paddleX = lerp(prevPaddleX, state.paddleX, alpha);
      if (paddleSprite) {
        const press = Math.max(0, paddlePress.value);
        const w = paddleSprite.width / spriteRatio;
        const h = paddleSprite.height / spriteRatio;
        ctx.save();
        ctx.translate(paddleX, world.paddleTop + paddleHeight / 2 + press * 4);
        ctx.scale(1 + press * 0.06, 1 - press * 0.22);
        ctx.drawImage(paddleSprite, -w / 2, -14 - paddleHeight / 2, w, h);
        ctx.restore();
      }

      // Kalp: çarpma yönünde yassılma + hıza göre hafif uzama
      const x = lerp(prevX, state.x, alpha);
      const y = lerp(prevY, state.y, alpha);
      const rotation = lerp(prevRotation, state.rotation, alpha);
      const speed = started ? Math.min(Math.abs(state.vy) / Math.abs(launchSpeed(world, state.hits)), 1) : 0;
      const stretch = speed * 0.07;
      const breathe = started ? 1 : 1 + Math.sin(time * 2.6) * 0.025;
      const sx = (1 + 0.26 * squashY.value) * (1 - 0.18 * squashX.value) * (1 - stretch * 0.6) * breathe;
      const sy = (1 - 0.26 * squashY.value) * (1 + 0.18 * squashX.value) * (1 + stretch) * breathe;
      // Yassılma çubuğa değen noktadan olsun: kalbin altı sabit kalır.
      const squashShift = heartSize * 0.42 * (1 - sy);

      drawHeartScaled(ctx, x + 3, y + 7 + squashShift, heartSize, HEART_SHADOW, rotation, sx, sy, 0.16);
      drawHeartScaled(ctx, x, y + squashShift, heartSize, HEART_COLOR, rotation, sx, sy);

      particles.draw(ctx);
    },

    reset: resetAll,

    pointerDown(pointer) {
      state.targetX = pointer.x;
    },

    pointerMove(pointer) {
      state.targetX = pointer.x;
    },
  };
};
