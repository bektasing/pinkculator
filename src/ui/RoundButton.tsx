import { motion } from 'motion/react';
import { usePressable } from '../effects/usePressable';
import styles from './RoundButton.module.css';

interface RoundButtonProps {
  icon: 'back' | 'close' | 'undo';
  ariaLabel: string;
  onPress: () => void;
  className?: string;
  disabled?: boolean;
}

/** Yuvarlak, puffy krem buton (menüde geri, oyunda kapat). */
export function RoundButton({ icon, ariaLabel, onPress, className, disabled = false }: RoundButtonProps) {
  const { y, handlers } = usePressable(onPress, 4);
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={`${styles.button} ${className ?? ''}`}
      initial={false}
      animate={{ opacity: disabled ? 0.45 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      {...(disabled ? {} : handlers)}
    >
      <span className={styles.base} />
      <motion.span className={styles.face} style={{ y }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {icon === 'back' && <path d="M14.5 6.5L9 12l5.5 5.5" />}
          {icon === 'close' && <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />}
          {icon === 'undo' && <path d="M9 7.2L5.4 10.6 9 14M5.8 10.6h7.4a4.6 4.6 0 010 9.2H10.6" />}
        </svg>
      </motion.span>
    </motion.button>
  );
}
