import { AnimatePresence, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Dock } from './components/os/Dock';
import { Launchpad } from './components/os/Launchpad';
import { SpotlightModal } from './components/os/SpotlightModal';
import { StageWindow, type Placement } from './components/os/StageWindow';
import { MobileTabBar } from './components/os/TabDeck';
import { TopBar } from './components/os/TopBar';
import { useTheme } from './hooks/useTheme';
import { deckSlot, stageRect, STRIP_RESERVED, useViewport } from './hooks/useViewport';
import { useWindowManager, type Rect } from './hooks/useWindowManager';

function iconRect(id: string, fallback: Rect): Rect {
  const el = document.querySelector(`[data-launch="grid-${id}"]`);
  if (!el) return fallback;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export default function App() {
  const wm = useWindowManager();
  const { state } = wm;
  const theme = useTheme();
  const vp = useViewport();
  const reduced = !!useReducedMotion();
  const [spotlight, setSpotlight] = useState(false);

  const running = new Set(state.apps.map((a) => a.id));
  const hasActive = state.activeId !== null;

  useEffect(() => {
    document.documentElement.toggleAttribute('data-window-open', hasActive);
  }, [hasActive]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlight((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (spotlight) setSpotlight(false);
        else wm.minimize(); // Esc tidak pernah menutup sesi
      }
    },
    [spotlight, wm],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const stage = stageRect(vp, state.expanded);
  const normalStage = stageRect(vp, false);
  const centerFallback: Rect = { x: vp.w / 2 - 36, y: vp.h / 2 - 36, w: 72, h: 72 };

  const deckOnDesktop = !vp.mobile && state.deck.length > 0;

  return (
    <>
      <div className="wallpaper" aria-hidden />
      <div id="safe-probe" aria-hidden />

      <TopBar
        openCount={state.apps.length}
        theme={theme.pref}
        onCycleTheme={theme.cycle}
        onSpotlight={() => setSpotlight(true)}
        onHome={wm.minimize}
      />

      <Launchpad
        hidden={hasActive}
        padLeft={deckOnDesktop ? STRIP_RESERVED : 0}
        running={running}
        reduced={reduced}
        onLaunch={(id, origin) => wm.open(id, origin)}
      />

      <AnimatePresence>
        {state.apps.map((win) => {
          const active = win.id === state.activeId;
          const deckIndex = state.deck.indexOf(win.id);
          let placement: Placement;
          let target;
          if (active) {
            placement = 'stage';
            target = { ...stage, scale: 1, opacity: 1 };
          } else if (!vp.mobile && !state.expanded) {
            placement = 'deck';
            const slot = deckSlot(vp, deckIndex);
            target = { x: slot.x, y: slot.y, w: normalStage.w, h: normalStage.h, scale: slot.scale, opacity: deckIndex > 3 ? 0 : 1 };
          } else {
            placement = 'hidden';
            target = { ...normalStage, y: normalStage.y + 20, scale: 0.96, opacity: 0 };
          }
          return (
            <StageWindow
              key={win.id}
              win={win}
              placement={placement}
              target={target}
              exitTo={iconRect(win.id, centerFallback)}
              mobile={vp.mobile}
              expanded={state.expanded}
              reduced={reduced}
              wm={wm}
              onFrameKey={onKey}
            />
          );
        })}
      </AnimatePresence>

      {vp.mobile ? (
        <MobileTabBar wm={wm} />
      ) : (
        <Dock running={running} hidden={state.expanded} onHome={wm.minimize} onLaunch={(id, origin) => wm.open(id, origin)} />
      )}

      <AnimatePresence>
        {spotlight && (
          <SpotlightModal
            reduced={reduced}
            onClose={() => setSpotlight(false)}
            onLaunch={(id) => {
              setSpotlight(false);
              wm.open(id, null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
