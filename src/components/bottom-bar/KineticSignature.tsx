import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BOTTOM_BAR_SPRINGS, DOCK_GEOMETRY } from '../../config/motion';
import { SIGNATURE, useSignatureWidths } from '../../hooks/useFontReady';
import { gaussianX, pointer, targetOf, useProximityTarget } from '../../hooks/usePointerProximity';

const G = DOCK_GEOMETRY.signature;
const M = DOCK_GEOMETRY.magnet;
let entered = false; // entrance hanya sekali per kunjungan

interface Props {
  /** Ripple, magnet & percepatan kilau aktif (mode Home). */
  interactive: boolean;
  reduced: boolean;
}

const lite = () => document.documentElement.dataset.perf === 'lite';

export function KineticSignature({ interactive, reduced }: Props) {
  const widths = useSignatureWidths();
  const boxRef = useProximityTarget<HTMLSpanElement>('sig-box');
  const animate = !reduced && interactive;

  // ---- kilau: progres digerakkan sendiri, kecepatan lewat pegas → tidak pernah melompat
  const progress = useMotionValue(0.25);
  const speedTarget = useMotionValue(1);
  const speed = useSpring(speedTarget, BOTTOM_BAR_SPRINGS.shimmerSpeed);
  useAnimationFrame((_, dt) => {
    if (reduced || lite()) return;
    if (interactive) {
      const t = targetOf('sig-box');
      const x = pointer.x.get();
      const y = pointer.y.get();
      const near = !!t && !Number.isNaN(x) && Math.hypot(x - t.cx, y - t.cy) < M.radius;
      speedTarget.set(near ? 2.5 : 1);
    }
    progress.set((progress.get() + (dt / 8000) * speed.get()) % 1);
  });

  // ---- tarikan magnetik wadah
  const magX = useTransform([pointer.x, pointer.y], ([x, y]: number[]) => {
    if (!animate) return 0;
    const t = targetOf('sig-box');
    if (!t || Number.isNaN(x) || Math.hypot(x - t.cx, y - t.cy) > M.radius) return 0;
    return Math.max(-M.maxX, Math.min(M.maxX, (x - t.cx) * M.kx));
  });
  const magY = useTransform([pointer.x, pointer.y], ([x, y]: number[]) => {
    if (!animate) return 0;
    const t = targetOf('sig-box');
    if (!t || Number.isNaN(x) || Math.hypot(x - t.cx, y - t.cy) > M.radius) return 0;
    return Math.max(-M.maxY, Math.min(M.maxY, (y - t.cy) * M.ky));
  });
  const sx = useSpring(magX, BOTTOM_BAR_SPRINGS.magneticSignature);
  const sy = useSpring(magY, BOTTOM_BAR_SPRINGS.magneticSignature);

  const total = widths ? widths.reduce((a, b) => a + b, 0) : 0;
  const offsets = useMemo(() => {
    let acc = 0;
    return (widths ?? []).map((w) => {
      const o = acc;
      acc += w;
      return o;
    });
  }, [widths]);

  const [firstEntry] = useState(() => !entered);
  useEffect(() => {
    entered = true;
  }, []);

  return (
    <motion.span ref={boxRef} className="sig" data-ready={widths ? '' : undefined} style={{ x: sx, y: sy }}>
      <span className="sig-letters" aria-hidden>
        {SIGNATURE.map((ch, i) => (
          <motion.span
            key={i}
            className="sig-slot"
            style={widths ? { width: widths[i] } : undefined}
            initial={firstEntry ? (reduced ? { opacity: 0 } : { opacity: 0, y: 14, rotate: 4 }) : false}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={
              reduced
                ? { duration: 0.16 }
                : { type: 'spring', stiffness: 380, damping: 24, delay: 0.15 + i * 0.035 }
            }
          >
            <Glyph
              ch={ch}
              i={i}
              ripple={animate && !!widths}
              progress={progress}
              total={total}
              offset={offsets[i] ?? 0}
            />
          </motion.span>
        ))}
      </span>
      <span className="sr-only">Cassandra</span>
    </motion.span>
  );
}

interface GlyphProps {
  ch: string;
  i: number;
  ripple: boolean;
  progress: MotionValue<number>;
  total: number;
  offset: number;
}

function Glyph({ ch, i, ripple, progress, total, offset }: GlyphProps) {
  const key = `sig-${i}`;
  const ref = useProximityTarget<HTMLSpanElement>(key);
  const rippleRef = useRef(ripple);
  rippleRef.current = ripple;

  const raw = useTransform([pointer.x, pointer.y], ([x, y]: number[]) => {
    if (!rippleRef.current || lite()) return 1 / 3; // bobot diam 600
    const t = targetOf(key);
    if (!t || Number.isNaN(y) || Math.abs(y - t.cy) > G.activateY) return 0;
    return gaussianX(key, G.sigma, x);
  });
  const f = useSpring(raw, BOTTOM_BAR_SPRINGS.magneticSignature);
  const fvs = useTransform(f, (v) => {
    const w = G.wMin + (G.wMax - G.wMin) * v;
    return `'wght' ${Math.round(w / G.wStep) * G.wStep}`;
  });
  const y = useTransform(f, (v) => (rippleRef.current ? -G.liftMax * v : 0));
  // gradasi kontinu lintas huruf: tiap glyph menggeser latar sebesar ofset kirinya
  const bgX = useTransform(progress, (p) => `${-(p * 2 * total) - offset}px`);

  return (
    <motion.span
      ref={ref}
      className="sig-glyph"
      style={{
        fontVariationSettings: fvs,
        y,
        ...(total ? { backgroundPositionX: bgX, backgroundSize: `${2 * total}px 100%` } : null),
      }}
    >
      {ch}
    </motion.span>
  );
}
