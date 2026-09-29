import { AnimatePresence, motion, type Transition } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { nextSecretMessage, type SecretEntry } from '../calculator/secretCode';
import { HeartBurstLayer } from '../effects/HeartBurstLayer';
import { GameScreen } from '../games/GameScreen';
import { LoveScreen } from '../love/LoveScreen';
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
  // Gizli ekrandan dönünce hesap makinesi sıfırdan başlar (yeni bileşen = yeni durum).
  const [calculatorKey, setCalculatorKey] = useState(0);

  const openMenu = useCallback((origin: Point) => setScreen({ name: 'menu', origin }), []);
  const closeMenu = useCallback(() => setScreen({ name: 'calculator' }), []);
  const openGame = useCallback(
    (id: GameId, gameOrigin: Point) =>
      setScreen((current) => (current.name === 'menu' ? { name: 'game', id, origin: current.origin, gameOrigin } : current)),
    [],
  );
  const openSecret = useCallback((origin: Point, entry: SecretEntry) => {
    const message = nextSecretMessage(entry);
    setScreen({ name: 'love', origin, entry, message });
  }, []);
  const closeSecret = useCallback(() => {
    setCalculatorKey((key) => key + 1);
    setScreen({ name: 'calculator' });
  }, []);
  const closeGame = useCallback(() => {
    setGameCoversMenu(false);
    setScreen((current) => (current.name === 'game' ? { name: 'menu', origin: current.origin } : current));
  }, []);

  // Android geri tuşu: oyun → menü → hesap makinesi → (işlenmez, uygulama arka plana gider);
  // gizli ekran → hesap makinesi
  useEffect(
    () =>
      registerBackHandler(() => {
        if (screen.name === 'love') {
          closeSecret();
          return true;
        }
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
    [screen, closeGame, closeMenu, closeSecret],
  );

  const menuOrigin = screen.name === 'menu' || screen.name === 'game' ? screen.origin : null;
  const love = screen.name === 'love' ? screen : null;
  const game = screen.name === 'game' ? screen : null;

  return (
    <div className={styles.app}>
      <div className={styles.screen} aria-hidden={screen.name !== 'calculator'}>
        <CalculatorScreen key={calculatorKey} onOpenMenu={openMenu} onOpenSecret={openSecret} />
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

      <AnimatePresence>
        {love && (
          <motion.div key="love" className={styles.screen} style={{ zIndex: 4 }} {...revealProps(love.origin)}>
            <LoveScreen entry={love.entry} message={love.message} onClose={closeSecret} />
          </motion.div>
        )}
      </AnimatePresence>

      <HeartBurstLayer />
    </div>
  );
}
