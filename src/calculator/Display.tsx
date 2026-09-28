import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, type PointerEvent } from 'react';
import { useFitScale } from './useFitScale';
import styles from './Display.module.css';

/** Kaydırmanın silme sayılması için gereken yatay mesafe (px) */
const SWIPE_DISTANCE = 34;

interface DisplayProps {
  expression: string;
  result: string;
  /** Sağa veya sola kaydırma: son haneyi sil */
  onSwipe: () => void;
}

export function Display({ expression, result, onSwipe }: DisplayProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const resultMeasureRef = useRef<HTMLSpanElement>(null);
  const expressionMeasureRef = useRef<HTMLSpanElement>(null);

  const resultScale = useFitScale(contentRef, resultMeasureRef, result);
  const expressionScale = useFitScale(contentRef, expressionMeasureRef, expression, 0.55);
  const resultFont = useTransform(resultScale, (s) => `calc(var(--result-size) * ${s})`);
  const expressionFont = useTransform(expressionScale, (s) => `calc(var(--expression-size) * ${s})`);

  // Silme geri bildirimi: sonuç kaydırma yönünde hafifçe itilir ve yayla geri gelir.
  const nudge = useMotionValue(0);
  const swipe = useRef({ id: -1, x: 0, y: 0, done: false });

  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, done: false };
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (s.id !== event.pointerId || s.done) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.4) {
      s.done = true;
      onSwipe();
      animate(nudge, [Math.sign(dx) * 12, 0], { type: 'spring', stiffness: 520, damping: 18 });
    }
  };

  const handleEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (swipe.current.id === event.pointerId) swipe.current.id = -1;
  };

  return (
    <div
      className={styles.panel}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
    >
      <div ref={contentRef} className={styles.content}>
        <motion.div className={styles.expression} style={{ fontSize: expressionFont }}>
          {expression || ' '}
        </motion.div>
        <motion.div className={styles.result} style={{ fontSize: resultFont, x: nudge }} aria-live="polite">
          {result}
        </motion.div>
      </div>

      {/* Tam boyutlu, görünmez ölçüm kopyaları */}
      <span ref={expressionMeasureRef} className={`${styles.expression} ${styles.measure}`} aria-hidden="true">
        {expression}
      </span>
      <span ref={resultMeasureRef} className={`${styles.result} ${styles.measure}`} aria-hidden="true">
        {result}
      </span>
    </div>
  );
}
