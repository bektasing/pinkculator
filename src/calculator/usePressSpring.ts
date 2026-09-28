import { animate, useMotionValue, type MotionValue } from 'motion/react';
import { useCallback, useRef } from 'react';
import { prefersReducedMotion } from '../effects/reducedMotion';

/** Tuşun basılınca ineceği mesafe (px). Kalınlık kenarı 6px; basınca 1px kalır. */
export const PRESS_DEPTH = 5;

// Basış: neredeyse anında (gecikme hissi olmasın). Bırakış: hafif sekmeli yay.
const DOWN = { type: 'spring', stiffness: 1800, damping: 70, mass: 0.6 } as const;
const UP = { type: 'spring', stiffness: 620, damping: 15, mass: 0.7 } as const;
// Hareketi azalt açıkken sekme olmadan yerine oturur.
const UP_REDUCED = { type: 'spring', stiffness: 620, damping: 40, mass: 0.7 } as const;

export interface PressSpring {
  y: MotionValue<number>;
  press: () => void;
  release: () => void;
}

export function usePressSpring(depth = PRESS_DEPTH): PressSpring {
  const y = useMotionValue(0);
  const controls = useRef<ReturnType<typeof animate> | null>(null);

  const press = useCallback(() => {
    controls.current?.stop();
    controls.current = animate(y, depth, DOWN);
  }, [y, depth]);

  const release = useCallback(() => {
    controls.current?.stop();
    controls.current = animate(y, 0, prefersReducedMotion() ? UP_REDUCED : UP);
  }, [y]);

  return { y, press, release };
}
