/**
 * Canvas'ı kapsayıcısının boyutuna ve devicePixelRatio'ya göre keskin çizime hazırlar.
 * Boyut değişince yeniden kurar. Bağlam her zaman CSS pikseli koordinatlarıyla çizer.
 */
export interface CanvasSurface {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  ratio: number;
  /** Çizime başlamadan önce: DPR ölçeğini uygula ve tuvali temizle */
  begin: () => void;
  dispose: () => void;
}

const MAX_RATIO = 3;

export function setupCanvas(
  canvas: HTMLCanvasElement,
  onResize?: (width: number, height: number) => void,
): CanvasSurface | null {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;
  const container = canvas.parentElement ?? canvas;

  const surface: CanvasSurface = {
    ctx,
    width: 0,
    height: 0,
    ratio: 1,
    begin() {
      ctx.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
      ctx.clearRect(0, 0, surface.width, surface.height);
    },
    dispose() {
      observer.disconnect();
    },
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
    if (width === surface.width && height === surface.height && ratio === surface.ratio) return;
    surface.width = width;
    surface.height = height;
    surface.ratio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.imageSmoothingQuality = 'high';
    onResize?.(width, height);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return surface;
}
