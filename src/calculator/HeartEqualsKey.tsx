import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useId, useRef, type PointerEvent } from 'react';
import { heartBurst } from '../effects/heartBurst';
import { HEART_PATH } from '../effects/heartShape';
import { prefersReducedMotion } from '../effects/reducedMotion';
import { impactHeavy, impactLight, impactMedium } from '../platform/haptics';
import { usePressSpring } from './usePressSpring';
import styles from './HeartEqualsKey.module.css';

/** Gizli menü için basılı tutma süresi */
export const HOLD_TO_OPEN_MS = 3000;
/** Bu süreden önce dolum görünmez (normal kısa basışlarda titreme olmasın) */
const HOLD_GRACE_MS = 300;
/** Parmak tuş alanının bu kadar dışına çıkarsa dolum iptal olur */
const CANCEL_MARGIN_PX = 28;
/** Kalp atışı aralığı: dolum ilerledikçe hızlanır */
const BEAT_SLOW_MS = 640;
const BEAT_FAST_MS = 170;
/** Patlamadan sonra menü geçişine kadar kısa bekleme */
const MENU_DELAY_MS = 160;

interface HeartEqualsKeyProps {
  /** Kısa basış (veya tamamlanmamış dolum) bırakıldığında */
  onEquals: () => void;
  /** 3 saniye dolunca; kalbin ekrandaki merkezi ile */
  onOpenMenu: (origin: { x: number; y: number }) => void;
}

type HoldPhase = 'idle' | 'holding' | 'opened' | 'cancelled';

const fillSpringBack = { type: 'spring', stiffness: 260, damping: 30 } as const;

export function HeartEqualsKey({ onEquals, onOpenMenu }: HeartEqualsKeyProps) {
  const uid = useId().replace(/:/g, '');
  const ids = {
    body: `hb-${uid}`,
    edge: `he-${uid}`,
    rim: `hr-${uid}`,
    fill: `hf-${uid}`,
    clip: `hc-${uid}`,
    gloss: `hg-${uid}`,
    blur: `hbl-${uid}`,
    soft: `hs-${uid}`,
  };

  const { y, press, release } = usePressSpring();
  const pulse = useMotionValue(1);
  const fill = useMotionValue(0); // 0 → 1
  const fillY = useTransform(fill, (v) => 86 - v * 88);
  const fillOpacity = useTransform(fill, [0, 0.04, 1], [0, 0.72, 0.85]);

  const rootRef = useRef<HTMLButtonElement>(null);
  const hold = useRef({
    phase: 'idle' as HoldPhase,
    pointerId: -1,
    start: 0,
    nextBeat: 0,
    frame: 0,
    timeout: 0,
  });

  // Callback'ler her render'da değişebilir; rAF döngüsü en güncelini kullansın.
  const callbacks = useRef({ onEquals, onOpenMenu });
  callbacks.current = { onEquals, onOpenMenu };

  useEffect(() => {
    const h = hold.current;
    return () => {
      cancelAnimationFrame(h.frame);
      window.clearTimeout(h.timeout);
    };
  }, []);

  const heartCenter = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.45 } : { x: 0, y: 0 };
  };

  const beat = (progress: number) => {
    const peak = prefersReducedMotion() ? 1.02 : 1.06 + progress * 0.05;
    animate(pulse, [pulse.get(), peak, 1], { duration: 0.24, ease: [0.2, 0.7, 0.3, 1] });
    impactLight();
  };

  const stopHoldLoop = () => {
    cancelAnimationFrame(hold.current.frame);
    hold.current.frame = 0;
  };

  const drainFill = () => {
    animate(fill, 0, fillSpringBack);
    animate(pulse, 1, fillSpringBack);
  };

  const tick = (now: number) => {
    const h = hold.current;
    if (h.phase !== 'holding') return;
    const elapsed = now - h.start;

    if (elapsed >= HOLD_TO_OPEN_MS) {
      completeHold();
      return;
    }

    if (elapsed > HOLD_GRACE_MS) {
      const progress = (elapsed - HOLD_GRACE_MS) / (HOLD_TO_OPEN_MS - HOLD_GRACE_MS);
      fill.set(progress);
      if (now >= h.nextBeat) {
        beat(progress);
        h.nextBeat = now + BEAT_SLOW_MS - (BEAT_SLOW_MS - BEAT_FAST_MS) * Math.pow(progress, 0.8);
      }
    }
    h.frame = requestAnimationFrame(tick);
  };

  const completeHold = () => {
    const h = hold.current;
    h.phase = 'opened';
    stopHoldLoop();
    impactHeavy();
    const origin = heartCenter();
    heartBurst(origin.x, origin.y, 'grand');
    animate(pulse, [1.18, 1], { type: 'spring', stiffness: 300, damping: 14 });
    release();
    animate(fill, 0, { ...fillSpringBack, delay: 0.25 });
    h.timeout = window.setTimeout(() => callbacks.current.onOpenMenu(origin), MENU_DELAY_MS);
  };

  const cancelHold = () => {
    const h = hold.current;
    if (h.phase !== 'holding') return;
    h.phase = 'cancelled';
    stopHoldLoop();
    release();
    drainFill();
  };

  const handleDown = (event: PointerEvent<HTMLButtonElement>) => {
    const h = hold.current;
    if (h.phase === 'holding') return; // ikinci parmak yok sayılır
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // yok say
    }
    h.phase = 'holding';
    h.pointerId = event.pointerId;
    h.start = performance.now();
    h.nextBeat = h.start + HOLD_GRACE_MS;
    press();
    impactMedium();
    heartBurst(event.clientX, event.clientY, 'equals');
    h.frame = requestAnimationFrame(tick);
  };

  const handleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const h = hold.current;
    if (h.phase !== 'holding' || event.pointerId !== h.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const outside =
      event.clientX < rect.left - CANCEL_MARGIN_PX ||
      event.clientX > rect.right + CANCEL_MARGIN_PX ||
      event.clientY < rect.top - CANCEL_MARGIN_PX ||
      event.clientY > rect.bottom + CANCEL_MARGIN_PX;
    if (outside) cancelHold();
  };

  const handleUp = (event: PointerEvent<HTMLButtonElement>) => {
    const h = hold.current;
    if (event.pointerId !== h.pointerId) return;
    h.pointerId = -1;
    if (h.phase === 'holding') {
      // Menü açılmadıysa = normal çalışır (dolum başlamış olsa bile).
      stopHoldLoop();
      release();
      drainFill();
      callbacks.current.onEquals();
    }
    h.phase = 'idle';
  };

  const handleCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== hold.current.pointerId) return;
    cancelHold();
    hold.current.pointerId = -1;
    hold.current.phase = 'idle';
  };

  return (
    <button
      ref={rootRef}
      type="button"
      aria-label="Eşittir"
      className={styles.key}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleCancel}
    >
      <motion.span className={styles.heart} style={{ scale: pulse }}>
        {/* Sabit katman: yumuşak pembe gölge + koyu kalınlık */}
        <svg className={styles.layer} viewBox="-4 -4 108 108" aria-hidden="true">
          <defs>
            <filter id={ids.blur} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
            <linearGradient id={ids.edge} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bd7277" />
              <stop offset="1" stopColor="var(--key-eq-edge)" />
            </linearGradient>
          </defs>
          <path d={HEART_PATH} transform="translate(-1 11)" fill="var(--key-shadow)" opacity="0.7" filter={`url(#${ids.blur})`} />
          <path d={HEART_PATH} transform="translate(0 6)" fill={`url(#${ids.edge})`} />
        </svg>

        {/* Basılınca inen yüz */}
        <motion.svg className={styles.layer} viewBox="-4 -4 108 108" style={{ y }} aria-hidden="true">
          <defs>
            <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--key-eq-top)" />
              <stop offset="0.38" stopColor="var(--key-eq-mid)" />
              <stop offset="1" stopColor="var(--key-eq-bottom)" />
            </linearGradient>
            <radialGradient id={ids.rim} cx="0.46" cy="0.36" r="0.64">
              <stop offset="0.55" stopColor="#fff6f3" stopOpacity="0" />
              <stop offset="1" stopColor="#7a3f45" stopOpacity="0.28" />
            </radialGradient>
            <linearGradient id={ids.fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb9bd" />
              <stop offset="0.5" stopColor="#fb9fa6" />
              <stop offset="1" stopColor="#ee8a93" />
            </linearGradient>
            <radialGradient id={ids.gloss} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="var(--key-eq-gloss)" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="var(--key-eq-gloss)" stopOpacity="0.5" />
              <stop offset="1" stopColor="var(--key-eq-gloss)" stopOpacity="0" />
            </radialGradient>
            <filter id={ids.soft} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <clipPath id={ids.clip}>
              <path d={HEART_PATH} />
            </clipPath>
          </defs>

          <path d={HEART_PATH} fill={`url(#${ids.body})`} />
          <g clipPath={`url(#${ids.clip})`}>
            {/* Basılı tutma dolumu: alttan yukarı açık, parlak ton */}
            <motion.g style={{ y: fillY, opacity: fillOpacity }}>
              <rect x="0" y="0" width="100" height="92" fill={`url(#${ids.fill})`} />
              {/* Dolumun parlak yüzeyi */}
              <ellipse cx="50" cy="0.5" rx="54" ry="2.6" fill="#fff1ef" opacity="0.75" filter={`url(#${ids.soft})`} />
            </motion.g>
            <rect x="0" y="0" width="100" height="90" fill={`url(#${ids.rim})`} />
            {/* Alttan yansıyan yumuşak ışık */}
            <ellipse cx="56" cy="70" rx="24" ry="9" fill="#ffc9c8" opacity="0.32" filter={`url(#${ids.soft})`} />
            {/* Lob parlamaları */}
            <ellipse cx="28" cy="22" rx="19" ry="11.5" transform="rotate(-30 28 22)" fill={`url(#${ids.gloss})`} />
            <ellipse cx="24" cy="19" rx="6.5" ry="3.8" transform="rotate(-30 24 19)" fill="var(--key-eq-gloss)" opacity="0.85" filter={`url(#${ids.soft})`} />
            <ellipse cx="74" cy="15" rx="9" ry="4.6" transform="rotate(22 74 15)" fill={`url(#${ids.gloss})`} opacity="0.75" />
          </g>

          {/* "=" işareti */}
          <g>
            <rect x="33.5" y="37.4" width="33" height="7.6" rx="3.8" fill="#8f4c55" opacity="0.3" />
            <rect x="33.5" y="50.4" width="33" height="7.6" rx="3.8" fill="#8f4c55" opacity="0.3" />
            <rect x="33.5" y="35.8" width="33" height="7.6" rx="3.8" fill="var(--on-op)" />
            <rect x="33.5" y="48.8" width="33" height="7.6" rx="3.8" fill="var(--on-op)" />
          </g>
        </motion.svg>
      </motion.span>
    </button>
  );
}
