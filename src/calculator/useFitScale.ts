import { useSpring, type MotionValue } from 'motion/react';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Metnin kutusuna sığması için 0–1 arası ölçek üretir. Ölçüm, metnin tam boyutlu
 * görünmez bir kopyası üzerinden yapılır; ölçek değişimi yay animasyonuyla yumuşar.
 */
export function useFitScale(
  boxRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  text: string,
  minScale = 0.2,
): MotionValue<number> {
  const scale = useSpring(1, { stiffness: 420, damping: 38 });
  const first = useRef(true);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;

    const update = () => {
      const available = box.clientWidth;
      const natural = measure.scrollWidth;
      if (!available || !natural) return;
      const target = Math.max(minScale, Math.min(1, available / natural));
      if (first.current) {
        scale.jump(target);
        first.current = false;
      } else {
        scale.set(target);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    document.fonts?.ready.then(update).catch(() => undefined);
    return () => observer.disconnect();
  }, [boxRef, measureRef, text, minScale, scale]);

  return scale;
}
