import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { WINDOW_MORPH } from '../../config/motion';
import type { AppId, RectSnapshot } from '../../types/os';
import { AppTile } from '../ui/AppTile';

export interface IconFlightSpec {
  key: number;
  id: AppId;
  /** ikon di tile asal (ukuran penuh ikon tile) */
  from: RectSnapshot;
  /** posisi akhir ikon tab (tabSlotRect) */
  to: RectSnapshot;
}

/** Tinggi busur maksimum di atas garis lurus tile → tab. */
const ARC_MAX = 120;
const SAFETY_MS = 1200;

/**
 * Salinan ikon aplikasi yang terbang dari tile Launchpad ke slot tab-nya di Multitask Bar,
 * berjalan bersamaan dengan morph jendela. Lintasan = kurva Bézier kuadrat dengan titik
 * kendali di atas kedua ujung, digerakkan satu nilai progres berpegas (pegas buka jendela).
 */
export function IconFlight({ flight, onDone }: { flight: IconFlightSpec | null; onDone: (key: number) => void }) {
  const t = useMotionValue(0);

  const f = flight;
  const x0 = f ? f.from.left : 0;
  const y0 = f ? f.from.top : 0;
  const x1 = f ? f.to.left : 0;
  const y1 = f ? f.to.top : 0;
  const s0 = f ? f.from.width / f.to.width : 1;
  const arc = f ? Math.min(ARC_MAX, Math.hypot(x1 - x0, y1 - y0) * 0.25) : 0;
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - arc;
  // titik kiri-atas ikon berukuran akhir; skala dari pusat menjaga pusat tetap di lintasan
  const ox = f ? (f.from.width - f.to.width) / 2 : 0;
  const oy = f ? (f.from.height - f.to.height) / 2 : 0;
  const bez = (a: number, c: number, b: number, k: number) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * c + k * k * b;
  const x = useTransform(t, (k) => bez(x0 + ox, cx + ox / 2, x1, k));
  const y = useTransform(t, (k) => bez(y0 + oy, cy + oy / 2, y1, k));
  const scale = useTransform(t, (k) => s0 + (1 - s0) * k);

  useLayoutEffect(() => {
    if (!f) return;
    t.jump(0);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDone(f.key);
    };
    const c = animate(t, 1, WINDOW_MORPH.open);
    c.then(finish);
    const safety = window.setTimeout(finish, SAFETY_MS);
    return () => {
      done = true;
      c.stop();
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.key]);

  if (!f) return null;
  return createPortal(
    <div className="icon-flight" aria-hidden>
      <motion.span className="icon-flight-tile" style={{ x, y, scale }}>
        <AppTile id={f.id} size={f.to.width} />
      </motion.span>
    </div>,
    document.body,
  );
}
