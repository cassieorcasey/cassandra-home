import { animate, AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WINDOW_MORPH } from '../../config/motion';
import { union, type Morph } from '../../hooks/useMorph';
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

    const box = opening ? flight.to : flight.from;
    // lanjutan: berangkat dari rect yang terlihat sekarang (tanpa lompatan), progres mulai lagi dari 0
    const start = continuing ? morph.current() : flight.from;
    morph.t.jump(0);
    morph.setup(start, flight.to, box, union(flight.from, flight.to));
    if (!continuing) morph.content.jump(opening ? 0 : 1);
    morph.proxy.jump(1);

    const spring = opening ? WINDOW_MORPH.open : WINDOW_MORPH.close;
    const move = animate(morph.t, 1, spring);
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
    move.then(land);
    const safety = window.setTimeout(land, SAFETY_MS);
    return () => {
      done = true; // flight digantikan: yang baru melanjutkan dari rect live
      clearTimeout(safety);
      move.stop();
      fade.stop();
      vanish?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.key]);

  /** kotak proxy: gabungan kedua ujung flight (rect lanjutan saat interupsi selalu di antaranya) */
  const shell = flight ? union(flight.from, flight.to) : null;
  const tileEnd = flight ? (flight.phase === 'opening' ? flight.from : flight.to) : null;
  const icon = tileEnd ? Math.round(Math.min(68, Math.max(28, Math.min(tileEnd.width, tileEnd.height) * 0.55))) : 0;

  return createPortal(
    <div className="flight-layer" aria-hidden>
      <AnimatePresence>
        {flight && (
          <motion.div
            key="proxy"
            className="flight-shell"
            // kotak tetap seukuran jendela; yang bergerak hanya clip-path (tanpa layout per frame)
            style={{
              left: shell?.left ?? 0,
              top: shell?.top ?? 0,
              width: shell?.width ?? 0,
              height: shell?.height ?? 0,
              clipPath: morph.shellClip,
              opacity: morph.proxy,
            }}
            // proxy lenyap saat menyatu dengan kartu (tutup) atau tertutup jendela (buka)
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <motion.span
              className="flight-icon"
              style={{ opacity: morph.icon, x: morph.cx, y: morph.cy, marginLeft: -icon / 2, marginTop: -icon / 2 }}
            >
              <AppTile id={flight.id} size={icon} />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
