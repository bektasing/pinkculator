import { darken, hexToRgb, lighten, rgbToCss, type RGB } from '../../effects/color';
import { drawHeartScaled } from '../../effects/heartSprite';
import { BURSTS } from '../../effects/particles';
import { prefersReducedMotion } from '../../effects/reducedMotion';
import { impactLight, impactMedium } from '../../platform/haptics';
import { FIXED_STEP } from '../shared/loop';
import type { SceneFactory } from '../shared/types';
import {
  advanceMoving,
  createState,
  createWorld,
  place,
  rescale,
  score,
  spawnMoving,
  topBlock,
  type Block,
  type PlaceResult,
  type StackState,
} from './logic';

/**
 * Kalp Kulesi (Stack tarzı). Mantık logic.ts'te; burası boyutlar, kamera, his
 * (bırakma, kalp zıplaması, parlama, kombo) ve çizimdir.
 *
 * Dikey eksen "dünya yüksekliği" h ile tutulur: zeminin üst yüzeyi h = 0, yukarısı pozitif.
 * L. kat [ (L−1)·bh, L·bh ] aralığındadır. Kayan blok, tepedeki kalbe yer kalsın diye
 * bir boşluk (gap) yukarıda kayar; dokununca aşağı iner ve kalp yeni tepeye zıplar.
 */

// Katlar arasında yumuşak renk döngüsü: toz pembe → pudra → gül → şeftali pembe
const BLOCK_KEYS = ['#f2b6c1', '#f8d3d6', '#e994a3', '#f5b9a8'].map(hexToRgb);
const LEVELS_PER_KEY = 3;
const GROUND_COLOR = '#e9a9b4';

// Arka plan: açık pembe → krem; kule yükseldikçe tonu yavaşça değişir.
const BG_TOPS = ['#f7d3da', '#f2d3e2', '#f9d7cd', '#f5cdd4'].map(hexToRgb);
const BG_BOTTOMS = ['#fdf2ec', '#fbf0f2', '#fdf3ea', '#fcefeb'].map(hexToRgb);
const LEVELS_PER_BG = 14;

const INK = '#6e3a47';
const COMBO_INK = '#c4687f';
const HEART_COLOR = '#ec96a0';
const HEART_SHADOW = '#c9777f';

/** Kayan bloğun iniş süresi (s) */
const DROP_S = 0.12;
/** Kalp zıplaması süresi (s) */
const HOP_S = 0.42;
const FLASH_S = 0.45;
const COMBO_LABEL_S = 1.25;
/** Kayan bloğun üst kenarı ekranın bu oranından yukarı çıkmaz (kamera takip eder) */
const VIEW_TOP_RATIO = 0.4;
/** Oyun sonu: ıskadan sonra bekleme, kamera geri çekilme süresi, kart öncesi bekleme */
const END_WAIT_S = 0.55;
const END_ZOOM_S = 1.15;
const END_HOLD_S = 0.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeInQuad = (t: number) => t * t;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const toHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Paletten döngüsel, yumuşak geçişli renk (t: ondalıklı indeks) */
function cycle(keys: RGB[], t: number): RGB {
  const n = keys.length;
  const i = ((Math.floor(t) % n) + n) % n;
  return mixRgb(keys[i] as RGB, keys[(i + 1) % n] as RGB, t - Math.floor(t));
}

const colorCache = new Map<number, string>();
function blockColor(level: number): string {
  if (level <= 0) return GROUND_COLOR;
  let color = colorCache.get(level);
  if (!color) {
    color = toHex(cycle(BLOCK_KEYS, (level - 1) / LEVELS_PER_KEY));
    colorCache.set(level, color);
  }
  return color;
}

/** Sönümlü yay (pop, squash animasyonları için) */
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

/**
 * Puffy blok: alt kenarda koyu kalınlık, üstte açık gradient yüz, parlama çizgisi.
 * (x, y) sol üst köşe; `row` bir katın ekran yüksekliği (kalınlık ve köşe buna göre).
 */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  row: number,
  color: string,
  flash = 0,
): void {
  if (w <= 0.5) return;
  const edge = row * 0.17;
  const face = h - edge;
  const r = Math.min((row - edge) * 0.3, w / 2);

  // Üstteki bloğun alttakine düşen yumuşak gölgesi
  ctx.beginPath();
  ctx.roundRect(x + 4, y + h - edge * 0.3, Math.max(0, w - 8), edge * 0.8, r);
  ctx.fillStyle = 'rgba(150, 72, 88, 0.09)';
  ctx.fill();

  // Kalınlık
  ctx.beginPath();
  ctx.roundRect(x, y + edge, w, face, r);
  ctx.fillStyle = darken(color, 0.3);
  ctx.fill();

  // Yüz
  const grad = ctx.createLinearGradient(0, y, 0, y + row - edge);
  grad.addColorStop(0, lighten(color, 0.32));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, darken(color, 0.06));
  ctx.beginPath();
  ctx.roundRect(x, y, w, face, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Parlama çizgisi
  const glossW = Math.min(w * 0.5, w - r * 2);
  if (glossW > 4) {
    ctx.beginPath();
    ctx.roundRect(x + r * 0.8, y + row * 0.13, glossW, Math.max(2, row * 0.09), row * 0.05);
    ctx.fillStyle = 'rgba(255, 250, 247, 0.62)';
    ctx.fill();
  }

  if (flash > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, face, r);
    ctx.fillStyle = `rgba(255, 250, 247, ${flash * 0.75})`;
    ctx.fill();
  }
}

/** Kesilip düşen parça */
interface Piece {
  x: number;
  width: number;
  /** Alt kenarın dünya yüksekliği */
  h: number;
  vx: number;
  vh: number;
  rotation: number;
  spin: number;
  color: string;
  prevX: number;
  prevH: number;
  prevRotation: number;
}

export const createStackScene: SceneFactory = ({ particles, gameOver, insets }) => {
  const world = createWorld(1, 1);
  let state: StackState = createState(world);
  let height = 1;
  let bh = 1;
  /** Kayan blokla tepe arasındaki boşluk (kalp buraya sığar) */
  let gap = 1;
  let groundTop = 1;
  let scoreY = 1;
  let heartSize = 40;

  let started = false;
  /** start() ile aynı dokunuşta gelen basış bloğu bırakmasın */
  let skipNextDown = false;
  let ending = false;
  let endT = 0;
  let endReported = false;
  let time = 0;

  // Kamera: zeminden yukarı kayma (dünya px) ve yakınlaştırma (oyun sonunda < 1)
  let cam = 0;
  let zoom = 1;
  let camAtEnd = 0;
  let endZoom = 1;

  // İnterpolasyon için önceki adım
  let prevCam = 0;
  let prevZoom = 1;
  let prevMovingX = 0;

  /** Son bırakılan bloğun inişi */
  let drop: { result: Exclude<PlaceResult, { kind: 'miss' }>; t: number } | null = null;
  let flash: { level: number; t: number } | null = null;
  let pieces: Piece[] = [];

  // Tepedeki kalp
  const heart = { x: 0, h: 0, fromX: 0, fromH: 0, toX: 0, toH: 0, t: 1, prevX: 0, prevH: 0 };
  const heartSquash = spring();
  const scorePop = spring();
  let combo: { text: string; age: number } | null = null;
  const comboPop = spring();

  const sx = (x: number) => world.width / 2 + (x - world.width / 2) * zoom;
  const sy = (h: number) => groundTop - (h - cam) * zoom;

  const snapshot = () => {
    prevCam = cam;
    prevZoom = zoom;
    prevMovingX = state.moving?.x ?? 0;
    heart.prevX = heart.x;
    heart.prevH = heart.h;
    for (const p of pieces) {
      p.prevX = p.x;
      p.prevH = p.h;
      p.prevRotation = p.rotation;
    }
  };

  const placeHeart = (block: Block) => {
    heart.x = heart.toX = heart.fromX = block.x + block.width / 2;
    heart.h = heart.toH = heart.fromH = block.level * bh;
    heart.t = 1;
  };

  const hopTo = (block: Block) => {
    heart.fromX = heart.x;
    heart.fromH = heart.h;
    heart.toX = block.x + block.width / 2;
    heart.toH = block.level * bh;
    heart.t = 0;
  };

  /** Kayan blok satırının üst kenarı (dünya h) */
  const movingRowTop = () => topBlock(state).level * bh + gap + bh;

  const cameraTarget = () => Math.max(0, movingRowTop() - (groundTop - height * VIEW_TOP_RATIO));

  const addPiece = (block: Block, h: number, vh: number, side: number) => {
    const reduced = prefersReducedMotion();
    pieces.push({
      x: block.x,
      width: block.width,
      h,
      vx: side * world.width * (reduced ? 0.05 : 0.09),
      vh,
      rotation: 0,
      spin: side * (reduced ? 1.2 : 2.6) * (0.8 + Math.random() * 0.4),
      color: blockColor(block.level),
      prevX: block.x,
      prevH: h,
      prevRotation: 0,
    });
  };

  /** Bırakılan blok yerine oturdu: parlama, parçacık, titreşim, skor pop'u */
  const land = (result: Exclude<PlaceResult, { kind: 'miss' }>) => {
    const { block } = result;
    scorePop.velocity = prefersReducedMotion() ? 5 : 12;
    if (result.kind === 'perfect') {
      flash = { level: block.level, t: 0 };
      const cx = sx(block.x + block.width / 2);
      const cy = sy((block.level - 0.5) * bh);
      particles.burst(cx, cy, BURSTS.ring);
      combo = { text: result.combo > 1 ? `Mükemmel x${result.combo}` : 'Mükemmel', age: 0 };
      comboPop.value = -1;
      comboPop.velocity = 0;
      if (result.combo >= 3) impactMedium();
      else impactLight();
    } else {
      impactLight();
    }
  };

  const finishDrop = () => {
    if (!drop) return;
    const done = drop.result;
    drop = null;
    land(done);
  };

  const resetAll = () => {
    state = createState(world);
    started = false;
    skipNextDown = false;
    ending = false;
    endT = 0;
    endReported = false;
    cam = 0;
    zoom = 1;
    drop = null;
    flash = null;
    combo = null;
    pieces = [];
    for (const s of [heartSquash, scorePop, comboPop]) {
      s.value = 0;
      s.velocity = 0;
    }
    placeHeart(topBlock(state));
    particles.clear();
    snapshot();
  };

  const layout = (width: number, h: number) => {
    const inset = insets();
    height = h;
    const nextBh = Math.round(Math.min(h * 0.072, width * 0.16));
    if (state.blocks.length > 1 || state.moving) {
      rescale(state, world, width, nextBh);
    } else {
      Object.assign(world, createWorld(width, nextBh));
      state = createState(world);
    }
    bh = nextBh;
    gap = bh * 0.85;
    heartSize = bh * 0.72;
    groundTop = h - inset.bottom - h * 0.18;
    scoreY = Math.max(inset.top, 30) + Math.max(96, h * 0.13);
  };

  return {
    resize(width, h) {
      const kx = width / world.width;
      const kh = world.blockHeight;
      layout(width, h);
      if (!started) {
        placeHeart(topBlock(state));
      } else {
        // Oyun sırasında boyut değişirse konumları orantılı taşı.
        const ky = bh / kh;
        heart.x *= kx;
        heart.fromX *= kx;
        heart.toX *= kx;
        heart.h *= ky;
        heart.fromH *= ky;
        heart.toH *= ky;
        cam *= ky;
        for (const p of pieces) {
          p.x *= kx;
          p.width *= kx;
          p.h *= ky;
        }
      }
      snapshot();
    },

    start() {
      started = true;
      skipNextDown = true;
      spawnMoving(state, world);
      snapshot();
    },

    update(dt) {
      snapshot();
      time += dt;
      particles.update(dt);
      stepSpring(heartSquash, dt, 620, 15);
      stepSpring(scorePop, dt, 380, 14);
      stepSpring(comboPop, dt, 420, 16);

      if (started && !ending) advanceMoving(state, world, dt);

      if (drop) {
        drop.t += dt;
        if (drop.t >= DROP_S) finishDrop();
      }
      if (flash) {
        flash.t += dt;
        if (flash.t >= FLASH_S) flash = null;
      }
      if (combo) {
        combo.age += dt;
        if (combo.age >= COMBO_LABEL_S) combo = null;
      }

      // Kalp zıplaması: parabolik yay, inişte yassılma
      if (heart.t < 1) {
        heart.t = Math.min(1, heart.t + dt / HOP_S);
        const p = heart.t;
        heart.x = lerp(heart.fromX, heart.toX, easeOutQuad(p));
        heart.h = lerp(heart.fromH, heart.toH, p) + bh * 1.35 * 4 * p * (1 - p);
        if (heart.t >= 1) {
          heartSquash.value = 1;
          heartSquash.velocity = 0;
        }
      }

      // Düşen parçalar: yerçekimi + dönme; ekrandan çıkınca silinir
      const g = height * 2.6;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i] as Piece;
        p.vh -= g * dt;
        p.x += p.vx * dt;
        p.h += p.vh * dt;
        p.rotation += p.spin * dt;
        if (sy(p.h + bh * 2) > height + 40) pieces.splice(i, 1);
      }

      if (!ending) {
        cam += (cameraTarget() - cam) * (1 - Math.exp(-6 * dt));
        return;
      }

      // Oyun sonu: kısa bekleme, sonra kamera geri çekilip tüm kuleyi gösterir.
      endT += dt;
      const zt = easeInOut(clamp01((endT - END_WAIT_S) / END_ZOOM_S));
      cam = lerp(camAtEnd, 0, zt);
      zoom = lerp(1, endZoom, zt);
      const needsZoom = camAtEnd > 1 || endZoom < 0.999;
      const total = needsZoom ? END_WAIT_S + END_ZOOM_S + END_HOLD_S : END_WAIT_S + END_HOLD_S + 0.2;
      if (!endReported && endT >= total) {
        endReported = true;
        gameOver(score(state));
      }
    },

    render(ctx, alpha) {
      const width = world.width;
      const camNow = lerp(prevCam, cam, alpha);
      const zoomNow = lerp(prevZoom, zoom, alpha);
      const camReal = cam;
      const zoomReal = zoom;
      cam = camNow;
      zoom = zoomNow;

      // Arka plan
      const bgT = camNow / bh / LEVELS_PER_BG;
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, rgbToCss(cycle(BG_TOPS, bgT)));
      bg.addColorStop(1, rgbToCss(cycle(BG_BOTTOMS, bgT)));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const row = bh * zoomNow;

      // Zemin: ekranın altına kadar uzanan geniş kaide
      const ground = state.blocks[0] as Block;
      const groundY = sy(0);
      drawBlock(ctx, sx(ground.x), groundY, ground.width * zoomNow, height - groundY + row, row, GROUND_COLOR);

      // Görünen katlar (alttan üste; üstteki gölgesini alttakine düşürür)
      const lowestH = camNow - (height - groundTop) / zoomNow;
      const first = Math.max(1, Math.floor(lowestH / bh));
      const last = state.blocks.length - 1;
      for (let i = first; i <= last; i++) {
        const b = state.blocks[i] as Block;
        let bottom = (b.level - 1) * bh;
        if (drop && drop.result.block === b) {
          const t = clamp01((drop.t + FIXED_STEP * alpha) / DROP_S);
          bottom += gap * (1 - easeInQuad(t));
        }
        const top = sy(bottom + bh);
        if (top > height) continue;
        const f = flash && flash.level === b.level ? 1 - easeOutQuad(flash.t / FLASH_S) : 0;
        drawBlock(ctx, sx(b.x), top, b.width * zoomNow, row, row, blockColor(b.level), f);
      }

      // Kayan blok
      const m = state.moving;
      if (m) {
        const x = lerp(prevMovingX, m.x, alpha);
        drawBlock(ctx, sx(x), sy(movingRowTop()), m.width * zoomNow, row, row, blockColor(m.level));
      }

      // Düşen parçalar (merkez etrafında dönerek)
      for (const p of pieces) {
        const x = lerp(p.prevX, p.x, alpha);
        const h = lerp(p.prevH, p.h, alpha);
        const rot = lerp(p.prevRotation, p.rotation, alpha);
        const w = p.width * zoomNow;
        ctx.save();
        ctx.translate(sx(x + p.width / 2), sy(h) - row / 2);
        ctx.rotate(rot);
        drawBlock(ctx, -w / 2, -row / 2, w, row, row, p.color);
        ctx.restore();
      }

      // Kalp: tepede hafifçe sallanır, inişte yassılır; alt kenarı bloğa değer.
      const hx = sx(lerp(heart.prevX, heart.x, alpha));
      const hb = sy(lerp(heart.prevH, heart.h, alpha));
      const size = heartSize * zoomNow;
      const squash = heartSquash.value;
      const idle = heart.t >= 1 && !prefersReducedMotion() ? Math.sin(time * 2.2) * 0.07 : 0;
      const hsx = 1 + squash * 0.24;
      const hsy = 1 - squash * 0.24;
      const cy = hb - size * 0.45 * hsy;
      drawHeartScaled(ctx, hx + 2, cy + 4, size, HEART_SHADOW, idle, hsx, hsy, 0.18);
      drawHeartScaled(ctx, hx, cy, size, HEART_COLOR, idle, hsx, hsy);

      particles.draw(ctx);

      // Skor: üst ortada, büyük ve kalın
      const pop = 1 + Math.max(-0.1, scorePop.value) * 0.16;
      const fontSize = Math.round(width * 0.17);
      ctx.save();
      ctx.translate(width / 2, scoreY);
      ctx.scale(pop, pop);
      ctx.font = `800 ${fontSize}px Nunito`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(201, 119, 127, 0.28)';
      ctx.fillText(String(score(state)), 0, 3);
      ctx.fillStyle = INK;
      ctx.fillText(String(score(state)), 0, 0);
      ctx.restore();

      // Kombo yazısı
      if (combo) {
        const fadeStart = COMBO_LABEL_S - 0.35;
        const a = combo.age < fadeStart ? 1 : 1 - (combo.age - fadeStart) / 0.35;
        const s = 1 + comboPop.value * 0.35;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(width / 2, scoreY + fontSize * 0.72);
        ctx.scale(s, s);
        ctx.font = `800 ${Math.round(width * 0.052)}px Nunito`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COMBO_INK;
        ctx.fillText(combo.text, 0, 0);
        ctx.restore();
      }

      cam = camReal;
      zoom = zoomReal;
    },

    reset: resetAll,

    pointerDown() {
      if (!started || ending) return;
      if (skipNextDown) {
        skipNextDown = false;
        return;
      }
      // Blok henüz ekrana girmediyse dokunuş yok sayılır (kesin ıska olurdu).
      const m = state.moving;
      if (!m || m.x + m.width <= 0 || m.x >= world.width) return;

      finishDrop();
      const result = place(state, world);
      if (!result) return;

      const rowBottom = (result.kind === 'miss' ? topBlock(state).level : result.block.level - 1) * bh;
      const dropSpeed = -(gap / DROP_S) * 1.4;

      if (result.kind === 'miss') {
        const side = result.piece.x + result.piece.width / 2 > world.width / 2 ? 1 : -1;
        addPiece(result.piece, rowBottom + gap, dropSpeed * 0.5, side);
        ending = true;
        endT = 0;
        camAtEnd = cam;
        const towerTop = topBlock(state).level * bh + heartSize;
        const room = groundTop - (scoreY + Math.max(48, height * 0.07));
        endZoom = Math.min(1, room / Math.max(towerTop, 1));
        impactMedium();
        return;
      }

      if (result.kind === 'cut') {
        const side = result.piece.x > result.block.x ? 1 : -1;
        addPiece(result.piece, rowBottom + gap, dropSpeed, side);
      }
      drop = { result, t: 0 };
      hopTo(result.block);
      spawnMoving(state, world);
      prevMovingX = state.moving?.x ?? 0;
    },
  };
};
