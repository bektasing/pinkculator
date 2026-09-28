import { AnimatePresence, motion, type Transition } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { HeartBurstLayer } from '../effects/HeartBurstLayer';
import { registerBackHandler } from '../platform/backButton';
import { PlaceholderScreen } from './PlaceholderScreen';
import type { Point, Screen } from './screens';
import styles from './App.module.css';

const revealSpring: Transition = { type: 'spring', stiffness: 150, damping: 26, mass: 1 };

/** Menü, kalbin olduğu noktadan büyüyen bir daire olarak açılır ve oraya geri küçülür. */
function circle(origin: Point, radius: number): string {
  return `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
}

function coverRadius(origin: Point): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 24;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'calculator' });

  const openMenu = useCallback((origin: Point) => setScreen({ name: 'menu', origin }), []);
  const closeMenu = useCallback(() => setScreen({ name: 'calculator' }), []);

  // Android geri tuşu: oyun → menü → hesap makinesi → (işlenmez, uygulama arka plana gider)
  useEffect(
    () =>
      registerBackHandler(() => {
        if (screen.name === 'game') {
          setScreen({ name: 'menu', origin: screen.origin });
          return true;
        }
        if (screen.name === 'menu') {
          setScreen({ name: 'calculator' });
          return true;
        }
        return false;
      }),
    [screen],
  );

  const menuOrigin = screen.name === 'calculator' ? null : screen.origin;

  return (
    <div className={styles.app}>
      <div className={styles.screen} aria-hidden={screen.name !== 'calculator'}>
        <CalculatorScreen onOpenMenu={openMenu} />
      </div>

      <AnimatePresence>
        {menuOrigin && (
          <motion.div
            key="menu"
            className={styles.screen}
            style={{ zIndex: 2 }}
            initial={{ clipPath: circle(menuOrigin, 0) }}
            animate={{ clipPath: circle(menuOrigin, coverRadius(menuOrigin)) }}
            exit={{ clipPath: circle(menuOrigin, 0) }}
            transition={revealSpring}
          >
            <PlaceholderScreen title="Oyunlar" onBack={closeMenu} />
          </motion.div>
        )}
      </AnimatePresence>

      <HeartBurstLayer />
    </div>
  );
}
