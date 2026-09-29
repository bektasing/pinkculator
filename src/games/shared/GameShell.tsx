import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { playSound } from '../../audio/sounds';
import { HeartParticles } from '../../effects/particles';
import { impactHeavy, impactMedium, notifySuccess } from '../../platform/haptics';
import { onAppPause, onAppResume } from '../../platform/lifecycle';
import { getSafeAreaInsets } from '../../platform/safeArea';
import { RoundButton } from '../../ui/RoundButton';
import { setupCanvas } from './canvas';
import { GameOverCard } from './GameOverCard';
import { createGameLoop, type GameLoop } from './loop';
import { formatBest, getBest, isNewRecord, submitScore } from './records';
import type { GameId, GamePointer, GameScene, SceneFactory } from './types';
import styles from './GameShell.module.css';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

interface GameShellProps {
  gameId: GameId;
  createScene: SceneFactory;
  onExit: () => void;
  /** Sağ üstteki "EN İYİ" göstergesi (2048 kendi rozetlerini gösterir) */
  showBest?: boolean;
  /**
   * Sıra tabanlı oyun (2048): "Başlamak için dokun" ve "Duraklatıldı" ekranları yok;
   * oyun hemen başlar, arka plandan dönünce kaldığı yerden devam eder.
   */
  turnBased?: boolean;
  /** Üst çubuğun sağ tarafı (EN İYİ yerine), ör. skor rozetleri */
  hud?: ReactNode;
  /** Oyuna özel üst katman (ör. "2048!" kartı) */
  overlay?: ReactNode;
}

interface Result {
  score: number;
  best: number | null;
  isNew: boolean;
}

const softSpring = { type: 'spring', stiffness: 260, damping: 28 } as const;

export function GameShell({ gameId, createScene, onExit, showBest = true, turnBased = false, hud, overlay }: GameShellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  const initialPhase: Phase = turnBased ? 'playing' : 'ready';
  const [phase, setPhaseState] = useState<Phase>(initialPhase);
  const phaseRef = useRef<Phase>(initialPhase);
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const [best, setBestState] = useState<number | null>(null);
  const bestRef = useRef<number | null>(null);
  /** Bu oyun başladığındaki rekor: "Yeni rekor!" buna göre belirlenir. */
  const bestAtStartRef = useRef<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const setBest = (value: number | null) => {
    bestRef.current = value;
    setBestState(value);
  };

  useEffect(() => {
    let alive = true;
    getBest(gameId).then((value) => {
      if (!alive) return;
      // Yükleme sürerken oyun rekoru geçtiyse büyük olan kalır.
      const merged = Math.max(value ?? 0, bestRef.current ?? 0) || null;
      bestAtStartRef.current = value;
      setBest(merged);
    });
    return () => {
      alive = false;
    };
  }, [gameId]);

  /** Oyun sırasında skor rekoru geçerse anında kaydedilir (uygulama kapansa da kaybolmaz). */
  const reportScore = useCallback(
    (score: number) => {
      if (!isNewRecord(score, bestRef.current)) return;
      setBest(score);
      void submitScore(gameId, score);
    },
    [gameId],
  );

  const finish = useCallback(
    (score: number) => {
      if (phaseRef.current === 'over') return;
      setPhase('over');
      loopRef.current?.stop();
      const isNew = isNewRecord(score, bestAtStartRef.current);
      submitScore(gameId, score).then(({ best: newBest }) => {
        const shown = Math.max(newBest ?? 0, bestRef.current ?? 0) || null;
        setBest(shown);
        setResult({ score, best: shown, isNew });
        if (isNew) {
          impactHeavy();
          notifySuccess();
          playSound('record');
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
    const scene = createScene({ particles, gameOver: finish, reportScore, insets: getSafeAreaInsets });
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
    if (turnBased) scene.start();
    loop.start();

    // Arka plana gidince duraklat; geri gelince gerçek zamanlı oyun "duraklatıldı"
    // ekranında bekler, sıra tabanlı oyun kaldığı yerden devam eder.
    const offPause = onAppPause(() => {
      loop.stop();
      if (phaseRef.current === 'playing' && !turnBased) setPhase('paused');
      draw(1);
    });
    const offResume = onAppResume(() => {
      if (phaseRef.current === 'ready' || (turnBased && phaseRef.current === 'playing')) loop.start();
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
  }, [createScene, finish, reportScore, turnBased]);

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
    bestAtStartRef.current = bestRef.current;
    sceneRef.current?.reset();
    setResult(null);
    if (turnBased) {
      setPhase('playing');
      sceneRef.current?.start();
    } else {
      setPhase('ready');
    }
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
        {hud}
        {!hud && showBest && (
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

      {overlay}
    </div>
  );
}
