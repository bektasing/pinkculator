import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { usePressable } from '../effects/usePressable';
import styles from './MenuCard.module.css';

interface MenuCardProps {
  title: [string, string];
  record: string;
  art: ReactNode;
  artClassName: string;
  index: number;
  onOpen: (point: { x: number; y: number }) => void;
}

const enterSpring = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 } as const;

export function MenuCard({ title, record, art, artClassName, index, onOpen }: MenuCardProps) {
  const { y, handlers } = usePressable(onOpen);

  return (
    <motion.button
      type="button"
      className={styles.card}
      aria-label={`${title.join(' ')}, ${record}`}
      initial={{ opacity: 0, y: 70, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...enterSpring, delay: 0.14 + index * 0.075 }}
      {...handlers}
    >
      <span className={styles.base} />
      <motion.span className={styles.face} style={{ y }}>
        <span className={styles.text}>
          <span className={styles.title}>
            {title[0]}
            <br />
            {title[1]}
          </span>
          <span className={styles.record}>{record}</span>
        </span>
        <span className={`${styles.art} ${artClassName}`}>{art}</span>
      </motion.span>
    </motion.button>
  );
}
