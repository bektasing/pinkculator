import { motion } from 'motion/react';
import { usePressable } from '../effects/usePressable';
import styles from './RoundButton.module.css';

interface RoundButtonProps {
  icon: 'back' | 'close';
  ariaLabel: string;
  onPress: () => void;
  className?: string;
}

/** Yuvarlak, puffy krem buton (menüde geri, oyunda kapat). */
export function RoundButton({ icon, ariaLabel, onPress, className }: RoundButtonProps) {
  const { y, handlers } = usePressable(onPress, 4);
  return (
    <button type="button" aria-label={ariaLabel} className={`${styles.button} ${className ?? ''}`} {...handlers}>
      <span className={styles.base} />
      <motion.span className={styles.face} style={{ y }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {icon === 'back' ? (
            <path d="M14.5 6.5L9 12l5.5 5.5" />
          ) : (
            <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          )}
        </svg>
      </motion.span>
    </button>
  );
}
