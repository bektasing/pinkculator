import type { HeartParticles } from '../../effects/particles';
import type { Insets } from '../../platform/safeArea';

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
  /** Oyun sırasında güncel skor; rekor geçilirse anında kaydedilir (2048 gibi uzun oyunlar için) */
  reportScore: (score: number) => void;
  /** Oyun canvas'ında çizilecek ortak kalp parçacıkları (hesap makinesiyle aynı görünüm) */
  particles: HeartParticles;
  /** Güncel safe area boşlukları (px); sahne resize'da okur */
  insets: () => Insets;
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
