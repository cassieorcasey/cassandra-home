import { AnimatePresence, motion, useAnimate, useSpring, useTransform, type MotionValue } from 'motion/react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { BOTTOM_BAR_SPRINGS, DOCK_GEOMETRY } from '../../config/motion';
import { gaussianX, pointer, targetOf, useProximityTarget } from '../../hooks/usePointerProximity';
import type { CassandraApp, Rect, WindowLifecycle } from '../../types/os';
import { AppTile } from '../ui/AppTile';

export interface DockAppItemProps {
  app: CassandraApp;
  state: WindowLifecycle;
  bounceToken: number | undefined;
  tabIndex: 0 | -1;
  touch: boolean;
  reduced: boolean;
  /** x jari selama scrub (NaN = tidak ada). */
  touchX: MotionValue<number>;
  /** Slot yang sedang di bawah jari saat scrub; tooltip ditampilkan. */
  scrubbed: boolean;
  onActivate: (origin: Rect) => void;
  onFocusItem: () => void;
}

const labelFor = (app: CassandraApp, s: WindowLifecycle) =>
  s.phase === 'closed' ? `Buka ${app.name}` : s.phase === 'active' ? `${app.name}, sedang dibuka` : `Pindah ke ${app.name}`;

export const DockAppItem = forwardRef<HTMLButtonElement, DockAppItemProps>(function DockAppItem(
  { app, state, bounceToken, tabIndex, touch, reduced, touchX, scrubbed, onActivate, onFocusItem },
  btnRef,
) {
  const g = touch ? DOCK_GEOMETRY.touch : DOCK_GEOMETRY.desktop;
  const key = `dock-${app.id}`;
  const slotRef = useProximityTarget<HTMLSpanElement>(key);
  const [hover, setHover] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const geo = useRef(g);
  geo.current = g;

  const raw = useTransform([pointer.x, pointer.y, touchX], ([x, y, tx]: number[]) => {
    if (reduced) return 1;
    const G = geo.current;
    if (!Number.isNaN(tx)) return 1 + (G.smax - 1) * gaussianX(key, G.sigma, tx);
    if (Number.isNaN(x)) return 1; // hanya mouse/pen yang menulis pointer.x
    const bar = targetOf('ubb');
    if (!bar || y < bar.top - DOCK_GEOMETRY.desktop.activateAbove || y > bar.bottom + 8) return 1;
    return 1 + (G.smax - 1) * gaussianX(key, G.sigma, x);
  });
  const scale = useSpring(raw, BOTTOM_BAR_SPRINGS.dockMagnify);
  const lift = useTransform(scale, (s) => -(s - 1) * geo.current.lift);

  // pantulan saat jendela mendarat
  const [faceScope, animateFace] = useAnimate();
  const firstToken = useRef(bounceToken);
  useEffect(() => {
    if (bounceToken === firstToken.current || bounceToken === undefined) return;
    if (reduced) return;
    animateFace(faceScope.current, { y: [0, -6, 0], scale: [1, 1.08, 1] }, { duration: 0.26, ease: 'easeOut' });
  }, [bounceToken, reduced, animateFace, faceScope]);

  const running = state.phase !== 'closed';
  const active = state.phase === 'active';
  const tip = hover || focusVisible || scrubbed;

  return (
    <span ref={slotRef} className="dock-slot" style={{ width: g.icon, height: g.icon }}>
      <motion.button
        ref={btnRef}
        type="button"
        className="dock-btn"
        data-dock-id={app.id}
        tabIndex={tabIndex}
        aria-label={labelFor(app, state)}
        aria-current={active ? 'true' : undefined}
        aria-describedby={state.phase === 'background' ? 'dock-running-hint' : undefined}
        style={{ scale, y: lift, transformOrigin: '50% 100%' }}
        whileTap={reduced ? { opacity: 0.7 } : { scale: 0.92 }}
        transition={BOTTOM_BAR_SPRINGS.tactileTap}
        onPointerEnter={(e) => e.pointerType !== 'touch' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={(e) => {
          onFocusItem();
          setFocusVisible(e.currentTarget.matches(':focus-visible'));
        }}
        onBlur={() => setFocusVisible(false)}
        onClick={(e) => {
          if (e.detail > 0 && pointer.kind.get() === 'touch') return; // sentuh ditangani scrubber
          const r = slotRef.current!.getBoundingClientRect();
          onActivate({ x: r.left, y: r.top, w: r.width, h: r.height });
        }}
      >
        <span ref={faceScope} className="dock-face" data-active={active ? '' : undefined}>
          <AppTile id={app.id} size={g.icon} />
        </span>
        {running && <span className="dock-dot" aria-hidden />}
      </motion.button>
      <AnimatePresence>
        {tip && (
          <motion.span
            className="dock-tip"
            role="tooltip"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.12, delay: hover && !scrubbed && !focusVisible ? 0.35 : 0 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            style={{ '--lift': `${(g.smax - 1) * g.icon}px` } as React.CSSProperties}
          >
            {app.name}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
});
