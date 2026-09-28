import { useId } from 'react';
import { darken, lighten } from '../../effects/color';
import { HeartDefs, SvgHeart, useArtIds } from './svgHeart';
import styles from './art.module.css';

// Alttan üste: [merkez x, genişlik, eğim°, renk] — zikzak kaymış, hafif eğik pastel bloklar
const BLOCKS: [number, number, number, string][] = [
  [50, 70, 2, '#ee9fab'],
  [42, 66, -4, '#f7d1d5'],
  [54, 72, 4, '#f0a8b3'],
  [41, 68, -3.5, '#f5c2c8'],
  [53, 70, 3.5, '#f3b1ba'],
  [44, 64, -3, '#f8d7da'],
  [50, 60, 2, '#f3b9c0'],
];
const BLOCK_H = 16.5;
const STEP = 19;
const BOTTOM = 140;

/** Kalp Kulesi: üst üste dizilmiş hafif kaymış bloklar, tepede küçük bir kalp. */
export function StackArt() {
  const id = useArtIds(useId());
  const ids = { shine: id('shine'), gloss: id('gloss') };
  const topIndex = BLOCKS.length - 1;
  const [topX] = BLOCKS[topIndex] ?? [48];
  const topY = BOTTOM - topIndex * STEP;

  return (
    <svg viewBox="0 0 96 160" className={styles.art} aria-hidden="true">
      <defs>
        <HeartDefs ids={ids} />
      </defs>

      {BLOCKS.map(([cx, w, tilt, color], i) => {
        const y = BOTTOM - i * STEP;
        const x = cx - w / 2;
        return (
          <g key={i} transform={`rotate(${tilt} ${cx} ${y + BLOCK_H / 2})`}>
            <rect x={x} y={y + 4} width={w} height={BLOCK_H} rx="7" fill={darken(color, 0.28)} />
            <rect x={x} y={y} width={w} height={BLOCK_H} rx="7" fill={color} />
            <rect x={x} y={y} width={w} height={BLOCK_H * 0.55} rx="7" fill={lighten(color, 0.45)} opacity="0.55" />
            <rect x={x + 8} y={y + 2.6} width={w * 0.5} height="2.4" rx="1.2" fill="#fffaf7" opacity="0.7" />
          </g>
        );
      })}

      <g className={styles.topHeart} style={{ transformOrigin: `${topX}px ${topY}px` }}>
        <SvgHeart ids={ids} cx={topX} cy={topY - 12} size={26} fill="#ec98a1" />
      </g>
    </svg>
  );
}
