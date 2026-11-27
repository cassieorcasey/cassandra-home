import { AnimatePresence, LayoutGroup, MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UnifiedBottomBar } from './components/bottom-bar/UnifiedBottomBar';
import { Launchpad } from './components/os/Launchpad';
import { SpotlightModal } from './components/os/SpotlightModal';
import { StageWindow, type Placement } from './components/os/StageWindow';
import { FlightLayer } from './components/stage/FlightLayer';
import { apps } from './config/apps.config';
import { deckSlot, stageRect, STRIP_RESERVED, useViewport } from './hooks/useViewport';
import { lifecycleOf, useWindowManager, type WindowActions } from './hooks/useWindowManager';
import type { AppId, Rect, WindowLifecycle } from './types/os';

export default function App() {
  const wm = useWindowManager();
  const { state } = wm;
  const vp = useViewport();
  const reduced = !!useReducedMotion();
  const [spotlight, setSpotlight] = useState(false);

  const running = new Set(state.wins.map((w) => w.id));
  const hasActive = state.activeId !== null;

  useEffect(() => {
    document.documentElement.toggleAttribute('data-window-open', hasActive);
  }, [hasActive]);

  // ---- slot dok sebagai titik pendaratan penerbangan
  const slots = useRef(new Map<AppId, () => Rect>());
  const registerSlot = useCallback((id: AppId, measure: () => Rect) => {
    slots.current.set(id, measure);
    return () => {
      if (slots.current.get(id) === measure) slots.current.delete(id);
    };
  }, []);
  const slotRect = (id: AppId) => (state.expanded ? null : (slots.current.get(id)?.() ?? null));

  const stage = stageRect(vp, state.expanded);
  const normalStage = stageRect(vp, false);
  const fly = (from: Rect | null, to: Rect | null) => (reduced || !from || !to ? null : { from, to });

  const launch = (id: AppId, origin: Rect | null) => {
    const target = stageRect(vp, state.expanded);
    if (state.activeId === id) return;
    wm.launch(id, fly(origin, target));
  };
  const minimize = () => {
    const id = state.activeId;
    if (!id) return;
    wm.minimize(fly(stage, slotRect(id)));
    // fokus kembali ke ikon aplikasi itu di dok, bukan hilang ke <body>
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`.ubb [data-dock-id="${id}"]`)?.focus({ preventScroll: true }),
    );
  };
  const close = (id: AppId) => wm.close(id, state.activeId === id ? fly(stage, slotRect(id)) : null);

  /** Aplikasi yang sedang di Side Stage Strip cukup ditukar; selain itu terbang dari ikon dok. */
  const onDockLaunch = (id: AppId, origin: Rect) => {
    const inStrip = !vp.mobile && !state.expanded && state.deck.includes(id) && !state.wins.find((w) => w.id === id)?.minimized;
    if (inStrip) wm.focus(id);
    else launch(id, origin);
  };

  const actions: WindowActions = {
    close,
    minimize,
    focus: wm.focus,
    refresh: wm.refresh,
    toggleExpand: wm.toggleExpand,
    markReady: wm.markReady,
  };

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlight((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (spotlight) setSpotlight(false);
        else minimize(); // Esc tidak pernah menutup sesi
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spotlight, state.activeId, state.expanded, vp, reduced],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const lifecycles = useMemo(
    () => Object.fromEntries(apps.map((a) => [a.id, lifecycleOf(state, a.id)])) as Record<AppId, WindowLifecycle>,
    [state],
  );

  const deckOnDesktop = !vp.mobile && state.deck.length > 0;
  const flying = state.flight?.direction === 'open' ? state.flight.id : null;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="cassandra-os">
        <div className="wallpaper" aria-hidden />
        <div id="safe-probe-top" aria-hidden />
        <div id="safe-probe" aria-hidden />


        <Launchpad
          hidden={hasActive}
          padLeft={deckOnDesktop ? STRIP_RESERVED : 0}
          running={running}
          reduced={reduced}
          onLaunch={(id, origin) => launch(id as AppId, origin)}
        />

        <AnimatePresence>
          {state.wins.map((win) => {
            const active = win.id === state.activeId;
            const deckIndex = state.deck.indexOf(win.id);
            let placement: Placement;
            let target;
            if (active) {
              placement = 'stage';
              target = { ...stage, scale: 1, opacity: 1 };
            } else if (!vp.mobile && !state.expanded && deckIndex !== -1 && !win.minimized) {
              placement = 'deck';
              const slot = deckSlot(vp, deckIndex);
              target = { x: slot.x, y: slot.y, w: normalStage.w, h: normalStage.h, scale: slot.scale, opacity: deckIndex > 3 ? 0 : 1 };
            } else {
              placement = 'hidden';
              target = { ...normalStage, scale: 1, opacity: 0 };
            }
            return (
              <StageWindow
                key={`${win.id}-${win.session}`}
                win={win}
                placement={placement}
                target={target}
                revealed={flying !== win.id}
                mobile={vp.mobile}
                expanded={state.expanded}
                reduced={reduced}
                wm={actions}
                onFrameKey={onKey}
              />
            );
          })}
        </AnimatePresence>

        <UnifiedBottomBar
          apps={apps}
          lifecycles={lifecycles}
          activeId={state.activeId}
          bounce={state.bounce}
          mobile={vp.mobile}
          viewportWidth={vp.w}
          hidden={state.expanded}
          reduced={reduced}
          onLaunch={onDockLaunch}
          onHome={minimize}
          registerSlot={registerSlot}
        />

        <FlightLayer flight={state.flight} onLanded={wm.landed} />

        <AnimatePresence>
          {spotlight && (
            <SpotlightModal
              reduced={reduced}
              onClose={() => setSpotlight(false)}
              onLaunch={(id) => {
                setSpotlight(false);
                launch(id as AppId, null);
              }}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  );
}
