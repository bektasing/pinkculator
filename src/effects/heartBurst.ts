import { BURSTS, HeartParticles } from './particles';

/**
 * Uygulama genelindeki tek kalp parçacık katmanının API'si.
 * HeartBurstLayer bileşeni kendini buraya bağlar; herhangi bir yerden
 * `heartBurst(x, y, 'tap')` çağrılabilir.
 */
export type BurstKind = keyof typeof BURSTS;

export const overlayParticles = new HeartParticles();
let wake: (() => void) | null = null;

export function heartBurst(x: number, y: number, kind: BurstKind = 'tap'): void {
  overlayParticles.burst(x, y, BURSTS[kind]);
  wake?.();
}

export function attachBurstLayer(onWake: () => void): () => void {
  wake = onWake;
  return () => {
    if (wake === onWake) wake = null;
  };
}
