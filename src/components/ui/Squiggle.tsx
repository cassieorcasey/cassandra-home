import { motion } from 'motion/react';
import { useId } from 'react';

const PERIOD = 72; // satu gelombang penuh (puncak + lembah) dalam satuan viewBox
const HALF = PERIOD / 2;

/** Gelombang dari x = -PERIOD sampai 300 + 2·PERIOD agar geser satu periode tidak pernah memperlihatkan ujung. */
function wavePath() {
  let d = `M ${-PERIOD} 10 Q ${-PERIOD + HALF / 2} 2 ${-PERIOD + HALF} 10`;
  for (let x = -PERIOD + PERIOD; x <= 300 + 2 * PERIOD; x += HALF) d += ` T ${x} 10`;
  return d;
}
const D = wavePath();

/**
 * Garis bergelombang di bawah judul "Cassandra".
 * Tergambar sekali saat dimuat, lalu ombaknya mengalir ke kiri (2,4 detik per gelombang).
 * Yang bergerak hanya transform pada mask; gradasinya diam di tempat.
 */
export function Squiggle({ reduced }: { reduced: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="squiggle" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="300" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--squiggle-a)', stopOpacity: 0 }} />
          <stop offset="0.05" style={{ stopColor: 'var(--squiggle-a)' }} />
          <stop offset="0.95" style={{ stopColor: 'var(--squiggle-b)' }} />
          <stop offset="1" style={{ stopColor: 'var(--squiggle-b)', stopOpacity: 0 }} />
        </linearGradient>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="18">
          <g className={reduced ? undefined : 'squiggle-flow'}>
            <motion.path
              d={D}
              stroke="#fff"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: 0.55, ease: [0.2, 0, 0, 1] }}
            />
          </g>
        </mask>
      </defs>
      <rect width="300" height="18" fill={`url(#${id}-g)`} mask={`url(#${id}-m)`} />
    </svg>
  );
}
