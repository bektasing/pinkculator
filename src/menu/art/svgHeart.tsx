import { HEART_PATH } from '../../effects/heartShape';

/**
 * SVG illüstrasyonlarda kullanılan hacimli kalp. `ids` ortak gradient'lere işaret eder
 * (bkz. HeartDefs); böylece her kalp için ayrı filtre/gradient gerekmez.
 */
export interface HeartDefIds {
  shine: string;
  gloss: string;
}

export function HeartDefs({ ids }: { ids: HeartDefIds }) {
  return (
    <>
      <linearGradient id={ids.shine} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff6f3" stopOpacity="0.5" />
        <stop offset="0.45" stopColor="#fff6f3" stopOpacity="0" />
        <stop offset="1" stopColor="#7a3f45" stopOpacity="0.28" />
      </linearGradient>
      <radialGradient id={ids.gloss}>
        <stop offset="0" stopColor="#fffaf7" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#fffaf7" stopOpacity="0.45" />
        <stop offset="1" stopColor="#fffaf7" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

interface SvgHeartProps {
  ids: HeartDefIds;
  cx: number;
  cy: number;
  size: number;
  fill: string;
  rotate?: number;
  className?: string;
}

export function SvgHeart({ ids, cx, cy, size, fill, rotate = 0, className }: SvgHeartProps) {
  const s = size / 100;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(${s}) translate(-50 -44)`} className={className}>
      <path d={HEART_PATH} fill={fill} />
      <path d={HEART_PATH} fill={`url(#${ids.shine})`} />
      <ellipse cx="29" cy="22" rx="17" ry="10" transform="rotate(-32 29 22)" fill={`url(#${ids.gloss})`} />
      <ellipse cx="73" cy="16" rx="7" ry="3.5" transform="rotate(22 73 16)" fill={`url(#${ids.gloss})`} opacity="0.6" />
    </g>
  );
}

export function useArtIds(uid: string) {
  const clean = uid.replace(/:/g, '');
  return (name: string) => `${name}-${clean}`;
}
