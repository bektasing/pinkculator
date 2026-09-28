import { AnimatePresence, motion, type Transition } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { HeartBurstLayer } from '../effects/HeartBurstLayer';
import { GameScreen } from '../games/GameScreen';
import { GamesMenu } from '../menu/GamesMenu';
import { registerBackHandler } from '../platform/backButton';
import type { GameId, Point, Screen } from './screens';
import styles from './App.module.css';

const revealSpring: Transition = { type: 'spring', stiffness: 150, damping: 26, mass: 1 };

/** Ekranlar dokunulan noktadan büyüyen bir daire olarak açılır ve oraya geri küçülür. */
function circle(origin: Point, radius: number): string {
  return `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
}

function coverRadius(origin: Point): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 24;
}

function revealProps(origin: Point) {
  return {
    variants: {
      hidden: { clipPath: circle(origin, 0) },
      shown: { clipPath: circle(origin, coverRadius(origin)) },
    },
    initial: 'hidden',
    animate: 'shown',
    exit: 'hidden',
    transition: revealSpring,
  };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'calculator' });
  // Oyun ekranı tamamen açılınca alttaki menü çizilmez (animasyonları da durur).
  const [gameCoversMenu, setGameCoversMenu] = useState(false);

  const openMenu = useCallback((origin: Point) => setScreen({ name: 'menu', origin }), []);
  const closeMenu = useCallback(() => setScreen({ name: 'calculator' }), []);
  const openGame = useCallback(
    (id: GameId, gameOrigin: Point) =>
      setScreen((current) => (current.name === 'menu' ? { name: 'game', id, origin: current.origin, gameOrigin } : current)),
    [],
  );
  const closeGame = useCallback(() => {
    setGameCoversMenu(false);
    setScreen((current) => (current.name === 'game' ? { name: 'menu', origin: current.origin } : current));
  }, []);

  // Android geri tuşu: oyun → menü → hesap makinesi → (işlenmez, uygulama arka plana gider)
  useEffect(
    () =>
      registerBackHandler(() => {
        if (screen.name === 'game') {
          closeGame();
          return true;
        }
        if (screen.name === 'menu') {
          closeMenu();
          return true;
        }
        return false;
      }),
    [screen, closeGame, closeMenu],
  );

  const menuOrigin = screen.name === 'calculator' ? null : screen.origin;
  const game = screen.name === 'game' ? screen : null;

  return (
    <div className={styles.app}>
      <div className={styles.screen} aria-hidden={screen.name !== 'calculator'}>
        <CalculatorScreen onOpenMenu={openMenu} />
      </div>

      <AnimatePresence>
        {menuOrigin && (
          <motion.div key="menu" className={styles.screen} style={{ zIndex: 2 }} {...revealProps(menuOrigin)}>
            <GamesMenu onBack={closeMenu} onOpenGame={openGame} covered={gameCoversMenu} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {game && (
          <motion.div
            key={`game:${game.id}`}
            className={styles.screen}
            style={{ zIndex: 3 }}
            {...revealProps(game.gameOrigin)}
            onAnimationComplete={(definition) => {
              if (definition === 'shown') setGameCoversMenu(true);
            }}
          >
            <GameScreen id={game.id} onExit={closeGame} />
          </motion.div>
        )}
      </AnimatePresence>

      <HeartBurstLayer />
    </div>
  );
}
