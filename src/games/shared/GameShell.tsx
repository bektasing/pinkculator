import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { HeartParticles } from '../../effects/particles';
import { impactHeavy, impactMedium, notifySuccess } from '../../platform/haptics';
import { onAppPause, onAppResume } from '../../platform/lifecycle';
import { RoundButton } from '../../ui/RoundButton';
import { setupCanvas } from './canvas';
import { GameOverCard } from './GameOverCard';
import { createGameLoop, type GameLoop } from './loop';
import { formatBest, getBest, submitScore } from './records';
import type { GameId, GamePointer, GameScene, SceneFactory } from './types';
import styles from './GameShell.module.css';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

interface GameShellProps {
  gameId: GameId;
  createScene: SceneFactory;
  onExit: () => void;
  /** Sağ üstteki "EN İYİ" göstergesi (2048 kendi rozetlerini gösterir) */
  showBest?: boolean;
}

interface Result {
  score: number;
  best: number | null;
  isNew: boolean;
}

const softSpring = { type: 'spring', stiffness: 260, damping: 28 } as const;

export function GameShell({ gameId, createScene, onExit, showBest = true }: GameShellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  const [phase, setPhaseState] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const [best, setBest] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    getBest(gameId).then((value) => alive && setBest(value));
    return () => {
      alive = false;
    };
  }, [gameId]);

  const finish = useCallback(
    (score: number) => {
      if (phaseRef.current === 'over') return;
      setPhase('over');
      loopRef.current?.stop();
      submitScore(gameId, score).then(({ best: newBest, isNew }) => {
        setBest(newBest);
        setResult({ score, best: newBest, isNew });
        if (isNew) {
          impactHeavy();
          notifySuccess();
        } else {
          impactMedium();
        }
      });
    },
    [gameId],
  );

  // Sahne, canvas ve döngü kurulumu
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles = new HeartParticles();
    const scene = createScene({ particles, gameOver: finish });
    sceneRef.current = scene;

    let surface: ReturnType<typeof setupCanvas> = null;
    const draw = (alpha: number) => {
      if (!surface) return;
      surface.begin();
      scene.render(surface.ctx, alpha);
    };
    surface = setupCanvas(canvas, (width, height) => {
      scene.resize(width, height);
      if (!loopRef.current?.running) draw(1);
    });

    const loop = createGameLoop({ update: (dt) => scene.update(dt), render: draw });
    loopRef.current = loop;
    loop.start();

    // Arka plana gidince duraklat; geri gelince oyun "duraklatıldı" ekranında bekler.
    const offPause = onAppPause(() => {
      loop.stop();
      if (phaseRef.current === 'playing') setPhase('paused');
      draw(1);
    });
    const offResume = onAppResume(() => {
      if (phaseRef.current === 'ready') loop.start();
    });

    return () => {
      offPause();
      offResume();
      loop.stop();
      surface?.dispose();
      scene.dispose?.();
      particles.clear();
      sceneRef.current = null;
      loopRef.current = null;
    };
  }, [createScene, finish]);

  const toPointer = (event: PointerEvent<HTMLDivElement>): GamePointer => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDown = (event: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    const loop = loopRef.current;
    if (!scene || !loop) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // yok say
    }

    switch (phaseRef.current) {
      case 'over':
        return;
      case 'paused':
        setPhase('playing');
        loop.start();
        return; // devam dokunuşu oyuna girdi sayılmaz
      case 'ready':
        scene.start();
        setPhase('playing');
        if (!loop.running) loop.start();
        break;
    }
    scene.pointerDown?.(toPointer(event));
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current === 'playing') sceneRef.current?.pointerMove?.(toPointer(event));
  };

  const handleUp = (event: PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current === 'playing') sceneRef.current?.pointerUp?.(toPointer(event));
  };

  const retry = () => {
    sceneRef.current?.reset();
    setResult(null);
    setPhase('ready');
    loopRef.current?.start();
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.area}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <div className={styles.topBar}>
        <RoundButton icon="close" ariaLabel="Menüye dön" onPress={onExit} className={styles.close} />
        {showBest && (
          <div className={styles.best} aria-label={`En iyi skor ${best ?? 0}`}>
            <span className={styles.bestLabel}>EN İYİ</span>
            <span className={styles.bestValue}>{formatBest(best)}</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'ready' && (
          <motion.div
            key="ready"
            className={styles.hint}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={softSpring}
          >
            <motion.span
              animate={{ opacity: [0.9, 0.45, 0.9] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Başlamak için dokun
            </motion.span>
          </motion.div>
        )}

        {phase === 'paused' && (
          <motion.div
            key="paused"
            className={styles.paused}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={softSpring}
          >
            <span className={styles.pausedTitle}>Duraklatıldı</span>
            <span className={styles.pausedHint}>Devam etmek için dokun</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <GameOverCard key="over" score={result.score} isNewRecord={result.isNew} onRetry={retry} onMenu={onExit} />
        )}
      </AnimatePresence>
    </div>
  );
}
