import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Launchpad, type LaunchpadDim } from './components/os/Launchpad';
import { SpotlightModal } from './components/os/SpotlightModal';
import { StageWindow, type Placement } from './components/os/StageWindow';
import { TaskBar } from './components/os/TaskBar';
import { FlightLayer } from './components/stage/FlightLayer';
import { IconFlight, type IconFlightSpec } from './components/stage/IconFlight';
import { useMorph } from './hooks/useMorph';
import { clampWindowRect, stageRect, useViewport } from './hooks/useViewport';
import { isLive, tabIds, useWindowManager, type Win, type WindowActions } from './hooks/useWindowManager';
import { clampPage, pageOf, tabSlotRect, TB_ICON } from './lib/taskbar';
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
  const tabs = tabIds(state);
  const minimizedSet = new Set(live.filter((w) => w.minimized).map((w) => w.id));
  // Multitask Bar: baris 1 = tab, baris 2 = peluncur (dipaksa saat belum ada tab)
  const [barRow, setBarRow] = useState<0 | 1>(0);
  const [barPage, setBarPage] = useState(0);
  const row: 0 | 1 = tabs.length === 0 ? 1 : barRow;
  const page = clampPage(barPage, tabs.length);
  // ikon yang terbang dari tile ke tab baru; tab tujuan menyembunyikan ikonnya sampai mendarat
  const [iconFlight, setIconFlight] = useState<IconFlightSpec | null>(null);
  const running = new Set(live.map((w) => w.id));
  const hasActive = state.activeId !== null;

  const stage = stageRect(vp, state.expanded);
  const normalStage = stageRect(vp, false);

  /** Geometri jendela di desktop non-expanded: Rect kustom (dijepit ke viewport saat ini) atau stage normal. */
  const customRect = (w: Win | undefined) =>
    w?.rect ? clampWindowRect(w.rect, vp) : normalStage;
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

  /** Ikon berukuran `size` di tengah rect `r` (ikon di dalam kartu / baris Spotlight). */
  const iconIn = (r: RectSnapshot, size: number): RectSnapshot => ({
    left: r.left + (r.width - size) / 2,
    top: r.top + (r.height - size) / 2,
    width: size,
    height: size,
    borderRadius: 0,
  });

  /**
   * Buka aplikasi. `source`: dari kartu Launchpad / Spotlight, tab baru mendapat ikon yang terbang
   * ke slot-nya; dari bar (tab atau baris peluncur) tidak, karena asalnya sudah di bar.
   */
  const launch = (id: AppId, origin: RectSnapshot | null, source: 'tile' | 'spotlight' | 'bar' = 'tile') => {
    // bar menampilkan halaman tempat tab app ini berada (tab baru = di ujung)
    const known = tabs.indexOf(id);
    const idx = known === -1 ? tabs.length : known;
    const p = pageOf(idx);
    setBarPage(p);
    setBarRow(0);
    if (state.activeId === id) return;
    if (reduced) {
      wm.launch(id, null); // crossfade 120 ms oleh jendela sendiri
      return;
    }
    const from = origin ?? wm.getTileRect(id) ?? centerFallback();
    if (known === -1 && source !== 'bar') {
      const start = source === 'tile' ? iconIn(from, 68) : iconIn(from, TB_ICON);
      setIconFlight({ key: performance.now(), id, from: start, to: tabSlotRect(vp, tabs.length + 1, idx, p) });
    }
    wm.launch(id, { from, to: snap(effectiveRect(id)), fade: false });
  };

  /** Fokus keyboard ke tab aplikasi di Multitask Bar (setelah bar pindah baris/halaman). */
  const focusTab = (id: AppId) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`.tb-tab[data-app="${id}"]`)?.focus({ preventScroll: true }),
      ),
    );

  /**
   * Perkecil ke tab: bar dipindah ke baris tab & halaman tab ini, dan jendela morph ke posisi
   * akhir ikon tab (dihitung dari tata letak, jadi morph dan animasi bar berjalan bersamaan).
   * Sesi iframe tetap hidup.
   */
  const collapse = () => {
    const id = state.activeId;
    if (!id) return;
    const idx = Math.max(tabs.indexOf(id), 0);
    const p = pageOf(idx);
    setBarRow(0);
    setBarPage(p);
    wm.minimize(reduced ? null : { from: snap(effectiveRect(id)), to: tabSlotRect(vp, tabs.length, idx, p), fade: false });
    focusTab(id);
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
      const j = (i + dir + ids.length) % ids.length;
      setBarPage(pageOf(tabs.indexOf(ids[j])));
      wm.focus(ids[j]);
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
        running={running}
        reduced={reduced}
        onLaunch={(id) => launch(id, null)}
        registerTile={wm.registerTileElement}
      />

      <AnimatePresence>
        {state.wins.map((win) => {
          const active = win.id === state.activeId;
          const morphing = flight && flight.id === win.id ? flight : null;
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
              reduced={reduced}
              wm={actions}
              onFrameKey={onKey}
            />
          );
        })}
      </AnimatePresence>

      <TaskBar
        tabs={tabs}
        activeId={state.activeId}
        minimized={minimizedSet}
        row={row}
        page={page}
        onRow={setBarRow}
        onPage={setBarPage}
        onTab={(id) => (id === state.activeId ? collapse() : launch(id, wm.getTabRect(id), 'bar'))}
        onLaunch={(id, origin) => launch(id, origin, 'bar')}
        arriving={iconFlight?.id ?? null}
        registerTab={wm.registerTabElement}
        reduced={reduced}
      />

      <FlightLayer flight={flight} morph={morph} onLanded={wm.landed} />
      <IconFlight flight={iconFlight} onDone={(key) => setIconFlight((f) => (f && f.key === key ? null : f))} />

      <AnimatePresence>
        {spotlight && (
          <SpotlightModal
            reduced={reduced}
            onClose={() => setSpotlight(false)}
            onLaunch={(id, origin) => {
              setSpotlight(false);
              launch(id, origin, 'spotlight');
            }}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
