import { useId } from 'react';
import { HEART_PATH } from '../../effects/heartShape';
import { HeartDefs, useArtIds } from './svgHeart';
import styles from './art.module.css';

/** Kalp Sektirme: çubuğun üstünde zıplayan hacimli kalp, hareket çizgileriyle. */
export function BounceArt() {
  const id = useArtIds(useId());
  const ids = { shine: id('shine'), gloss: id('gloss') };
  const heartFill = id('heart');
  const paddleFill = id('paddle');

  return (
    <svg viewBox="0 0 130 145" className={styles.art} aria-hidden="true">
      <defs>
        <HeartDefs ids={ids} />
        <linearGradient id={heartFill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fac8cc" />
          <stop offset="0.4" stopColor="#f1a2ab" />
          <stop offset="1" stopColor="#d07482" />
        </linearGradient>
        <linearGradient id={paddleFill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dc8f97" />
          <stop offset="1" stopColor="#c06b75" />
        </linearGradient>
      </defs>

      {/* Hareket çizgileri */}
      <g className={styles.lines} fill="none" stroke="#96495a" strokeWidth="3.6" strokeLinecap="round">
        <path d="M106 12 q8 5 9 15" />
        <path d="M114 5 q10 7 11 20" />
        <path d="M4 70 q9 -5 18 1" />
        <path d="M8 80 q7 -4 14 1" />
        <path d="M44 103 q-3 -6 -8 -10" />
        <path d="M56 101 q0 -7 3 -12" />
        <path d="M70 104 q3 -6 8 -9" />
      </g>

      {/* Çubuk */}
      <g className={styles.paddle}>
        <rect x="14" y="116" width="92" height="22" rx="11" fill="#a85d64" />
        <rect x="14" y="112" width="92" height="21" rx="10.5" fill={`url(#${paddleFill})`} />
        <rect x="26" y="115" width="62" height="4" rx="2" fill="#fff6f3" opacity="0.35" />
      </g>

      {/* Zıplayan kalp */}
      <g className={styles.bounceHeart}>
        <g transform="translate(62 44) rotate(-10) scale(0.8) translate(-50 -44)">
          <path d={HEART_PATH} fill={`url(#${heartFill})`} />
          <path d={HEART_PATH} fill={`url(#${ids.shine})`} />
          <ellipse cx="29" cy="22" rx="18" ry="11" transform="rotate(-32 29 22)" fill={`url(#${ids.gloss})`} />
          <ellipse cx="73" cy="16" rx="8" ry="4" transform="rotate(22 73 16)" fill={`url(#${ids.gloss})`} opacity="0.7" />
        </g>
      </g>
    </svg>
  );
}
