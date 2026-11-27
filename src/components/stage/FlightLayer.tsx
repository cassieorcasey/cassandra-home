import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { appById } from '../../config/apps.config';
import { BOTTOM_BAR_SPRINGS } from '../../config/motion';
import type { Flight } from '../../types/os';

interface Props {
  flight: Flight | null;
  onLanded: (key: number) => void;
}

/**
 * Lapisan penerbangan di luar bilah bawah (portal ke <body>, z 60).
 * backdrop-filter pada bilah menjadi stacking context, jadi cangkang yang terbang
 * tidak boleh tinggal di dalamnya.
 */
export function FlightLayer({ flight, onLanded }: Props) {
  return createPortal(
    <div className="flight-layer" aria-hidden>
      <AnimatePresence>{flight && <FlightShell key={flight.key} flight={flight} onLanded={onLanded} />}</AnimatePresence>
    </div>,
    document.body,
  );
}

function FlightShell({ flight, onLanded }: { flight: Flight; onLanded: (key: number) => void }) {
  const [at, setAt] = useState<'from' | 'to'>('from');
  const done = useRef(false);
  const land = () => {
    if (done.current) return;
    done.current = true;
    onLanded(flight.key);
  };

  useEffect(() => {
    // satu frame di titik asal, lalu pindah ke tujuan → motion menganimasikan box
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setAt('to')));
    const safety = window.setTimeout(land, 1200); // bila layout animation tidak terpicu
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = at === 'from' ? flight.from : flight.to;
  const app = appById(flight.id);
  const icon = Math.min(48, flight.from.w, flight.to.w);

  return (
    <motion.div
      layout
      layoutId={`flight-${flight.id}`}
      className="flight-shell"
      transition={BOTTOM_BAR_SPRINGS.layoutMorph}
      style={{
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: at === 'to' && flight.direction === 'open' ? 18 : 14, // di style → dikoreksi motion
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      onLayoutAnimationComplete={() => at === 'to' && land()}
    >
      {/* layout → skala induk dibalik, ikon tetap persegi */}
      <motion.img layout src={app.icon} alt="" width={icon} height={icon} className="flight-icon" />
    </motion.div>
  );
}
