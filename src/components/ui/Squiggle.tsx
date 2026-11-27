import { motion } from 'motion/react';
import { useId } from 'react';

const HALVES = 10; // lima gelombang penuh (puncak + lembah)
const HALF = 294 / HALVES;

/** Gelombang dari x = 3 sampai tepat 297, diam setelah tergambar. */
function wavePath() {
  let d = `M 3 9 Q ${3 + HALF / 2} 3 ${3 + HALF} 9`;
  for (let k = 2; k <= HALVES; k++) d += ` T ${+(3 + k * HALF).toFixed(2)} 9`;
  return d;
}
const D = wavePath();

/**
 * Garis bergelombang di bawah kata "cassandra".
 * Tergambar sekali dari kiri ke kanan saat halaman dibuka, lalu diam.
 */
export function Squiggle({ reduced }: { reduced: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="squiggle" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden>
      <defs>
        {/* gradasi yang sama dengan teks "cassandra" */}
        <linearGradient id={`${id}-g`} x1="0" x2="300" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--brand-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-b)' }} />
        </linearGradient>
      </defs>
      <motion.path
        d={D}
        stroke={`url(#${id}-g)`}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.7, ease: [0.2, 0, 0, 1], opacity: { duration: 0.01, delay: 0.7 } }}
      />
    </svg>
  );
}
