import { motion } from 'motion/react';
import { HeartRain } from '../../effects/HeartRain';
import { PuffyButton, TextButton } from '../../ui/PuffyButton';
import styles from '../shared/GameOverCard.module.css';
import winStyles from './WinCard.module.css';

interface WinCardProps {
  onContinue: () => void;
  onRestart: () => void;
}

const cardSpring = { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 } as const;

/** 2048'e ulaşınca: altın "2048!" kartı ve kalp yağmuru. Sonsuz devam edilebilir. */
export function WinCard({ onContinue, onRestart }: WinCardProps) {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
    >
      <HeartRain className={styles.rain} duration={2600} />
      <motion.div
        className={styles.card}
        role="dialog"
        aria-label="2048"
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={cardSpring}
      >
        <motion.div
          className={winStyles.title}
          initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 12, delay: 0.1 }}
        >
          2048!
        </motion.div>
        <div className={winStyles.subtitle}>Altın kalbe ulaştın</div>
        <div className={styles.actions}>
          <PuffyButton onPress={onContinue}>Devam et</PuffyButton>
          <TextButton onPress={onRestart}>Yeniden başla</TextButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
