import { motion } from 'motion/react';
import { formatRecordLabel } from '../games/shared/records';
import type { GameId } from '../games/shared/types';
import { RoundButton } from '../ui/RoundButton';
import { BounceArt } from './art/BounceArt';
import { MergeArt } from './art/MergeArt';
import { StackArt } from './art/StackArt';
import { MenuCard } from './MenuCard';
import { Sparkles } from './Sparkles';
import { useBestScores } from './useBestScores';
import styles from './GamesMenu.module.css';

interface GamesMenuProps {
  onBack: () => void;
  onOpenGame: (id: GameId, origin: { x: number; y: number }) => void;
  /** Üstünde oyun açıkken: animasyonları durdur, çizimi atla */
  covered?: boolean;
}

const GAMES: { id: GameId; title: [string, string]; art: JSX.Element; artClass: string }[] = [
  { id: 'bounce', title: ['Kalp', 'Sektirme'], art: <BounceArt />, artClass: styles.artBounce ?? '' },
  { id: 'merge', title: ['Kalp', 'Birleştir'], art: <MergeArt />, artClass: styles.artMerge ?? '' },
  { id: 'stack', title: ['Kalp', 'Kulesi'], art: <StackArt />, artClass: styles.artStack ?? '' },
];

export function GamesMenu({ onBack, onOpenGame, covered = false }: GamesMenuProps) {
  const best = useBestScores();

  return (
    <div className={`${styles.root} ${covered ? styles.covered : ''}`}>
      <header className={styles.header}>
        <motion.div
          className={styles.sparkles}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.2 }}
        >
          <Sparkles className={styles.sparklesSvg} />
        </motion.div>
        <RoundButton icon="back" ariaLabel="Hesap makinesine dön" onPress={onBack} className={styles.back} />
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.06 }}
        >
          Oyunlar
        </motion.h1>
      </header>

      <div className={styles.cards}>
        {GAMES.map((game, index) => (
          <MenuCard
            key={game.id}
            index={index}
            title={game.title}
            record={formatRecordLabel(best[game.id])}
            art={game.art}
            artClassName={game.artClass}
            onOpen={(point) => onOpenGame(game.id, point)}
          />
        ))}
      </div>
    </div>
  );
}
