import { useEffect, useRef } from 'react';
import { attachBurstLayer, overlayParticles } from './heartBurst';
import styles from './HeartBurstLayer.module.css';

/**
 * Tam ekran, dokunmaları engellemeyen parçacık canvas'ı.
 * Döngü sadece canlı parçacık varken çalışır; boşta hiç kare çizilmez.
 */
export function HeartBurstLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let ratio = 1;
    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 3);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const alive = overlayParticles.update(dt);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      overlayParticles.draw(ctx);
      if (alive) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
      }
    };
    const detach = attachBurstLayer(() => {
      if (!frame) frame = requestAnimationFrame(tick);
    });

    return () => {
      detach();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      overlayParticles.clear();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.layer} aria-hidden="true" />;
}
