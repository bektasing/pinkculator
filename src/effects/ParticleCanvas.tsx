import { useEffect, useRef } from 'react';
import { setupCanvas } from '../games/shared/canvas';
import type { HeartParticles } from './particles';

interface ParticleCanvasProps {
  system: HeartParticles;
  className?: string;
}

/**
 * Bir parçacık sistemini kapsayıcısını dolduran canvas'a çizer. Dokunmaları
 * engellemez; döngü sadece canlı parçacık varken çalışır, boşta hiç kare çizilmez.
 */
export function ParticleCanvas({ system, className }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = setupCanvas(canvas);
    if (!surface) return;

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const alive = system.update(dt);
      surface.begin();
      system.draw(surface.ctx);
      if (alive) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
      }
    };

    system.onWake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    if (system.count > 0) system.onWake();

    return () => {
      system.onWake = null;
      cancelAnimationFrame(frame);
      surface.dispose();
      system.clear();
    };
  }, [system]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
