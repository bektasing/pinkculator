import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import photoUrl from '../assets/photos/us.jpg';
import { SECRET_MESSAGE } from '../calculator/secretCode';
import { setupCanvas } from '../games/shared/canvas';
import { createGameLoop } from '../games/shared/loop';
import { onAppPause, onAppResume } from '../platform/lifecycle';
import { TextButton } from '../ui/PuffyButton';
import { createLoveScene } from './loveScene';
import styles from './LoveScreen.module.css';

interface LoveScreenProps {
  onClose: () => void;
}

const messageSpring = { type: 'spring', stiffness: 170, damping: 16, mass: 1 } as const;
const photoSpring = { type: 'spring', stiffness: 150, damping: 15, mass: 1 } as const;
/** Sabit kalpler fotoğraf ve yazıya bu kadar yaklaşmaz (px) */
const KEEP_OUT_MARGIN = 10;

/** Gizli tarih ekranı: fotoğraf, altında mesaj, etrafında kalpler. */
export function LoveScreen({ onClose }: LoveScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // offset* dönüşümlerden (açılış animasyonu) etkilenmez: son yerleşimi verir.
    const scene = createLoveScene(() => {
      const el = contentRef.current;
      if (!el) return null;
      return {
        left: el.offsetLeft - KEEP_OUT_MARGIN,
        top: el.offsetTop - KEEP_OUT_MARGIN,
        right: el.offsetLeft + el.offsetWidth + KEEP_OUT_MARGIN,
        bottom: el.offsetTop + el.offsetHeight + KEEP_OUT_MARGIN,
      };
    });
    const surface = setupCanvas(canvas, (w, h) => scene.resize(w, h));
    const loop = createGameLoop({
      update: (dt) => scene.update(dt),
      render: () => {
        if (!surface) return;
        surface.begin();
        scene.render(surface.ctx);
      },
    });
    loop.start();
    const offPause = onAppPause(() => loop.stop());
    const offResume = onAppResume(() => loop.start());
    return () => {
      offPause();
      offResume();
      loop.stop();
      surface?.dispose();
      scene.dispose();
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.hearts}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <div ref={contentRef} className={styles.content}>
        <motion.div
          className={styles.frame}
          initial={{ opacity: 0, scale: 0.6, rotate: -9, y: 30 }}
          animate={{ opacity: 1, scale: 1, rotate: -3, y: 0 }}
          transition={{ ...photoSpring, delay: 0.18 }}
        >
          <img className={styles.photo} src={photoUrl} alt="" draggable={false} />
        </motion.div>

        <motion.h1
          className={styles.message}
          initial={{ opacity: 0, scale: 0.7, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...messageSpring, delay: 0.45 }}
        >
          <motion.span
            className={styles.messageInner}
            animate={{ scale: [1, 1.035, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          >
            {SECRET_MESSAGE}
          </motion.span>
        </motion.h1>
      </div>

      <motion.div
        className={styles.close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <TextButton onPress={onClose}>Kapat</TextButton>
      </motion.div>
    </div>
  );
}
