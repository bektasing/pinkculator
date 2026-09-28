/**
 * Sabit zaman adımlı oyun döngüsü (60 Hz güncelleme + interpolasyonlu çizim).
 * Oyun mantığı her zaman aynı `step` ile ilerler; ekran yenileme hızından bağımsızdır.
 * `render(alpha)` son iki güncelleme arasındaki konumu (0–1) bildirir.
 */
export interface LoopCallbacks {
  update: (dt: number) => void;
  render: (alpha: number) => void;
}

export interface LoopOptions {
  step?: number;
  /** Bir karede en fazla kaç güncelleme yapılır (yavaş cihazda "ölüm sarmalı" olmasın) */
  maxStepsPerFrame?: number;
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface GameLoop {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
  /** Test ve duraklatılmış çizim için: tek kare işle */
  frame: (time: number) => void;
}

export const FIXED_STEP = 1 / 60;

export function createGameLoop(callbacks: LoopCallbacks, options: LoopOptions = {}): GameLoop {
  const step = options.step ?? FIXED_STEP;
  const maxSteps = options.maxStepsPerFrame ?? 5;
  const now = options.now ?? (() => performance.now());
  const requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((h) => cancelAnimationFrame(h));

  let running = false;
  let handle = 0;
  let last = 0;
  let accumulator = 0;

  const frame = (time: number) => {
    const elapsed = Math.max(0, (time - last) / 1000);
    last = time;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= step && steps < maxSteps) {
      callbacks.update(step);
      accumulator -= step;
      steps++;
    }
    // Yetişilemeyen zaman atılır: oyun yavaşlar ama asla ışınlanmaz.
    if (steps === maxSteps && accumulator >= step) accumulator = 0;

    callbacks.render(accumulator / step);
  };

  const tick = (time: number) => {
    if (!running) return;
    frame(time);
    handle = requestFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      // Duraklatmadan dönüşte geçen süre hiç sayılmaz: kalp "kendiliğinden düşmez".
      last = now();
      accumulator = 0;
      handle = requestFrame(tick);
    },
    stop() {
      running = false;
      cancelFrame(handle);
    },
    get running() {
      return running;
    },
    frame,
  };
}
