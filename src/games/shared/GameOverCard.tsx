import { motion } from 'motion/react';
import { HeartRain } from '../../effects/HeartRain';
import { PuffyButton, TextButton } from '../../ui/PuffyButton';
import { formatScore } from './records';
import styles from './GameOverCard.module.css';

interface GameOverCardProps {
  score: number;
  isNewRecord: boolean;
  onRetry: () => void;
  onMenu: () => void;
}

const cardSpring = { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 } as const;

/**
 * Oyun sonu: bulanık arka plan üzerinde krem kart. Yeni rekorda kalp yağmuru
 * yazıların ve butonların ARKASINDA kalır (katman sırası: bulanıklık → yağmur → kart).
 */
export function GameOverCard({ score, isNewRecord, onRetry, onMenu }: GameOverCardProps) {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
    >
      {isNewRecord && <HeartRain className={styles.rain} />}

      <motion.div
        className={styles.card}
        role="dialog"
        aria-label="Oyun bitti"
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={cardSpring}
      >
        <div className={styles.title}>Oyun bitti</div>
        <motion.div
          className={styles.score}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...cardSpring, stiffness: 380, damping: 14, delay: 0.12 }}
        >
          {formatScore(score)}
        </motion.div>
        {isNewRecord && (
          <motion.div
            className={styles.record}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.28 }}
          >
            Yeni rekor!
          </motion.div>
        )}
        <div className={styles.actions}>
          <PuffyButton onPress={onRetry}>Tekrar oyna</PuffyButton>
          <TextButton onPress={onMenu}>Menüye dön</TextButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
