import { BURSTS, HeartParticles } from './particles';

/**
 * Uygulama genelindeki kalp parçacık katmanının API'si. HeartBurstLayer bu
 * sistemi çizer; herhangi bir yerden `heartBurst(x, y, 'tap')` çağrılabilir.
 */
export type BurstKind = keyof typeof BURSTS;

export const overlayParticles = new HeartParticles();

export function heartBurst(x: number, y: number, kind: BurstKind = 'tap'): void {
  overlayParticles.burst(x, y, BURSTS[kind]);
}
