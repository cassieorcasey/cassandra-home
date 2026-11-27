import { motion, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { BOTTOM_BAR_SPRINGS, DOCK_GEOMETRY } from '../../config/motion';
import { targetOf, useProximityTarget } from '../../hooks/usePointerProximity';
import type { AppId, CassandraApp, Rect, WindowLifecycle } from '../../types/os';
import { DockAppItem } from './DockAppItem';
import { Icon } from '../ui/Icon';

export interface UnifiedBottomBarProps {
  apps: readonly CassandraApp[];
  lifecycles: Record<AppId, WindowLifecycle>;
  activeId: AppId | null;
  bounce: Partial<Record<AppId, number>>;
  mobile: boolean;
  viewportWidth: number;
  hidden: boolean;
  reduced: boolean;
  /** origin = rect slot (bukan ikon yang sedang diperbesar). */
  onLaunch: (id: AppId, origin: Rect) => void;
  onHome: () => void;
  registerSlot: (id: AppId, measure: () => Rect) => () => void;
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

export function UnifiedBottomBar(p: UnifiedBottomBarProps) {
  const { apps, lifecycles, activeId, mobile, reduced } = p;
  const mode = activeId ? 'active' : 'home';
  const g = mobile ? DOCK_GEOMETRY.touch : DOCK_GEOMETRY.desktop;
  const gap = mobile && p.viewportWidth < 340 ? 6 : g.gap;

  const barRef = useProximityTarget<HTMLElement>('ubb');
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const homeRef = useRef<HTMLButtonElement | null>(null);

  // ---- slot terdaftar untuk titik pendaratan penerbangan
  const { registerSlot } = p;
  useEffect(() => {
    const offs = apps.map((a, i) =>
      registerSlot(a.id, () => {
        const el = itemRefs.current[i]?.parentElement;
        return el ? rectOf(el) : { x: innerWidth / 2 - 24, y: innerHeight - 70, w: 48, h: 48 };
      }),
    );
    return () => offs.forEach((off) => off());
  }, [apps, registerSlot]);

  // ---- roving tabindex: indeks 0 = tombol Home, lalu ikon
  const offset = 1;
  const count = apps.length + offset;
  const [roving, setRoving] = useState(0);
  const focusAt = (i: number) => {
    setRoving(i);
    (i < offset ? homeRef.current : itemRefs.current[i - offset])?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: (roving + 1) % count,
      ArrowLeft: (roving - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    focusAt(map[e.key]);
  };

  // ---- touch scrubber
  const touchX = useMotionValue(Number.NaN);
  const [scrubId, setScrubId] = useState<AppId | null>(null);
  const scrub = useRef<{ id: number; x0: number; downAt: AppId | null; armed: boolean; out: boolean } | null>(null);
  const slotAt = (x: number): AppId | null => {
    let best: AppId | null = null;
    let bestD = (g.icon + gap) / 2;
    for (const a of apps) {
      const t = targetOf(`dock-${a.id}`);
      if (!t) continue;
      const d = Math.abs(x - t.cx);
      if (d <= bestD) {
        best = a.id;
        bestD = d;
      }
    }
    return best;
  };
  const endScrub = () => {
    scrub.current = null;
    touchX.set(Number.NaN);
    setScrubId(null);
  };
  const activate = (id: AppId) => {
    const i = apps.findIndex((a) => a.id === id);
    const el = itemRefs.current[i]?.parentElement;
    if (el) p.onLaunch(id, rectOf(el));
  };
  const rowHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const at = slotAt(e.clientX);
      scrub.current = { id: e.pointerId, x0: e.clientX, downAt: at, armed: false, out: false };
      setScrubId(at);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = scrub.current;
      if (!s || s.id !== e.pointerId) return;
      if (!s.armed && Math.abs(e.clientX - s.x0) > 10) s.armed = true;
      const r = barRef.current!.getBoundingClientRect();
      s.out =
        e.clientY < r.top - 40 || e.clientY > r.bottom + 16 || e.clientX < r.left - 16 || e.clientX > r.right + 16;
      if (!s.armed) return;
      touchX.set(s.out ? Number.NaN : e.clientX);
      const at = s.out ? null : slotAt(e.clientX);
      setScrubId((prev) => {
        if (prev !== at && at) navigator.vibrate?.(8);
        return at;
      });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = scrub.current;
      if (!s || s.id !== e.pointerId) return;
      const target = s.out ? null : s.armed ? slotAt(e.clientX) : s.downAt;
      endScrub();
      if (target) activate(target);
    },
    onPointerCancel: endScrub,
  };

  return (
    <div className={`ubb-wrap ${p.hidden ? 'is-hidden' : ''}`} inert={p.hidden}>
      <motion.nav
        ref={barRef}
        className={`ubb ${mobile ? 'is-mobile' : ''} is-${mode}`}
        aria-label="Dock Cassandra"
      >
        <motion.div
          className="ubb-row"
          role="toolbar"
          aria-label="Aplikasi"
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          style={{ gap }}
          {...rowHandlers}
        >
          <span className="dock-slot" style={{ width: g.icon, height: g.icon }}>
            <motion.button
              ref={homeRef}
              type="button"
              className="dock-btn dock-home"
              tabIndex={roving === 0 ? 0 : -1}
              aria-label="Cassandra Home"
              aria-current={mode === 'home' ? 'page' : undefined}
              title="Home (Esc)"
              whileTap={reduced ? { opacity: 0.7 } : { scale: 0.92 }}
              transition={BOTTOM_BAR_SPRINGS.tactileTap}
              onFocus={() => setRoving(0)}
              onClick={p.onHome}
            >
              <Icon name="grid" size={mobile ? 22 : 24} />
            </motion.button>
          </span>
          <span className="dock-divider" aria-hidden />
          {apps.map((app, i) => (
            <DockAppItem
              key={app.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              app={app}
              state={lifecycles[app.id]}
              bounceToken={p.bounce[app.id]}
              tabIndex={roving === i + offset ? 0 : -1}
              touch={mobile}
              reduced={reduced}
              touchX={touchX}
              scrubbed={scrubId === app.id}
              onActivate={(origin) => p.onLaunch(app.id, origin)}
              onFocusItem={() => setRoving(i + offset)}
            />
          ))}
        </motion.div>
        <span id="dock-running-hint" hidden>
          berjalan di latar belakang
        </span>
      </motion.nav>
    </div>
  );
}
