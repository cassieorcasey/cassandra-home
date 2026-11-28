import { animate, AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WINDOW_MORPH } from '../../config/motion';
import type { Morph } from '../../hooks/useMorph';
import type { Flight } from '../../types/os';
import { AppTile } from '../ui/AppTile';

interface Props {
  flight: Flight | null;
  morph: Morph;
  onLanded: (key: number) => void;
}

const SAFETY_MS = 1400;

/**
 * Lapisan proxy morph (portal ke <body>). Duduk di bawah jendela aktif dan di atas Launchpad
 * dan di bawah Multitask Bar: jendela yang terpotong `clip` memudar masuk/keluar di atasnya, proxy
 * menyediakan permukaan dan ikon aplikasi.
 */
export function FlightLayer({ flight, morph, onLanded }: Props) {
  /** id morph yang sedang bergerak; dipakai untuk mendeteksi interupsi pada aplikasi yang sama */
  const running = useRef<{ id: string; key: number } | null>(null);

  useLayoutEffect(() => {
    if (!flight) {
      running.current = null;
      return;
    }
    const opening = flight.phase === 'opening';
    // Interupsi (mis. tutup saat masih membuka): lanjutkan dari posisi live proxy pada frame ini,
    // bukan melompat ke ujung awal flight yang baru.
    // (key yang sama = efek dijalankan ulang, mis. StrictMode: mulai lagi dari ujung awal)
    const prev = running.current;
    const continuing = !!prev && prev.id === flight.id && prev.key !== flight.key;
    running.current = { id: flight.id, key: flight.key };

    morph.box.set(opening ? flight.to : flight.from);
    if (!continuing) {
      morph.left.jump(flight.from.left);
      morph.top.jump(flight.from.top);
      morph.width.jump(flight.from.width);
      morph.height.jump(flight.from.height);
      morph.radius.jump(flight.from.borderRadius);
      morph.content.jump(opening ? 0 : 1);
    }
    morph.proxy.jump(1);

    const spring = opening ? WINDOW_MORPH.open : WINDOW_MORPH.close;
    const to = flight.to;
    const moves = [
      animate(morph.left, to.left, spring),
      animate(morph.top, to.top, spring),
      animate(morph.width, to.width, spring),
      animate(morph.height, to.height, spring),
      animate(morph.radius, to.borderRadius, spring),
    ];
    // konten: buka → muncul di 40–100 % durasi; tutup → hilang di 35 % pertama
    const fade = opening
      ? animate(morph.content, 1, {
          duration: (WINDOW_MORPH.openMs * 0.6) / 1000,
          delay: continuing ? 0 : (WINDOW_MORPH.openMs * 0.4) / 1000,
          ease: [0.2, 0, 0, 1],
        })
      : animate(morph.content, 0, { duration: (WINDOW_MORPH.closeMs * 0.35) / 1000, ease: [0.4, 0, 1, 1] });
    const vanish = flight.fade ? animate(morph.proxy, 0, { duration: WINDOW_MORPH.closeMs / 1000 }) : null;

    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      onLanded(flight.key); // kunci basi diabaikan reducer
    };
    Promise.all(moves).then(land);
    const safety = window.setTimeout(land, SAFETY_MS);
    return () => {
      done = true; // flight digantikan: yang baru melanjutkan dari nilai live
      clearTimeout(safety);
      fade.stop();
      vanish?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.key]);

  const tileEnd = flight ? (flight.phase === 'opening' ? flight.from : flight.to) : null;
  const icon = tileEnd ? Math.round(Math.min(68, Math.max(28, Math.min(tileEnd.width, tileEnd.height) * 0.55))) : 0;

  return createPortal(
    <div className="flight-layer" aria-hidden>
      <AnimatePresence>
        {flight && (
          <motion.div
            key="proxy"
            className="flight-shell"
            style={{
              x: morph.left,
              y: morph.top,
              width: morph.width,
              height: morph.height,
              borderRadius: morph.radius,
              opacity: morph.proxy,
            }}
            // proxy lenyap saat menyatu dengan kartu (tutup) atau tertutup jendela (buka)
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <motion.span className="flight-icon" style={{ opacity: morph.icon }}>
              <AppTile id={flight.id} size={icon} />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
