import { AnimatePresence, motion } from 'motion/react';
import { formatScore } from '../shared/records';
import styles from './ScoreBadge.module.css';

interface ScoreBadgeProps {
  label: string;
  value: number;
  /** Skor artışı: rozetin altından "+32" yukarı süzülür (her artışta yeni anahtar) */
  gain?: { amount: number; key: number } | null;
}

/** Küçük puffy skor rozeti ("Skor", "En iyi"). */
export function ScoreBadge({ label, value, gain }: ScoreBadgeProps) {
  return (
    <div className={styles.badge}>
      <span className={styles.base} />
      <span className={styles.face}>
        <span className={styles.label}>{label}</span>
        <motion.span
          key={value}
          className={styles.value}
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        >
          {formatScore(value)}
        </motion.span>
      </span>
      <AnimatePresence>
        {gain && gain.amount > 0 && (
          <motion.span
            key={gain.key}
            className={styles.gain}
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: -30, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.3, 1] }}
          >
            +{formatScore(gain.amount)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
