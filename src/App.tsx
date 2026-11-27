import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Launchpad, type LaunchpadDim } from './components/os/Launchpad';
import { SpotlightModal } from './components/os/SpotlightModal';
import { StageWindow, type Placement } from './components/os/StageWindow';
import { FlightLayer } from './components/stage/FlightLayer';
import { useMorph } from './hooks/useMorph';
import { clampWindowRect, deckSlot, stageRect, STRIP_LEFT_LIMIT, STRIP_RESERVED, useViewport } from './hooks/useViewport';
import { isLive, useWindowManager, type Win, type WindowActions } from './hooks/useWindowManager';
import type { AppId, Rect, RectSnapshot } from './types/os';

/** Radius jendela di stage: 18 px di desktop, 0 di ponsel (penuh layar). */
const WIN_RADIUS = 18;

export default function App() {
  const wm = useWindowManager();
  const { state } = wm;
  const vp = useViewport();
  const reduced = !!useReducedMotion();
  const morph = useMorph();
  const [spotlight, setSpotlight] = useState(false);

  const live = state.wins.filter(isLive);
  const running = new Set(live.map((w) => w.id));
  const hasActive = state.activeId !== null;

  const stage = stageRect(vp, state.expanded);
  const normalStage = stageRect(vp, false);
  const deckOnDesktop = !vp.mobile && state.deck.length > 0;
  /** Strip kiri tampil (desktop, tidak expanded): jendela tidak boleh digeser menutupinya. */
  const stripLeft = deckOnDesktop && !state.expanded ? STRIP_LEFT_LIMIT : undefined;

  /** Geometri jendela di desktop non-expanded: Rect kustom (dijepit ke viewport saat ini) atau stage normal. */
  const customRect = (w: Win | undefined) =>
    w?.rect ? clampWindowRect(w.rect, vp, undefined, stripLeft) : normalStage;
  /** Rect yang benar-benar ditempati jendela saat aktif di stage. */
  const effectiveRect = (id: AppId) =>
    vp.mobile || state.expanded ? stage : customRect(state.wins.find((w) => w.id === id));

  const snap = (r: Rect): RectSnapshot => ({
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    borderRadius: vp.mobile ? 0 : WIN_RADIUS,
  });
  /** Kartu tidak terpasang di DOM: menyusut ke tengah layar sambil memudar. */
  const centerFallback = (): RectSnapshot => ({ left: vp.w / 2 - 32, top: vp.h / 2 - 32, width: 64, height: 64, borderRadius: 18 });

  /** Morph pulang: dari jendela ke kartu SpaceCard-nya, dibaca saat itu juga. */
  const homeFlight = (id: AppId) => {
    const tile = wm.getTileRect(id);
    return { from: snap(effectiveRect(id)), to: tile ?? centerFallback(), fade: !tile };
  };

  /** Setelah jendela ditutup/di-collapse, fokus keyboard kembali ke kartunya di Launchpad. */
  const focusCard = (id: AppId) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`.app-card[data-app="${id}"]`)?.focus({ preventScroll: true }),
      ),
    );

  const launch = (id: AppId, origin: RectSnapshot | null) => {
    if (state.activeId === id) return;
    // jendela yang sedang tampil di Side Stage Strip cukup ditukar ke stage
    const win = state.wins.find((w) => w.id === id);
    if (!vp.mobile && !state.expanded && state.deck.includes(id) && win && !win.minimized && isLive(win)) {
      wm.focus(id);
      return;
    }
    if (reduced) {
      wm.launch(id, null); // crossfade 120 ms oleh jendela sendiri
      return;
    }
    const from = origin ?? wm.getTileRect(id) ?? centerFallback();
    wm.launch(id, { from, to: snap(effectiveRect(id)), fade: false });
  };

  /** Collapse ke Launchpad: sesi iframe tetap hidup (titik di kartu), jendela pulang ke kartunya. */
  const collapse = () => {
    const id = state.activeId;
    if (!id) return;
    wm.minimize(reduced ? null : homeFlight(id));
    focusCard(id);
  };
  const close = (id: AppId) => {
    const wasActive = state.activeId === id;
    wm.close(id, wasActive && !reduced ? homeFlight(id) : null);
    if (wasActive) focusCard(id);
  };

  const actions: WindowActions = {
    close,
    minimize: collapse,
    focus: wm.focus,
    refresh: wm.refresh,
    toggleExpand: wm.toggleExpand,
    markReady: wm.markReady,
    setRect: wm.setRect,
    cycle: (id, dir) => {
      const ids = live.map((w) => w.id);
      const i = ids.indexOf(id);
      if (i === -1 || ids.length < 2) return;
      wm.focus(ids[(i + dir + ids.length) % ids.length]);
    },
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
        else collapse(); // Esc tidak pernah menutup sesi
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spotlight, state.activeId, state.expanded, state.wins, vp, reduced],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const flight = state.flight;
  const dim: LaunchpadDim = !hasActive ? 'none' : flight?.phase === 'opening' ? 'dim' : 'away';

  return (
    <MotionConfig reducedMotion="user">
      <div className="wallpaper" aria-hidden />
      <div id="safe-probe-top" aria-hidden />
      <div id="safe-probe" aria-hidden />

      <Launchpad
        dim={dim}
        padLeft={deckOnDesktop ? STRIP_RESERVED : 0}
        running={running}
        reduced={reduced}
        onLaunch={(id) => launch(id, null)}
        registerTile={wm.registerTileElement}
      />

      <AnimatePresence>
        {state.wins.map((win) => {
          const active = win.id === state.activeId;
          const morphing = flight && flight.id === win.id ? flight : null;
          const deckIndex = state.deck.indexOf(win.id);
          let placement: Placement;
          let target;
          if (active) {
            placement = 'stage';
            target = { ...effectiveRect(win.id), scale: 1, opacity: 1 };
          } else if (morphing?.phase === 'closing') {
            // pulang ke kartu: jendela diam di kotak asalnya, proxy yang menyusut
            placement = 'hidden';
            const b = morphing.from;
            target = { x: b.left, y: b.top, w: b.width, h: b.height, scale: 1, opacity: 1 };
          } else if (!vp.mobile && !state.expanded && deckIndex !== -1 && deckIndex <= 3 && !win.minimized) {
            // strip menampilkan 4 kartu; sisanya 'hidden' supaya .deck-hit tak terpasang (klik/Tab)
            placement = 'deck';
            const slot = deckSlot(vp, deckIndex, state.deck.length);
            target = { x: slot.x, y: slot.y, w: normalStage.w, h: normalStage.h, scale: slot.scale, opacity: 1 };
          } else {
            placement = 'hidden';
            // tetap di Rect kustomnya agar membuka lagi dari kartu tidak melompat
            target = { ...(vp.mobile ? normalStage : customRect(win)), scale: 1, opacity: 0 };
          }
          return (
            <StageWindow
              key={`${win.id}-${win.session}`}
              win={win}
              placement={placement}
              target={target}
              morph={morphing ? morph : null}
              mobile={vp.mobile}
              expanded={state.expanded}
              canCycle={live.length > 1}
              vp={vp}
              stripLeft={stripLeft}
              reduced={reduced}
              wm={actions}
              onFrameKey={onKey}
            />
          );
        })}
      </AnimatePresence>

      <FlightLayer flight={flight} morph={morph} onLanded={wm.landed} />

      <AnimatePresence>
        {spotlight && (
          <SpotlightModal
            reduced={reduced}
            onClose={() => setSpotlight(false)}
            onLaunch={(id, origin) => {
              setSpotlight(false);
              launch(id, origin);
            }}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
