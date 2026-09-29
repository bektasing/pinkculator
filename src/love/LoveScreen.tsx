import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { SecretEntry } from '../calculator/secretCode';
import { setupCanvas } from '../games/shared/canvas';
import { createGameLoop } from '../games/shared/loop';
import { onAppPause, onAppResume } from '../platform/lifecycle';
import { TextButton } from '../ui/PuffyButton';
import { createLoveScene } from './loveScene';
import { secretPhotoUrl } from './photos';
import styles from './LoveScreen.module.css';

interface LoveScreenProps {
  entry: SecretEntry;
  /** Açılışta seçilmiş mesaj (bkz. nextSecretMessage) */
  message: string;
  onClose: () => void;
}

const messageSpring = { type: 'spring', stiffness: 170, damping: 16, mass: 1 } as const;
const photoSpring = { type: 'spring', stiffness: 150, damping: 15, mass: 1 } as const;
/** Sabit kalpler fotoğraf ve yazıya bu kadar yaklaşmaz (px) */
const KEEP_OUT_MARGIN = 10;

/** Mesaj uzunluğuna göre yazı boyutu: kısa mesaj büyük, uzun mesaj okunaklı ve sığar */
function messageSize(message: string, hasPhoto: boolean): 'short' | 'medium' | 'long' {
  if (message.length <= 20) return 'short';
  if (message.length <= 56 || !hasPhoto) return 'medium';
  return 'long';
}

/** Gizli tarih ekranı (tüm girişler için tek bileşen): fotoğraf, altında mesaj, etrafında kalpler. */
export function LoveScreen({ entry, message, onClose }: LoveScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState(() => secretPhotoUrl(entry.photo));

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
    // Fotoğraf yüklenince içerik büyür: sabit kalpler onun üstünde kalmasın.
    const observer = new ResizeObserver(() => scene.relayout());
    if (contentRef.current) observer.observe(contentRef.current);
    const offPause = onAppPause(() => loop.stop());
    const offResume = onAppResume(() => loop.start());
    return () => {
      observer.disconnect();
      offPause();
      offResume();
      loop.stop();
      surface?.dispose();
      scene.dispose();
    };
  }, []);

  const size = messageSize(message, photo !== null);

  return (
    <div className={styles.root}>
      <div className={styles.hearts}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <div ref={contentRef} className={`${styles.content} ${photo ? '' : styles.noPhoto}`}>
        {photo && (
          <motion.div
            className={styles.frame}
            initial={{ opacity: 0, scale: 0.6, rotate: -9, y: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: -2.5, y: 0 }}
            transition={{ ...photoSpring, delay: 0.18 }}
          >
            <img
              className={styles.photo}
              src={photo}
              alt=""
              draggable={false}
              // Bozuk dosyada uygulama çökmesin: ekran fotoğrafsız devam eder.
              onError={() => setPhoto(null)}
            />
          </motion.div>
        )}

        <motion.h1
          className={`${styles.message} ${styles[size]}`}
          initial={{ opacity: 0, scale: 0.7, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...messageSpring, delay: photo ? 0.45 : 0.25 }}
        >
          <motion.span
            className={styles.messageInner}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          >
            {message}
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
