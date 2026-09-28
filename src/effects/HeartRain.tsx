import { useEffect, useState } from 'react';
import { ParticleCanvas } from './ParticleCanvas';
import { BURSTS, HeartParticles } from './particles';
import { prefersReducedMotion } from './reducedMotion';

interface HeartRainProps {
  /** Yağmurun sürdüğü süre (ms); kalpler bundan sonra da düşmeye devam eder */
  duration?: number;
  className?: string;
}

/** Ekranın üstünden yağan kalpler (yeni rekor, 2048 vb.). Kapsayıcısını doldurur. */
export function HeartRain({ duration = 2200, className }: HeartRainProps) {
  const [system] = useState(() => new HeartParticles());

  useEffect(() => {
    const interval = prefersReducedMotion() ? 140 : 45;
    const start = performance.now();
    const timer = window.setInterval(() => {
      if (performance.now() - start > duration) {
        window.clearInterval(timer);
        return;
      }
      const width = window.innerWidth;
      system.burst(Math.random() * width, -30 - Math.random() * 30, BURSTS.rain);
    }, interval);
    return () => window.clearInterval(timer);
  }, [system, duration]);

  return <ParticleCanvas system={system} className={className} />;
}
