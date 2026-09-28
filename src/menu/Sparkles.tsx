import { HEART_PATH } from '../effects/heartShape';
import styles from './Sparkles.module.css';

// Konumlar design/games-menu.png'den (390 px genişlikte, ekranın üstüne göre) ölçüldü.
const STARS: [number, number, number][] = [
  [125, 50, 5],
  [250, 53, 9],
  [330, 103, 9],
  [305, 87, 3.5],
  [61, 130, 7],
  [112, 116, 4],
  [170, 65, 2.5],
  [207, 82, 2.5],
  [356, 158, 4],
];

const HEARTS: [number, number, number][] = [
  [144, 88, 8], [169, 115, 6], [264, 108, 6], [307, 125, 8], [350, 134, 6],
  [63, 160, 9], [80, 184, 7], [111, 188, 6], [95, 200, 7], [138, 185, 5],
  [170, 206, 6], [224, 200, 7], [246, 190, 5], [279, 202, 6], [313, 186, 9],
  [336, 172, 6], [354, 182, 7], [40, 148, 5],
];

function starPath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

/** Başlığın etrafındaki soluk kalpler ve yavaşça parıldayan yıldızlar. */
export function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 30 390 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      {HEARTS.map(([x, y, s], i) => (
        <path
          key={`h${i}`}
          className={styles.heart}
          d={HEART_PATH}
          transform={`translate(${x - (s * 1.4) / 2} ${y - s * 1.4 * 0.45}) scale(${(s * 1.4) / 100})`}
          style={{ animationDelay: `${(i * 0.37) % 3}s` }}
        />
      ))}
      {STARS.map(([x, y, r], i) => (
        <path
          key={`s${i}`}
          className={styles.star}
          d={starPath(x, y, r * 1.45)}
          style={{ animationDelay: `${(i * 0.53) % 2.6}s`, animationDuration: `${2.4 + (i % 3) * 0.6}s` }}
        />
      ))}
    </svg>
  );
}
