/**
 * Uygulamanın tek kalp şekli: dolgun, yuvarlak uçlu.
 * 100 × 90 birimlik kutuda tanımlı; SVG'de `d` olarak, canvas'ta Path2D olarak kullanılır.
 */
export const HEART_VIEWBOX = { width: 100, height: 90 } as const;

export const HEART_PATH =
  'M50 17 C54.5 8.5 62 3 71.5 3 C87 3 98 15.5 98 32 C98 55 69 74 56 82.5 ' +
  'C52.5 84.8 47.5 84.8 44 82.5 C31 74 2 55 2 32 C2 15.5 13 3 28.5 3 C38 3 45.5 8.5 50 17 Z';

let cachedPath: Path2D | null = null;

export function heartPath2D(): Path2D {
  cachedPath ??= new Path2D(HEART_PATH);
  return cachedPath;
}
