import { createBounceScene } from './bounce/bounceScene';
import { MergeGame } from './merge/MergeGame';
import { GameShell } from './shared/GameShell';
import type { GameId } from './shared/types';
import { createStackScene } from './stack/stackScene';

interface GameScreenProps {
  id: GameId;
  onExit: () => void;
}

export function GameScreen({ id, onExit }: GameScreenProps) {
  if (id === 'merge') return <MergeGame onExit={onExit} />;
  const createScene = id === 'bounce' ? createBounceScene : createStackScene;
  return <GameShell gameId={id} createScene={createScene} onExit={onExit} />;
}
