import { useId } from 'react';
import { mix } from '../../effects/color';
import { HEART_PATH } from '../../effects/heartShape';
import { HeartDefs, SvgHeart, useArtIds } from './svgHeart';
import styles from './art.module.css';

const PAD = 8;
const CELL = 26;
const GAP = 3;

// Kenardaki 12 hücrenin kalp renkleri (satır, sütun); ortadaki 2×2 altın kalbe ayrılmış.
const RING: [number, number, string][] = [
  [0, 0, '#c9727f'], [0, 1, '#f3bcc0'], [0, 2, '#e38d99'], [0, 3, '#c26a79'],
  [1, 0, '#f3bcc0'], [1, 3, '#e8939f'],
  [2, 0, '#e38d99'], [2, 3, '#f5c7ca'],
  [3, 0, '#e8939f'], [3, 1, '#d27d8a'], [3, 2, '#f5c7ca'], [3, 3, '#c26a79'],
];

const pos = (i: number) => PAD + i * (CELL + GAP);

/** Kalp Birleştir: pembe zeminli 4×4 minik ızgara, ortada parıldayan altın kalp. */
export function MergeArt() {
  const id = useArtIds(useId());
  const ids = { shine: id('shine'), gloss: id('gloss') };
  const gold = id('gold');
  const shimmer = id('shimmer');
  const clip = id('clip');
  const cellShine = id('cellShine');
  const big = 2 * CELL + GAP;
  const center = pos(1) + big / 2;
  const goldSize = 44;

  return (
    <svg viewBox="0 0 131 134" className={styles.art} aria-hidden="true">
      <defs>
        <HeartDefs ids={ids} />
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4bd" />
          <stop offset="0.3" stopColor="#f5cf52" />
          <stop offset="0.66" stopColor="#d49620" />
          <stop offset="1" stopColor="#8f5d0e" />
        </linearGradient>
        <linearGradient id={shimmer} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fffbe8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={cellShine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf7" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fffaf7" stopOpacity="0" />
          <stop offset="1" stopColor="#7a3f45" stopOpacity="0.12" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={HEART_PATH} transform={`translate(${center - goldSize / 2} ${center - goldSize * 0.44}) scale(${goldSize / 100})`} />
        </clipPath>
      </defs>

      {/* Tahta: açık çerçeve, koyu pembe iç zemin */}
      <rect x="1" y="7" width="129" height="126" rx="15" fill="#d9929c" />
      <rect x="1" y="1" width="129" height="127" rx="15" fill="#f7d4d4" />
      <rect x="5" y="5" width="121" height="119" rx="11" fill="#eaaab2" />

      {/* Kenar hücreleri: zemin rengi kalbin açık tonu */}
      {RING.map(([r, c, color]) => (
        <g key={`${r}-${c}`}>
          <rect x={pos(c)} y={pos(r) + 2} width={CELL} height={CELL} rx="6" fill={mix(color, '#7a3f45', 0.18)} />
          <rect x={pos(c)} y={pos(r)} width={CELL} height={CELL} rx="6" fill={mix(color, '#fff6f3', 0.48)} />
          <rect x={pos(c)} y={pos(r)} width={CELL} height={CELL} rx="6" fill={`url(#${cellShine})`} />
          <SvgHeart ids={ids} cx={pos(c) + CELL / 2} cy={pos(r) + CELL / 2 + 0.5} size={20} fill={color} />
        </g>
      ))}

      {/* Ortadaki büyük hücre ve altın kalp */}
      <rect x={pos(1)} y={pos(1) + 2.2} width={big} height={big} rx="10" fill="#e3a7ad" />
      <rect x={pos(1)} y={pos(1)} width={big} height={big} rx="10" fill="#fce3e1" />
      <rect x={pos(1)} y={pos(1)} width={big} height={big} rx="10" fill={`url(#${cellShine})`} />
      <g className={styles.goldHeart}>
        <SvgHeart ids={ids} cx={center} cy={center} size={goldSize} fill={`url(#${gold})`} />
        <g clipPath={`url(#${clip})`}>
          <rect className={styles.shimmer} x={center - 36} y={center - 32} width="16" height="64" fill={`url(#${shimmer})`} transform={`rotate(20 ${center} ${center})`} />
        </g>
      </g>
    </svg>
  );
}
