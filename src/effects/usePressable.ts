import { useRef, type PointerEvent } from 'react';
import { usePressSpring, PRESS_DEPTH } from './usePressSpring';

/** Parmak butonun bu kadar dışına kayarsa basış iptal olur */
const CANCEL_MARGIN_PX = 24;

/**
 * Navigasyon butonları ve kartlar için basış davranışı: görsel tepki pointerdown
 * anında, eylem parmak butonun üstündeyken kalkınca. Dışarı kayınca iptal.
 */
export function usePressable(onActivate: (point: { x: number; y: number }) => void, depth = PRESS_DEPTH) {
  const { y, press, release } = usePressSpring(depth);
  const active = useRef<number | null>(null);

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (active.current !== null) return;
      active.current = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // yok say
      }
      press();
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (active.current !== event.pointerId) return;
      const r = event.currentTarget.getBoundingClientRect();
      const outside =
        event.clientX < r.left - CANCEL_MARGIN_PX ||
        event.clientX > r.right + CANCEL_MARGIN_PX ||
        event.clientY < r.top - CANCEL_MARGIN_PX ||
        event.clientY > r.bottom + CANCEL_MARGIN_PX;
      if (outside) {
        active.current = null;
        release();
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (active.current !== event.pointerId) return;
      active.current = null;
      release();
      onActivate({ x: event.clientX, y: event.clientY });
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      if (active.current !== event.pointerId) return;
      active.current = null;
      release();
    },
  };

  return { y, handlers };
}
