import { darken, lighten } from './color';
import { heartPath2D, HEART_VIEWBOX } from './heartShape';

/**
 * Hacimli, parlak kalp çizimi. Her renk bir kez offscreen canvas'a çizilir ve
 * sonra drawImage ile ölçeklenerek kullanılır (parçacıklar ve oyunlar için hızlı yol).
 */

const SPRITE_BUCKETS = [32, 64, 128] as const;
const PADDING = 2; // kenar yumuşatması için
const cache = new Map<string, HTMLCanvasElement>();

function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 3);
}

/** Kalbi 0,0 noktasından başlayarak `width` genişliğinde doğrudan çizer. */
export function paintHeart(ctx: CanvasRenderingContext2D, width: number, color: string): void {
  const s = width / HEART_VIEWBOX.width;
  const path = heartPath2D();
  ctx.save();
  ctx.scale(s, s);

  // Gövde: üstte açık, altta koyu; hacim hissi.
  const body = ctx.createLinearGradient(0, 4, 0, 88);
  body.addColorStop(0, lighten(color, 0.38));
  body.addColorStop(0.42, color);
  body.addColorStop(1, darken(color, 0.3));
  ctx.fillStyle = body;
  ctx.fill(path);

  // Kenarlara doğru hafif koyulaşma (yuvarlaklık).
  ctx.save();
  ctx.clip(path);
  const rim = ctx.createRadialGradient(50, 40, 18, 50, 46, 62);
  rim.addColorStop(0, 'rgba(255, 246, 243, 0)');
  rim.addColorStop(1, 'rgba(122, 63, 69, 0.22)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, HEART_VIEWBOX.width, HEART_VIEWBOX.height);

  // Sol üst parlama.
  ctx.translate(30, 23);
  ctx.rotate(-0.55);
  ctx.scale(1, 0.58);
  const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, 17);
  gloss.addColorStop(0, 'rgba(255, 250, 247, 0.95)');
  gloss.addColorStop(0.45, 'rgba(255, 250, 247, 0.55)');
  gloss.addColorStop(1, 'rgba(255, 250, 247, 0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function bucketFor(size: number): number {
  for (const bucket of SPRITE_BUCKETS) if (size <= bucket) return bucket;
  return 128;
}

export function getHeartSprite(color: string, size: number): HTMLCanvasElement {
  const bucket = bucketFor(size);
  const ratio = dpr();
  const key = `${color}|${bucket}|${ratio}`;
  let sprite = cache.get(key);
  if (sprite) return sprite;

  const width = bucket * ratio;
  const height = (bucket * HEART_VIEWBOX.height) / HEART_VIEWBOX.width;
  sprite = document.createElement('canvas');
  sprite.width = Math.ceil(width + PADDING * 2);
  sprite.height = Math.ceil(height * ratio + PADDING * 2);
  const ctx = sprite.getContext('2d');
  if (ctx) {
    ctx.translate(PADDING, PADDING);
    paintHeart(ctx, width, color);
  }
  cache.set(key, sprite);
  return sprite;
}

/**
 * Kalbi merkezi (x, y) olacak şekilde çizer. `size` CSS pikseli cinsinden genişlik.
 * Canvas bağlamının DPR ölçeği önceden ayarlanmış olmalı.
 */
export function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  rotation = 0,
  alpha = 1,
): void {
  if (alpha <= 0 || size <= 0) return;
  const sprite = getHeartSprite(color, size);
  const ratio = dpr();
  const bucket = bucketFor(size);
  const scale = size / bucket / ratio;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  ctx.globalAlpha = alpha;
  if (rotation === 0) {
    ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
