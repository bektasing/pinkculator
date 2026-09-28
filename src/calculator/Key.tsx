import { motion } from 'motion/react';
import { useRef, type PointerEvent, type ReactNode } from 'react';
import { usePressSpring } from './usePressSpring';
import styles from './Key.module.css';

export type KeyVariant = 'num' | 'fn' | 'op';

interface KeyProps {
  variant: KeyVariant;
  ariaLabel: string;
  children: ReactNode;
  /** pointerdown anında çağrılır; dokunma noktası (parçacıklar için) ile */
  onPress: (x: number, y: number) => void;
  /** Aktif operatör: renkler ters çevrilir */
  active?: boolean;
  className?: string;
}

const colorSpring = { type: 'spring', stiffness: 380, damping: 32 } as const;

export function Key({ variant, ariaLabel, children, onPress, active = false, className }: KeyProps) {
  const { y, press, release } = usePressSpring();
  const pointers = useRef(new Set<number>());

  const handleDown = (event: PointerEvent<HTMLButtonElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // bazı ortamlarda capture desteklenmeyebilir
    }
    pointers.current.add(event.pointerId);
    press();
    onPress(event.clientX, event.clientY);
  };

  const handleUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size === 0) release();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`${styles.key} ${styles[variant]} ${className ?? ''}`}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
    >
      <motion.span
        className={styles.base}
        initial={false}
        animate={{ backgroundColor: active ? 'var(--key-num-edge)' : 'var(--edge-color)' }}
        transition={colorSpring}
      />
      <motion.span className={styles.face} style={{ y }}>
        {variant === 'op' && (
          <motion.span
            className={styles.inverted}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={colorSpring}
          />
        )}
        <motion.span
          className={styles.glyph}
          initial={false}
          animate={{ color: active ? 'var(--key-op)' : 'var(--glyph)' }}
          transition={colorSpring}
        >
          {children}
        </motion.span>
      </motion.span>
    </button>
  );
}
