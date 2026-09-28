import { overlayParticles } from './heartBurst';
import { ParticleCanvas } from './ParticleCanvas';
import styles from './HeartBurstLayer.module.css';

/** Tam ekran, dokunmaları engellemeyen, her şeyin üstündeki kalp katmanı. */
export function HeartBurstLayer() {
  return (
    <div className={styles.layer}>
      <ParticleCanvas system={overlayParticles} />
    </div>
  );
}
