import { useMemo } from 'react';
import { createBounceScene } from './bounce/bounceScene';
import { MergeGame } from './merge/MergeGame';
import { GameShell } from './shared/GameShell';
import type { GameId, SceneFactory } from './shared/types';
import { createTestScene } from './testScene';

const GAME_NAMES: Record<GameId, string> = {
  bounce: 'Kalp Sektirme',
  merge: 'Kalp Birleştir',
  stack: 'Kalp Kulesi',
};

interface GameScreenProps {
  id: GameId;
  onExit: () => void;
}

export function GameScreen({ id, onExit }: GameScreenProps) {
  // Henüz yazılmamış oyun (Kalp Kulesi) test sahnesini açar; Aşama 6'da değişecek.
  const createScene = useMemo<SceneFactory>(
    () => (id === 'bounce' ? createBounceScene : createTestScene(GAME_NAMES[id])),
    [id],
  );
  if (id === 'merge') return <MergeGame onExit={onExit} />;
  return <GameShell gameId={id} createScene={createScene} onExit={onExit} />;
}
