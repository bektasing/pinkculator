import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { onAppPause } from '../../platform/lifecycle';
import { getJSON, removeItem, setJSON } from '../../platform/storage';
import { RoundButton } from '../../ui/RoundButton';
import { GameShell } from '../shared/GameShell';
import { getBest, onRecordChange } from '../shared/records';
import { fromSaved, toSaved, type MergeState } from './logic';
import { createMergeScene, type MergeBridge } from './mergeScene';
import { ScoreBadge } from './ScoreBadge';
import { WinCard } from './WinCard';
import styles from './MergeGame.module.css';

const SAVE_KEY = 'merge:save';
const SAVE_DEBOUNCE_MS = 250;

interface MergeGameProps {
  onExit: () => void;
}

/** Kayıtlı oyunu yükler; yükleme bitince oyunu kaldığı yerden açar. */
export function MergeGame({ onExit }: MergeGameProps) {
  // undefined = yükleniyor, null = kayıt yok
  const [initial, setInitial] = useState<MergeState | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getJSON<unknown>(SAVE_KEY, null).then((saved) => alive && setInitial(fromSaved(saved)));
    return () => {
      alive = false;
    };
  }, []);

  if (initial === undefined) return <div className={styles.loading} />;
  return <LoadedMergeGame initial={initial} onExit={onExit} />;
}

function LoadedMergeGame({ initial, onExit }: { initial: MergeState | null; onExit: () => void }) {
  const [score, setScore] = useState(initial?.score ?? 0);
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [won, setWon] = useState(false);
  const [storedBest, setStoredBest] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getBest('merge').then((b) => alive && setStoredBest(b));
    const off = onRecordChange((id, best) => id === 'merge' && setStoredBest(best));
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Kayıt: hamleler hızlı gelebilir, diske en fazla 250 ms'de bir yazılır.
  const save = useRef<{ pending: MergeState | null | undefined; timer: number }>({ pending: undefined, timer: 0 });
  const flush = () => {
    const s = save.current;
    window.clearTimeout(s.timer);
    if (s.pending === undefined) return;
    const pending = s.pending;
    s.pending = undefined;
    if (pending === null) void removeItem(SAVE_KEY);
    else void setJSON(SAVE_KEY, toSaved(pending));
  };

  useEffect(() => {
    const off = onAppPause(flush);
    return () => {
      off();
      flush();
    };
  }, []);

  const bridge = useRef<MergeBridge>({
    undo: () => undefined,
    continueAfterWin: () => undefined,
    restart: () => undefined,
    onScore: (value, gained) => {
      setScore(value);
      if (gained > 0) setGain((prev) => ({ amount: gained, key: (prev?.key ?? 0) + 1 }));
    },
    onUndoAvailable: setCanUndo,
    onWin: () => setWon(true),
    onSave: (state) => {
      const s = save.current;
      s.pending = state;
      window.clearTimeout(s.timer);
      s.timer = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
  });

  const createScene = useMemo(() => createMergeScene(bridge.current, initial), [initial]);

  const hud = (
    <div className={styles.hud}>
      <ScoreBadge label="Skor" value={score} gain={gain} />
      <ScoreBadge label="En iyi" value={Math.max(score, storedBest ?? 0)} />
      <RoundButton icon="undo" ariaLabel="Geri al" disabled={!canUndo} onPress={() => bridge.current.undo()} />
    </div>
  );

  const overlay = (
    <AnimatePresence>
      {won && (
        <WinCard
          key="win"
          onContinue={() => {
            setWon(false);
            bridge.current.continueAfterWin();
          }}
          onRestart={() => {
            setWon(false);
            bridge.current.restart();
          }}
        />
      )}
    </AnimatePresence>
  );

  return (
    <GameShell gameId="merge" createScene={createScene} onExit={onExit} turnBased hud={hud} overlay={overlay} />
  );
}
