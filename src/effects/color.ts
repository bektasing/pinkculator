/** Küçük renk yardımcıları (hex ↔ rgb, karıştırma). */
export type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  const n = parseInt(value.length === 3 ? [...value].map((c) => c + c).join('') : value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
    : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** a ile b arasında t oranında karışım (0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToCss([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** Pembeye çalan açma / koyulaştırma: gölgeler asla griye kaçmasın. */
export const lighten = (hex: string, t: number) => mix(hex, '#fff6f3', t);
export const darken = (hex: string, t: number) => mix(hex, '#7a3f45', t);
