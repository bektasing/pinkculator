import type { HeartParticles } from '../../effects/particles';

export type GameId = 'bounce' | 'merge' | 'stack';

export const GAME_IDS: readonly GameId[] = ['bounce', 'merge', 'stack'];

export interface GamePointer {
  id: number;
  /** Oyun alanına göre CSS pikseli */
  x: number;
  y: number;
}

/** GameShell'in sahneye verdiği bağlam. */
export interface SceneContext {
  /** Oyun sonu: sahne kendi kapanış animasyonunu bitirdikten sonra çağırır. */
  gameOver: (finalScore: number) => void;
  /** Oyun canvas'ında çizilecek ortak kalp parçacıkları (hesap makinesiyle aynı görünüm) */
  particles: HeartParticles;
}

/**
 * Her oyunun uygulaması gereken arayüz. React'tan bağımsızdır; GameShell onu
 * sabit adımlı döngüyle sürer. Koordinatlar CSS pikseli cinsindendir.
 */
export interface GameScene {
  resize: (width: number, height: number) => void;
  /** "Başlamak için dokun" sonrası ilk dokunuşta */
  start: () => void;
  /** Sabit adım (saniye) */
  update: (dt: number) => void;
  /** alpha: son iki güncelleme arasındaki interpolasyon oranı */
  render: (ctx: CanvasRenderingContext2D, alpha: number) => void;
  /** Tekrar oyna: başlangıç durumuna dön */
  reset: () => void;
  pointerDown?: (pointer: GamePointer) => void;
  pointerMove?: (pointer: GamePointer) => void;
  pointerUp?: (pointer: GamePointer) => void;
  dispose?: () => void;
}

export type SceneFactory = (context: SceneContext) => GameScene;
