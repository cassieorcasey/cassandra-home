import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Launchpad, type LaunchpadDim } from './components/os/Launchpad';
import { SpotlightModal } from './components/os/SpotlightModal';
import { StageWindow, type Placement } from './components/os/StageWindow';
import { TaskBar } from './components/os/TaskBar';
import { FlightLayer } from './components/stage/FlightLayer';
import { IconFlight, type IconFlightSpec } from './components/stage/IconFlight';
import { useMorph } from './hooks/useMorph';
import { stageRect, useViewport } from './hooks/useViewport';
import { isLive, tabIds, useWindowManager, type WindowActions } from './hooks/useWindowManager';
import { screenLayout } from './lib/screens';
import { clampPage, pageCount, pageOf, screenCapacity, tabSlotRect, TB_ICON } from './lib/taskbar';
import type { AppId, Rect, RectSnapshot } from './types/os';

/** Radius jendela: 18 px di desktop, 14 px di ponsel. */
const WIN_RADIUS = 18;
const WIN_RADIUS_MOBILE = 14;

export default function App() {
  const wm = useWindowManager();
  const { state } = wm;
  const vp = useViewport();
  const reduced = !!useReducedMotion();
  const morph = useMorph();
  const [spotlight, setSpotlight] = useState(false);

  const live = state.wins.filter(isLive);
  const tabs = tabIds(state);
  /** Kapasitas layar (4 desktop/tablet, 2 ponsel) = tab per halaman bar. */
  const K = screenCapacity(vp.mobile);
  const gap = vp.mobile ? 8 : 12;
  const minimizedSet = new Set(live.filter((w) => w.minimized).map((w) => w.id));
  // Multitask Bar: baris 1 = tab, baris 2 = peluncur (dipaksa saat belum ada tab)
  const [barRow, setBarRow] = useState<0 | 1>(0);
  const [barPage, setBarPage] = useState(0);
  const row: 0 | 1 = tabs.length === 0 ? 1 : barRow;
  // K berubah (lebar melewati 767 px, mis. HP diputar): nomor layar lama tidak berarti lagi,
  // jadi layar dipasang ulang ke layar tempat jendela yang difokus berada
  const [seenK, setSeenK] = useState(K);
  if (seenK !== K) {
    setSeenK(K);
    const i = state.activeId ? tabs.indexOf(state.activeId) : -1;
    setBarPage(i === -1 ? 0 : pageOf(i, K));
  }
  /** Layar aktif = halaman bar (dijepit saat tab berkurang atau K berubah). */
  const screen = clampPage(barPage, tabs.length, K);
  const screens = pageCount(tabs.length, K);
  // ikon yang terbang dari tile ke tab baru; tab tujuan menyembunyikan ikonnya sampai mendarat
  const [iconFlight, setIconFlight] = useState<IconFlightSpec | null>(null);
  const running = new Set(live.map((w) => w.id));

  const stage = stageRect(vp, false);
  /** Area "penuhi layar" untuk jendela yang di-expand. */
  const fullStage = vp.mobile ? stage : stageRect(vp, true);

  /** Layout layar `s` untuk urutan tab & himpunan diperkecil tertentu. */
  const layout = (s: number, list: AppId[] = tabs, min: Set<AppId> = minimizedSet) => screenLayout(list, min, s, K, stage, gap);
  const without = (set: Set<AppId>, id: AppId) => new Set([...set].filter((x) => x !== id));
  const screenOf = (id: AppId, list: AppId[] = tabs) => pageOf(Math.max(list.indexOf(id), 0), K);
  /** Sel jendela `id` bila tampil (diperkecil pun dihitung seolah tampil). */
  const cellOf = (id: AppId, list: AppId[] = tabs, min: Set<AppId> = without(minimizedSet, id)): Rect => {
    if (state.expanded && id === state.activeId) return fullStage;
    return layout(screenOf(id, list), list, min).get(id) ?? stage;
  };
  /** Jendela yang tampil di layar aktif, urut tab. */
  const visibleNow = [...layout(screen).keys()];
  const focusedId = state.activeId && visibleNow.includes(state.activeId) ? state.activeId : null;

  const snap = (r: Rect): RectSnapshot => ({
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    borderRadius: vp.mobile ? WIN_RADIUS_MOBILE : WIN_RADIUS,
  });
  /** Kartu tidak terpasang di DOM: menyusut ke tengah layar sambil memudar. */
  const centerFallback = (): RectSnapshot => ({ left: vp.w / 2 - 32, top: vp.h / 2 - 32, width: 64, height: 64, borderRadius: 18 });

  /** Setelah jendela ditutup, fokus keyboard kembali ke kartunya di Launchpad bila Home tampil. */
  const focusEl = (sel: string) =>
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true })));

  /** Ikon berukuran `size` di tengah rect `r` (ikon di dalam kartu / baris Spotlight). */
  const iconIn = (r: RectSnapshot, size: number): RectSnapshot => ({
    left: r.left + (r.width - size) / 2,
    top: r.top + (r.height - size) / 2,
    width: size,
    height: size,
    borderRadius: 0,
  });

  /** Pindah ke layar `s`: fokus ke jendela pertama yang tampil di sana. */
  const goScreen = (s: number) => {
    const next = clampPage(s, tabs.length, K);
    if (next === screen) return;
    setBarPage(next);
    const shown = [...layout(next).keys()];
    if (shown[0] && !(state.activeId && shown.includes(state.activeId))) wm.focus(shown[0]);
  };

  /**
   * Buka aplikasi. App baru masuk di ujung urutan dan layar pindah ke layarnya; jendela morph ke
   * selnya sementara jendela lain di layar itu beranimasi ke sel barunya. `source`: dari kartu
   * Launchpad / Spotlight, tab baru mendapat ikon yang terbang ke slot-nya; dari bar tidak.
   */
  const launch = (id: AppId, origin: RectSnapshot | null, source: 'tile' | 'spotlight' | 'bar' = 'tile') => {
    const known = tabs.indexOf(id);
    const list = known === -1 ? [...tabs, id] : tabs;
    const idx = known === -1 ? tabs.length : known;
    const s = pageOf(idx, K);
    setBarPage(s);
    setBarRow(0);
    const win = live.find((w) => w.id === id);
    // sudah tampil (di layar mana pun): cukup pindah layar dan fokus
    if (win && !win.minimized) {
      wm.focus(id);
      return;
    }
    if (reduced) {
      wm.launch(id, null); // crossfade 120 ms oleh jendela sendiri
      return;
    }
    const from = origin ?? wm.getTileRect(id) ?? centerFallback();
    if (known === -1 && source !== 'bar') {
      const start = source === 'tile' ? iconIn(from, 68) : iconIn(from, TB_ICON);
      setIconFlight({ key: performance.now(), id, from: start, to: tabSlotRect(vp, list.length, idx, s, K) });
    }
    const cell = layout(s, list, without(minimizedSet, id)).get(id) ?? stage;
    wm.launch(id, { from, to: snap(cell), fade: false });
  };

  /**
   * Perkecil ke tab: bar pindah ke baris tab & halaman tab ini, jendela morph ke posisi akhir ikon
   * tab (dihitung dari tata letak, jadi morph dan animasi bar berjalan bersamaan); fokus pindah ke
   * jendela lain yang masih tampil di layar itu. Sesi iframe tetap hidup.
   */
  const minimize = (id: AppId) => {
    const idx = tabs.indexOf(id);
    if (idx === -1) return;
    const s = pageOf(idx, K);
    setBarRow(0);
    setBarPage(s);
    const rest = [...layout(s, tabs, new Set([...minimizedSet, id])).keys()];
    const next = state.activeId === id ? (rest[0] ?? null) : state.activeId;
    const from = snap(cellOf(id));
    wm.minimize(id, reduced ? null : { from, to: tabSlotRect(vp, tabs.length, idx, s, K), fade: false }, next);
    focusEl(`.tb-tab[data-app="${id}"]`);
  };

  const close = (id: AppId) => {
    const shown = visibleNow.includes(id);
    const list = tabs.filter((x) => x !== id);
    const rest = [...layout(Math.min(screen, pageCount(list.length, K) - 1), list).keys()];
    const next = state.activeId === id ? (rest[0] ?? null) : state.activeId;
    const tile = wm.getTileRect(id);
    const flight = shown && !reduced ? { from: snap(cellOf(id)), to: tile ?? centerFallback(), fade: !tile } : null;
    wm.close(id, flight, next);
    if (!rest.length) focusEl(`.app-card[data-app="${id}"]`);
  };

  const actions: WindowActions = {
    close,
    minimize,
    focus: wm.focus,
    refresh: wm.refresh,
    toggleExpand: (id) => {
      if (state.activeId !== id) wm.focus(id);
      else wm.toggleExpand();
    },
    markReady: wm.markReady,
    switchScreen: (dir) => goScreen(screen + dir),
  };

  // pintasan dibaca lewat ref agar listener (juga yang dipasang di dalam iframe) selalu memakai state terbaru
  const keyRef = useRef<(e: KeyboardEvent, from?: AppId) => void>(() => {});
  useEffect(() => {
    /** `from`: jendela asal bila tombol ditekan di dalam iframe-nya (lewat bridge). */
    keyRef.current = (e: KeyboardEvent, from?: AppId) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlight((v) => !v);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      // di kolom teks Ctrl+←/→ berarti lompat per kata, bukan pindah layar
      if (e.ctrlKey && !typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        goScreen(screen + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (e.key === 'Escape') {
        if (spotlight) setSpotlight(false);
        else {
          // Esc dari dalam iframe memperkecil jendela iframe itu sendiri; Esc tidak pernah menutup sesi
          const id = from && visibleNow.includes(from) ? from : focusedId;
          if (id) minimize(id);
        }
      }
    };
  });
  const onKey = (e: KeyboardEvent, from?: AppId) => keyRef.current(e, from);

  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // Klik di dalam iframe tidak sampai ke halaman ini; yang terlihat hanyalah window kehilangan
  // fokus ke iframe itu. Jendela pemilik iframe yang sekarang difokus menjadi jendela aktif.
  const focusRef = useRef(wm.focus);
  useEffect(() => {
    focusRef.current = wm.focus;
  });
  // Perpindahan iframe → iframe tidak memicu event apa pun di halaman ini (blur hanya sekali, saat
  // fokus pertama kali meninggalkan halaman), jadi selama fokus ada di dalam iframe,
  // document.activeElement diperiksa berkala. Aplikasi satu origin juga melapor seketika lewat bridge.
  useEffect(() => {
    let last: Element | null = null;
    let poll: number | undefined;
    const check = () => {
      const el = document.activeElement;
      if (el === last) return;
      last = el;
      if (!(el instanceof HTMLIFrameElement)) return;
      const id = el.closest<HTMLElement>('.stage-window.is-placed')?.dataset.app as AppId | undefined;
      if (id) focusRef.current(id);
    };
    const onBlur = () => {
      window.setTimeout(check, 0);
      window.clearInterval(poll);
      poll = window.setInterval(check, 200);
    };
    const onFocus = () => {
      window.clearInterval(poll);
      last = null;
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(poll);
    };
  }, []);

  const flight = state.flight;
  const dim: LaunchpadDim = visibleNow.length === 0 ? 'none' : flight?.phase === 'opening' ? 'dim' : 'away';

  return (
    <MotionConfig reducedMotion="user">
      <div className="wallpaper" aria-hidden />
      <div id="safe-probe-top" aria-hidden />
      <div id="safe-probe" aria-hidden />

      <Launchpad dim={dim} running={running} reduced={reduced} onLaunch={(id) => launch(id, null)} registerTile={wm.registerTileElement} />

      <AnimatePresence>
        {state.wins.map((win) => {
          const morphing = flight && flight.id === win.id ? flight : null;
          let placement: Placement;
          let target;
          if (morphing?.phase === 'closing') {
            // pulang ke kartu/tab: jendela diam di kotak asalnya, proxy yang menyusut
            placement = 'hidden';
            const b = morphing.from;
            target = { x: b.left, y: b.top, w: b.width, h: b.height, scale: 1, opacity: 1 };
          } else if (!isLive(win) || win.minimized) {
            placement = 'hidden';
            // tetap di selnya agar memulihkan dari tab tidak melompat
            target = { ...cellOf(win.id), scale: 1, opacity: 0 };
          } else {
            const s = screenOf(win.id);
            const cell = cellOf(win.id);
            // layar lain: di sel layarnya, digeser sejauh lebar viewport per layar (bergeser saat pindah layar)
            const dx = (s - screen) * vp.w;
            placement = s === screen ? 'stage' : 'offscreen';
            target = { ...cell, x: cell.x + dx, scale: 1, opacity: 1 };
          }
          return (
            <StageWindow
              key={`${win.id}-${win.session}`}
              win={win}
              placement={placement}
              focused={win.id === focusedId}
              split={visibleNow.length > 1}
              target={target}
              morph={morphing ? morph : null}
              mobile={vp.mobile}
              expanded={state.expanded && win.id === focusedId}
              canSwitch={screens > 1}
              reduced={reduced}
              wm={actions}
              onFrameKey={onKey}
            />
          );
        })}
      </AnimatePresence>

      <TaskBar
        tabs={tabs}
        activeId={focusedId}
        minimized={minimizedSet}
        row={row}
        page={screen}
        perPage={K}
        onRow={setBarRow}
        onPage={goScreen}
        onTab={(id) => {
          if (id === focusedId) minimize(id);
          else if (minimizedSet.has(id)) launch(id, wm.getTabRect(id), 'bar');
          else {
            setBarPage(screenOf(id));
            wm.focus(id);
          }
        }}
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
