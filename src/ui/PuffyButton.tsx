import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { usePressable } from '../effects/usePressable';
import styles from './PuffyButton.module.css';

interface PuffyButtonProps {
  children: ReactNode;
  onPress: () => void;
  className?: string;
}

/** Gül kurusu, hap şeklinde puffy ana eylem butonu ("Tekrar oyna"). */
export function PuffyButton({ children, onPress, className }: PuffyButtonProps) {
  const { y, handlers } = usePressable(onPress);
  return (
    <button type="button" className={`${styles.button} ${className ?? ''}`} {...handlers}>
      <span className={styles.base} />
      <motion.span className={styles.face} style={{ y }}>
        {children}
      </motion.span>
    </button>
  );
}

/** Sade metin butonu ("Menüye dön"). */
export function TextButton({ children, onPress, className }: PuffyButtonProps) {
  const { y, handlers } = usePressable(onPress, 2);
  return (
    <button type="button" className={`${styles.text} ${className ?? ''}`} {...handlers}>
      <motion.span style={{ y, display: 'block' }}>{children}</motion.span>
    </button>
  );
}
