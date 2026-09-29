import { BURSTS } from '../../effects/particles';
import { GOLD, paintHeart } from '../../effects/heartSprite';
import { HEART_VIEWBOX } from '../../effects/heartShape';
import { prefersReducedMotion } from '../../effects/reducedMotion';
import { impactHeavy, impactLight, notifySuccess } from '../../platform/haptics';
import type { GamePointer, SceneFactory } from '../shared/types';
import { applyMove, newGame, SIZE, type Direction, type MergeState, type MoveOutcome } from './logic';

/**
 * Kalp Birleştir sahnesi: çizim, animasyon ve dokunma. Oyun kuralları logic.ts'te.
 * React tarafıyla (skor rozetleri, geri alma, 2048 kartı, kayıt) `MergeBridge` üzerinden konuşur.
 */

export interface MergeBridge {
  /** React → sahne: sahne kurulunca doldurulur */
  undo: () => void;
  continueAfterWin: () => void;
  /** "2048!" kartındaki "Yeniden başla" */
  restart: () => void;
  /** Sahne → React */
  onScore: (score: number, gained: number) => void;
  onUndoAvailable: (available: boolean) => void;
  onWin: () => void;
  /** Kaydedilecek durum; null = kaydı sil (oyun bitti) */
  onSave: (state: MergeState | null) => void;
}

// Animasyon süreleri (saniye)
const SLIDE = 0.11;
const POP = 0.2;
const SPAWN_DELAY = 0.06;
const SPAWN = 0.16;
const GAME_OVER_DELAY = 0.55;
const WIN_DELAY = 0.35;

/** Değer → kalp rengi: açıktan koyuya, sonra altın. */
const HEART_COLORS: Record<number, string> = {
  2: '#f9dadb', // açık pudra
  4: '#f5c7ca', // pudra
  8: '#efb1b7', // toz pembe
  16: '#e99aa3', // pembe
  32: '#e0838e', // gül
  64: '#c9737e', // gül kurusu
  128: '#b35e6c', // koyu gül
  256: '#8f4a63', // mürdüm
  512: '#7a3349', // şarap
  1024: '#66233a', // bordo
};

function heartColor(value: number): string {
  return value >= 2048 ? GOLD : (HEART_COLORS[value] ?? '#66233a');
}

/** Parlama seviyesi 0–1: değer büyüdükçe artar. */
function shineFor(value: number): number {
  return Math.min(1, Math.log2(value) / 11);
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
/** Birleşme "pop"u: 1 → 1.18 → 1 */
const popCurve = (t: number) => 1 + 0.18 * Math.sin(Math.PI * Math.min(1, t));

type TileKind = 'static' | 'slide' | 'vanish' | 'pop' | 'spawn';
interface RenderTile {
  id: number;
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  kind: TileKind;
}

interface Layout {
  width: number;
  height: number;
  boardX: number;
  boardY: number;
  boardSize: number;
  pad: number;
  gap: number;
  cell: number;
  ratio: number;
}

// ───────────────────────── Önceden çizilen görseller ─────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Şeklin içine düşen iç gölge (içe gömük görünüm). */
function insetShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  blur: number,
  offsetY: number,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  ctx.beginPath();
  ctx.rect(x - 60, y - 60, w + 120, h + 120);
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = '#000';
  ctx.fill('evenodd');
  ctx.restore();
}

function makeBoardSprite(l: Layout): HTMLCanvasElement {
  const margin = 24;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((l.boardSize + margin * 2) * l.ratio);
  canvas.height = Math.ceil((l.boardSize + margin * 2) * l.ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(l.ratio, l.ratio);
  const x = margin;
  const y = margin;
  const s = l.boardSize;
  const r = s * 0.075;

  // Tahtanın altındaki yumuşak pembe gölge ve alt kenar
  ctx.save();
  ctx.shadowColor = 'rgba(201, 110, 124, 0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y + 4, s, s, r);
  ctx.fillStyle = '#e3a7ae';
  ctx.fill();
  ctx.restore();

  // Toz pembe zemin
  const face = ctx.createLinearGradient(0, y, 0, y + s);
  face.addColorStop(0, '#f1bec3');
  face.addColorStop(1, '#f5ccce');
  roundRect(ctx, x, y, s, s, r);
  ctx.fillStyle = face;
  ctx.fill();
  // İçe gömük: üstten iç gölge, altta ince ışık
  insetShadow(ctx, x, y, s, s, r, 'rgba(160, 80, 92, 0.4)', 14, 5);
  ctx.save();
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
  ctx.strokeStyle = 'rgba(255, 240, 238, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Boş hücre yuvaları: biraz daha koyu pembe, içe gömük
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cx = x + l.pad + col * (l.cell + l.gap);
      const cy = y + l.pad + row * (l.cell + l.gap);
      const cr = l.cell * 0.2;
      roundRect(ctx, cx, cy, l.cell, l.cell, cr);
      ctx.fillStyle = '#e6aab1';
      ctx.fill();
      insetShadow(ctx, cx, cy, l.cell, l.cell, cr, 'rgba(140, 62, 76, 0.38)', 7, 3);
    }
  }
  return canvas;
}

function makeTileSprite(value: number, l: Layout): HTMLCanvasElement {
  const margin = Math.ceil(l.cell * 0.18);
  const edge = Math.max(3, l.cell * 0.055);
  const size = l.cell;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((size + margin * 2) * l.ratio);
  canvas.height = Math.ceil((size + margin * 2) * l.ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(l.ratio, l.ratio);
  const x = margin;
  const y = margin;
  const r = size * 0.22;
  const faceH = size - edge;

  // Gölge + krem kalınlık
  ctx.save();
  ctx.shadowColor = 'rgba(170, 90, 104, 0.35)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  roundRect(ctx, x, y + edge, size, faceH, r);
  ctx.fillStyle = '#d9c1b2';
  ctx.fill();
  ctx.restore();

  // Krem yüz: puffy gradient
  const face = ctx.createLinearGradient(0, y, 0, y + faceH);
  face.addColorStop(0, '#fffbf4');
  face.addColorStop(0.55, '#fcf4ea');
  face.addColorStop(1, '#f1e6d9');
  roundRect(ctx, x, y, size, faceH, r);
  ctx.fillStyle = face;
  ctx.fill();
  insetShadow(ctx, x, y, size, faceH, r, 'rgba(188, 148, 124, 0.35)', size * 0.1, -size * 0.04);
  ctx.save();
  roundRect(ctx, x + 1, y + 1, size - 2, faceH - 2, r);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Hacimli kalp
  const shine = shineFor(value);
  const heartW = size * (0.66 + 0.06 * shine);
  const heartH = (heartW * HEART_VIEWBOX.height) / HEART_VIEWBOX.width;
  const hx = x + (size - heartW) / 2;
  const hy = y + (faceH - heartH) / 2 + faceH * 0.02;
  ctx.save();
  ctx.translate(hx, hy);
  paintHeart(ctx, heartW, heartColor(value), shine);
  ctx.restore();

  // Değer: kalbin üstünde, küçük, kalın, okunaklı
  const digits = String(value).length;
  const fontSize = size * (digits <= 2 ? 0.27 : digits === 3 ? 0.23 : digits === 4 ? 0.19 : 0.155);
  const tx = x + size / 2;
  const ty = hy + heartH * 0.47;
  ctx.font = `800 ${fontSize}px Nunito`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = value >= 2048;
  const light = value <= 8;
  if (!light && !gold) {
    ctx.fillStyle = 'rgba(80, 26, 38, 0.35)';
    ctx.fillText(String(value), tx, ty + fontSize * 0.06);
  }
  ctx.fillStyle = gold ? '#6b4410' : light ? '#6d3e3f' : '#fff6f0';
  ctx.fillText(String(value), tx, ty);
  return canvas;
}

// ───────────────────────── Sahne ─────────────────────────

export function createMergeScene(bridge: MergeBridge, initial: MergeState | null): SceneFactory {
  return ({ particles, gameOver, reportScore, insets }) => {
    let state: MergeState = initial ?? newGame(Math.random);
    let previous: MergeState | null = null;
    let layout: Layout | null = null;
    let board: HTMLCanvasElement | null = null;
    const tileSprites = new Map<number, HTMLCanvasElement>();

    let time = 0;
    let animStart = -1;
    let animTiles: RenderTile[] = [];
    let pendingBursts: { row: number; col: number }[] = [];
    let gameOverAt = -1;
    let winAt = -1;
    let locked = false;
    let ended = false;

    // Kaydırma hareketi
    let swipe: { id: number; x: number; y: number; used: boolean } | null = null;

    const staticTiles = (): RenderTile[] =>
      state.tiles.map((t) => ({ id: t.id, value: t.value, fromRow: t.row, fromCol: t.col, toRow: t.row, toCol: t.col, kind: 'static' }));

    /** Yeni oyunda taşlar sıfırdan büyüyerek belirir. */
    const spawnIn = () => {
      animTiles = staticTiles().map((t) => ({ ...t, kind: 'spawn' as const }));
      animStart = time - SLIDE;
    };

    /**
     * Taş görselleri ilk kullanıldıkları karede çizilirse o kare takılır. Bu yüzden
     * bütün değerler boşta kalan zamanlarda, birer birer önceden çizilir.
     */
    let warmHandle = 0;
    const idle = (cb: () => void) =>
      window.requestIdleCallback ? window.requestIdleCallback(cb) : window.setTimeout(cb, 16);
    const cancelIdle = (handle: number) =>
      window.cancelIdleCallback ? window.cancelIdleCallback(handle) : window.clearTimeout(handle);
    const warmSprites = () => {
      cancelIdle(warmHandle);
      const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
      const next = () => {
        const value = values.shift();
        if (value === undefined) return;
        sprite(value);
        warmHandle = idle(next);
      };
      warmHandle = idle(next);
    };

    const sprite = (value: number) => {
      let s = tileSprites.get(value);
      if (!s && layout) {
        s = makeTileSprite(value, layout);
        tileSprites.set(value, s);
      }
      return s ?? null;
    };

    const cellCenter = (row: number, col: number) => {
      const l = layout!;
      return {
        x: l.boardX + l.pad + col * (l.cell + l.gap) + l.cell / 2,
        y: l.boardY + l.pad + row * (l.cell + l.gap) + l.cell / 2,
      };
    };

    const fireBursts = () => {
      if (pendingBursts.length === 0) return;
      for (const { row, col } of pendingBursts) {
        const c = cellCenter(row, col);
        particles.burst(c.x, c.y - (layout?.cell ?? 0) * 0.1, BURSTS.pop);
      }
      pendingBursts = [];
      impactLight();
    };

    const publish = (gained: number) => {
      bridge.onScore(state.score, gained);
      bridge.onUndoAvailable(previous !== null && !ended);
      reportScore(state.score);
    };

    const startAnimation = (outcome: MoveOutcome) => {
      // Önceki animasyon bitmediyse anında tamamlanır (patlamalar kaçmaz).
      fireBursts();
      const tiles: RenderTile[] = [];
      for (const m of outcome.movements) {
        const moving = m.fromRow !== m.toRow || m.fromCol !== m.toCol;
        tiles.push({
          id: m.id,
          value: m.value,
          fromRow: m.fromRow,
          fromCol: m.fromCol,
          toRow: m.toRow,
          toCol: m.toCol,
          kind: m.mergedInto !== null ? 'vanish' : moving ? 'slide' : 'static',
        });
      }
      for (const t of outcome.merged) {
        tiles.push({ id: t.id, value: t.value, fromRow: t.row, fromCol: t.col, toRow: t.row, toCol: t.col, kind: 'pop' });
      }
      if (outcome.spawned) {
        const t = outcome.spawned;
        tiles.push({ id: t.id, value: t.value, fromRow: t.row, fromCol: t.col, toRow: t.row, toCol: t.col, kind: 'spawn' });
      }
      animTiles = tiles;
      animStart = time;
      pendingBursts = outcome.merged.map((t) => ({ row: t.row, col: t.col }));
    };

    const tryMove = (direction: Direction) => {
      if (locked || ended) return;
      const outcome = applyMove(state, direction, Math.random);
      if (!outcome) return; // geçersiz hamle: yeni taş gelmez
      previous = state;
      state = outcome.state;
      startAnimation(outcome);
      publish(outcome.gained);
      if (outcome.reachedWin) {
        winAt = time + SLIDE + WIN_DELAY;
        locked = true;
      }
      if (outcome.over) {
        gameOverAt = time + SLIDE + POP + GAME_OVER_DELAY;
        bridge.onSave(null);
      } else {
        bridge.onSave(state);
      }
    };

    bridge.undo = () => {
      if (!previous || ended || locked) return;
      state = previous;
      previous = null;
      gameOverAt = -1;
      pendingBursts = [];
      animTiles = staticTiles();
      animStart = -1;
      publish(0);
      bridge.onSave(state);
    };

    bridge.continueAfterWin = () => {
      locked = false;
    };

    function resetGame() {
      state = newGame(Math.random);
      previous = null;
      ended = false;
      locked = false;
      gameOverAt = -1;
      winAt = -1;
      pendingBursts = [];
      particles.clear();
      spawnIn();
      bridge.onSave(state);
    }

    bridge.restart = () => {
      resetGame();
      publish(0);
    };

    const directionFrom = (dx: number, dy: number): Direction =>
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

    const threshold = () => Math.max(22, (layout?.width ?? 390) * 0.055);

    return {
      resize(width, height) {
        const inset = insets();
        const u = width / 390;
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        // Üstte ✕ + rozetler, altta safe area; tahta kalan alanda ortalanır.
        const hudBottom = Math.max(inset.top, 30) + 9 * u + 56 * u + 5 + 26 * u;
        const bottom = Math.max(inset.bottom, 12) + 28 * u;
        const available = height - hudBottom - bottom;
        const boardSize = Math.min(width - 40 * u, available, 560);
        const pad = boardSize * 0.036;
        const gap = boardSize * 0.03;
        const cell = (boardSize - 2 * pad - (SIZE - 1) * gap) / SIZE;
        layout = {
          width,
          height,
          boardX: (width - boardSize) / 2,
          boardY: hudBottom + Math.max(0, available - boardSize) * 0.5,
          boardSize,
          pad,
          gap,
          cell,
          ratio,
        };
        board = makeBoardSprite(layout);
        tileSprites.clear();
        warmSprites();
      },

      start() {
        if (initial && state === initial) animTiles = staticTiles();
        else spawnIn();
        publish(0);
      },

      update(dt) {
        time += dt;
        particles.update(dt);
        if (animStart >= 0 && pendingBursts.length && time - animStart >= SLIDE) fireBursts();
        if (animStart >= 0 && time - animStart >= SLIDE + Math.max(POP, SPAWN_DELAY + SPAWN)) {
          animStart = -1;
          animTiles = staticTiles();
        }
        if (winAt >= 0 && time >= winAt) {
          winAt = -1;
          const gold = state.tiles.find((t) => t.value >= 2048);
          if (gold) {
            const c = cellCenter(gold.row, gold.col);
            particles.burst(c.x, c.y, BURSTS.ring);
            particles.burst(c.x, c.y, BURSTS.equals);
          }
          impactHeavy();
          notifySuccess();
          bridge.onWin();
        }
        if (gameOverAt >= 0 && time >= gameOverAt) {
          gameOverAt = -1;
          ended = true;
          bridge.onUndoAvailable(false);
          gameOver(state.score);
        }
      },

      render(ctx) {
        const l = layout;
        if (!l || !board) return;

        // Krem arka plan
        const bg = ctx.createLinearGradient(0, 0, 0, l.height);
        bg.addColorStop(0, '#fcefe7');
        bg.addColorStop(1, '#fbf4ec');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, l.width, l.height);

        const margin = 24;
        ctx.drawImage(board, l.boardX - margin, l.boardY - margin, board.width / l.ratio, board.height / l.ratio);

        const elapsed = animStart >= 0 ? time - animStart : Infinity;
        const slideT = easeOutCubic(Math.min(1, elapsed / SLIDE));
        const reduced = prefersReducedMotion();

        // Çizim sırası: kaybolanlar altta, sonra kayanlar, en üstte pop yapanlar
        const order: TileKind[] = ['vanish', 'static', 'slide', 'spawn', 'pop'];
        for (const kind of order) {
          for (const t of animTiles) {
            if (t.kind !== kind) continue;
            let scale = 1;
            let row = t.toRow;
            let col = t.toCol;
            if (kind === 'slide' || kind === 'vanish') {
              if (kind === 'vanish' && elapsed >= SLIDE) continue;
              row = t.fromRow + (t.toRow - t.fromRow) * slideT;
              col = t.fromCol + (t.toCol - t.fromCol) * slideT;
            } else if (kind === 'pop') {
              if (elapsed < SLIDE) continue;
              scale = reduced ? 1 : popCurve((elapsed - SLIDE) / POP);
            } else if (kind === 'spawn') {
              const st = (elapsed - SLIDE - SPAWN_DELAY) / SPAWN;
              if (st <= 0) continue;
              scale = st >= 1 ? 1 : Math.max(0, easeOutBack(st));
            }
            drawTile(ctx, t.value, row, col, scale);
          }
        }
        particles.draw(ctx);
      },

      reset: resetGame,

      dispose() {
        cancelIdle(warmHandle);
      },

      pointerDown(p: GamePointer) {
        swipe = { id: p.id, x: p.x, y: p.y, used: false };
      },

      pointerMove(p: GamePointer) {
        if (!swipe || swipe.id !== p.id || swipe.used) return;
        const dx = p.x - swipe.x;
        const dy = p.y - swipe.y;
        if (Math.hypot(dx, dy) >= threshold()) {
          swipe.used = true;
          tryMove(directionFrom(dx, dy));
        }
      },

      pointerUp(p: GamePointer) {
        if (!swipe || swipe.id !== p.id) return;
        // Kısa ama hızlı fiskeler de sayılır.
        const dx = p.x - swipe.x;
        const dy = p.y - swipe.y;
        if (!swipe.used && Math.hypot(dx, dy) >= threshold() * 0.6) tryMove(directionFrom(dx, dy));
        swipe = null;
      },
    };

    function drawTile(ctx: CanvasRenderingContext2D, value: number, row: number, col: number, scale: number) {
      const l = layout!;
      const s = sprite(value);
      if (!s) return;
      const c = cellCenter(row, col);
      const w = (s.width / l.ratio) * scale;
      const h = (s.height / l.ratio) * scale;

      // 4096 ve üstü: altın ışık halesi
      if (value >= 4096) {
        const pulse = 0.75 + Math.sin(time * 2.4) * 0.25;
        const halo = ctx.createRadialGradient(c.x, c.y, l.cell * 0.2, c.x, c.y, l.cell * 0.85);
        halo.addColorStop(0, `rgba(255, 214, 120, ${0.55 * pulse})`);
        halo.addColorStop(1, 'rgba(255, 214, 120, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(c.x - l.cell, c.y - l.cell, l.cell * 2, l.cell * 2);
      }

      ctx.drawImage(s, c.x - w / 2, c.y - h / 2, w, h);

      // 2048+: altın kalbin etrafında parıltılar
      if (value >= 2048 && scale > 0.5) drawSparkles(ctx, c.x, c.y - l.cell * 0.03, l.cell * scale, value);
    }

    function drawSparkles(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, value: number) {
      const spots: [number, number, number][] = [
        [-0.3, -0.28, 0],
        [0.33, -0.2, 1.7],
        [0.26, 0.24, 3.1],
      ];
      ctx.save();
      ctx.fillStyle = '#fffbe8';
      for (const [ox, oy, phase] of spots) {
        const tw = (Math.sin(time * 3 + phase + value) + 1) / 2;
        const r = size * (0.035 + 0.045 * tw);
        const cx = x + ox * size;
        const cy = y + oy * size;
        ctx.globalAlpha = 0.35 + 0.65 * tw;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx - r, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy - r);
        ctx.fill();
      }
      ctx.restore();
    }
  };
}
