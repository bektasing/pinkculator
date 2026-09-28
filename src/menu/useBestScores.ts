import { useEffect, useState } from 'react';
import { getAllBest, onRecordChange } from '../games/shared/records';
import type { GameId } from '../games/shared/types';

type Scores = Record<GameId, number | null>;
const EMPTY: Scores = { bounce: null, merge: null, stack: null };

/** Menü kartlarındaki rekorlar; yeni rekor kaydedilince anında güncellenir. */
export function useBestScores(): Scores {
  const [scores, setScores] = useState<Scores>(EMPTY);

  useEffect(() => {
    let alive = true;
    getAllBest().then((all) => alive && setScores(all));
    const off = onRecordChange((id, best) => setScores((prev) => ({ ...prev, [id]: best })));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return scores;
}
