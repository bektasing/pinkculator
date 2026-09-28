import { BURSTS } from '../effects/particles';
import { drawHeart } from '../effects/heartSprite';
import { impactLight } from '../platform/haptics';
import type { SceneFactory } from './shared/types';

/**
 * Aşama 3 test sahnesi: ortak altyapıyı (döngü, interpolasyon, parçacıklar,
 * duraklatma, oyun sonu, rekor) uçtan uca dener. Her dokunuş kalbi zıplatır (+1);
 * kalp ekranın altından çıkarsa oyun biter. Aşama 4–6'da gerçek oyunlarla değişecek.
 */
const GRAVITY = 1500;
const JUMP = 560;
const HEART = 64;

export function createTestScene(name: string): SceneFactory {
  return ({ particles, gameOver }) => {
    let width = 0;
    let height = 0;
    let started = false;
    let over = false;
    let score = 0;
    let time = 0;
    let y = 0;
    let prevY = 0;
    let vy = 0;
    let rotation = 0;
    let scorePop = 0;

    const baseY = () => height * 0.42;

    return {
      resize(w, h) {
        width = w;
        height = h;
        if (!started) y = prevY = baseY();
      },
      start() {
        started = true;
        vy = -JUMP * 0.6;
      },
      update(dt) {
        particles.update(dt);
        scorePop = Math.max(0, scorePop - dt * 4);
        prevY = y;
        time += dt;
        if (!started) {
          y = baseY() + Math.sin(time * 2.4) * 9;
          return;
        }
        vy += GRAVITY * dt;
        y += vy * dt;
        rotation = Math.max(-0.35, Math.min(0.5, vy / 1400));
        if (!over && y - HEART > height) {
          over = true;
          gameOver(score);
        }
      },
      render(ctx, alpha) {
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, '#f8d9dc');
        bg.addColorStop(1, '#fbeae4');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Arkada büyük, soluk skor
        const size = width * 0.42 * (1 + scorePop * 0.12);
        ctx.fillStyle = 'rgba(201, 119, 127, 0.22)';
        ctx.font = `800 ${size}px Nunito`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(score), width / 2, height * 0.45);

        ctx.fillStyle = 'rgba(158, 118, 114, 0.7)';
        ctx.font = '700 15px Nunito';
        ctx.fillText(`Test sahnesi · ${name}`, width / 2, height - 40);

        const drawY = prevY + (y - prevY) * alpha;
        drawHeart(ctx, width / 2, drawY, HEART, '#e4939a', rotation);
        particles.draw(ctx);
      },
      reset() {
        started = false;
        over = false;
        score = 0;
        vy = 0;
        rotation = 0;
        y = prevY = baseY();
        particles.clear();
      },
      pointerDown() {
        if (over) return;
        vy = -JUMP;
        score++;
        scorePop = 1;
        particles.burst(width / 2, y, BURSTS.pop);
        impactLight();
      },
    };
  };
}
