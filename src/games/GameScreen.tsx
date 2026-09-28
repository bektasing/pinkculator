import { useMemo } from 'react';
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
  // Aşama 4–6'da her oyun kendi sahnesiyle değiştirilecek.
  const createScene = useMemo<SceneFactory>(() => createTestScene(GAME_NAMES[id]), [id]);
  return <GameShell gameId={id} createScene={createScene} onExit={onExit} />;
}
