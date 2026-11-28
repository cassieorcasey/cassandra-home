import { animate, AnimatePresence, motion, MotionConfig, useMotionValue, useReducedMotion } from 'motion/react';
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
import { screenFrame, screenLayout, screenShift, type PeekSpec } from './lib/screens';
import { clampPage, nextPageFromSwipe, pageCount, pageOf, screenCapacity, tabSlotRect, TB_ICON } from './lib/taskbar';
import { Icon } from './components/ui/Icon';
import type { AppId, Rect, RectSnapshot } from './types/os';

/** Pegas geser layar (sama dengan halaman bar). */
const SCREEN_SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
/** Geser trackpad ke samping sejauh ini (akumulasi deltaX) untuk pindah layar. */
const WHEEL_SWITCH = 60;
const WHEEL_LOCK_MS = 500;
/** Atur posisi (desktop): tahan jendela yang diseret sedekat ini dengan tepi selama ini → pindah layar. */
const ARRANGE_EDGE = 52;
const ARRANGE_EDGE_MS = 380;

/** Sensor tepi mengabaikan kursor sesaat setelah layar berpindah atau seretan header dilepas: sensor
 *  yang muncul/berada di bawah kursor saat itu menerima pointerenter dari browser, dan itu bukan
 *  gerakan pengguna menuju tepi. */
const SENSOR_SETTLE_MS = 450;
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

  /** Layar tetangga mengintip di tepi saat ada lebih dari satu layar (54 px desktop, 24 px ponsel). */
  const peekSpec: PeekSpec = vp.mobile ? { w: vp.w, peek: 24, gap: 8, margin: 8 } : { w: vp.w, peek: 54, gap: 12, margin: 24 };
  /**
   * Layout layar `s` untuk urutan tab & himpunan diperkecil tertentu, dalam koordinat viewport saat
   * layar `cur` tampil (layar lain bergeser ke samping; tetangganya mengintip di tepi).
   */
  const layout = (s: number, list: AppId[] = tabs, min: Set<AppId> = minimizedSet, cur: number = screen) =>
    screenLayout(list, min, s, K, screenFrame(stage, peekSpec, s, pageCount(list.length, K), cur), gap);
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
    const cell = layout(s, list, without(minimizedSet, id), s).get(id) ?? stage;
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

  // ---- geser layar dengan kursor/jari: seluruh lapisan jendela mengikuti, lalu berpindah atau kembali
  const dragX = useMotionValue(0);
  const dragAnim = useRef<ReturnType<typeof animate> | null>(null);
  const dragScreen = (dx: number) => {
    dragAnim.current?.stop();
    const atEdge = (dx > 0 && screen === 0) || (dx < 0 && screen >= screens - 1);
    dragX.set(atEdge ? dx * 0.15 : dx); // tahanan karet di ujung
  };
  /** Awal masa tenang sensor tepi (perpindahan layar / seretan dilepas). */
  const sensorQuietFrom = useRef(0);
  const endScreenDrag = (dx: number, v: number, cancelled: boolean) => {
    sensorQuietFrom.current = performance.now();
    const next = cancelled ? screen : nextPageFromSwipe(screen, tabs.length, dx, screens > 1 ? screenShift(peekSpec) : vp.w, v, K);
    if (next !== screen) goScreen(next);
    // jendela meluncur ke posisi layar barunya sementara offset seret kembali ke 0: geraknya menyambung
    dragAnim.current = animate(dragX, 0, reduced ? { duration: 0 } : SCREEN_SPRING);
  };

  // ---- atur posisi (desktop): seret header, lepas di atas jendela lain = tukar; tahan di tepi = pindah layar
  const [dropTarget, setDropTarget] = useState<AppId | null>(null);
  const edgeHold = useRef<{ dir: 0 | 1 | -1; timer: number | undefined }>({ dir: 0, timer: undefined });
  const clearEdgeHold = () => {
    window.clearTimeout(edgeHold.current.timer);
    edgeHold.current = { dir: 0, timer: undefined };
  };
  /** Jendela lain yang tampil di layar aktif dan berada di bawah titik (x, y). */
  const windowAt = (id: AppId, x: number, y: number) => {
    for (const [other, r] of layout(screen)) {
      if (other !== id && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return other;
    }
    return null;
  };
  /** Tukar posisi dua app di urutan tab (urutan = isi tiap layar). */
  const swapOrder = (a: AppId, b: AppId) => {
    const order = [...tabs];
    const i = order.indexOf(a);
    const j = order.indexOf(b);
    if (i === -1 || j === -1) return;
    [order[i], order[j]] = [order[j], order[i]];
    wm.reorder(order);
  };
  /**
   * Pindahkan app ke layar sebelah. Layar = potongan urutan yang selalu penuh, jadi app bertukar dengan
   * slot pertama layar kanan / slot terakhir layar kiri.
   */
  const moveToScreen = (id: AppId, dir: 1 | -1) => {
    const s = screenOf(id) + dir;
    if (s < 0 || s >= screens) return;
    const j = dir > 0 ? s * K : Math.min(s * K + K - 1, tabs.length - 1);
    swapOrder(id, tabs[j]);
    setBarPage(s);
  };
  const dragHover = (id: AppId, x: number, y: number) => {
    const s = screenOf(id);
    const dir: 0 | 1 | -1 = x >= vp.w - ARRANGE_EDGE && s < screens - 1 ? 1 : x <= ARRANGE_EDGE && s > 0 ? -1 : 0;
    if (dir !== edgeHold.current.dir) {
      clearEdgeHold();
      if (dir) {
        edgeHold.current = {
          dir,
          timer: window.setTimeout(() => {
            edgeHold.current = { dir: 0, timer: undefined };
            moveRef.current(id, dir);
          }, ARRANGE_EDGE_MS),
        };
      }
    }
    const t = dir ? null : windowAt(id, x, y);
    if (t !== dropTarget) setDropTarget(t);
  };
  const moveRef = useRef(moveToScreen);
  useEffect(() => {
    moveRef.current = moveToScreen;
  });
  const dragDrop = (id: AppId, x: number, y: number, cancelled: boolean) => {
    clearEdgeHold();
    setDropTarget(null);
    sensorQuietFrom.current = performance.now(); // kursor dilepas di dekat tepi: sensor jangan ikut memicu
    const t = cancelled ? null : windowAt(id, x, y);
    if (t) swapOrder(id, t);
    wm.focus(id);
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
    dragScreen,
    endScreenDrag,
    dragHover,
    dragDrop,
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

  // geser dua jari ke samping di trackpad (di atas header, celah, tepi; di dalam iframe milik app-nya)
  const wheelAcc = useRef({ sum: 0, lockUntil: 0 });
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelRef.current = (e: WheelEvent) => {
      if (screens < 2 || visibleNow.length === 0) return;
      if ((e.target as Element | null)?.closest?.('.taskbar, .spotlight')) return; // bar punya roda sendiri
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
      const now = performance.now();
      if (now < wheelAcc.current.lockUntil) return;
      wheelAcc.current.sum += e.deltaX;
      if (Math.abs(wheelAcc.current.sum) >= WHEEL_SWITCH) {
        goScreen(screen + (wheelAcc.current.sum > 0 ? 1 : -1));
        wheelAcc.current = { sum: 0, lockUntil: now + WHEEL_LOCK_MS };
      }
    };
  });
  useEffect(() => {
    const on = (e: WheelEvent) => wheelRef.current(e);
    window.addEventListener('wheel', on, { passive: true });
    return () => window.removeEventListener('wheel', on);
  }, []);

  useEffect(() => {
    sensorQuietFrom.current = performance.now();
  }, [screen]);

  /**
   * Pindah layar lewat tepi (meniru cutefish.my.id): di desktop, sensor tak terlihat selebar 72 px di
   * atas tepi layar tetangga yang mengintip; kursor masuk = langsung pindah, tanpa klik dan tanpa jeda.
   * Di ponsel (tanpa kursor): tombol panah melayang di kiri/kanan.
   */
  const edgeControl = (side: 'left' | 'right') => {
    const s = screen + (side === 'right' ? 1 : -1);
    if (s < 0 || s >= screens || visibleNow.length === 0) return null;
    if (vp.mobile) {
      return (
        <button
          key={side}
          type="button"
          className="screen-arrow"
          data-side={side}
          aria-label={side === 'right' ? 'Layar berikutnya' : 'Layar sebelumnya'}
          onClick={() => goScreen(s)}
        >
          <Icon name={side === 'right' ? 'chevron-right' : 'chevron-left'} size={22} />
        </button>
      );
    }
    return (
      <div
        key={side}
        className="edge-sensor"
        data-side={side}
        aria-hidden
        onPointerEnter={(e) =>
          e.pointerType === 'mouse' && e.buttons === 0 && performance.now() - sensorQuietFrom.current > SENSOR_SETTLE_MS && goScreen(s)
        }
        onClick={() => goScreen(s)}
      />
    );
  };

  const flight = state.flight;
  const dim: LaunchpadDim = visibleNow.length === 0 ? 'none' : flight?.phase === 'opening' ? 'dim' : 'away';

  return (
    <MotionConfig reducedMotion="user">
      <div className="wallpaper" aria-hidden />
      <div id="safe-probe-top" aria-hidden />
      <div id="safe-probe" aria-hidden />

      <Launchpad dim={dim} barShown={tabs.length > 0} running={running} reduced={reduced} onLaunch={(id) => launch(id, null)} registerTile={wm.registerTileElement} />

      {/* lapisan geser layar: semua jendela ikut offset seret; posisi tetap (fixed) jendela tidak berubah */}
      <motion.div className="stage-track" style={{ x: dragX }}>
        <AnimatePresence>
          {/* urutan DOM tetap (per sesi): menukar urutan tab tidak boleh memindahkan elemen jendela,
              karena itu memutus pointer capture jendela yang sedang diseret */}
          {[...state.wins].sort((a, b) => a.session - b.session).map((win) => {
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
              // layar lain sudah tergeser oleh bingkai layarnya (screenFrame); tetangga mengintip di tepi
              placement = screenOf(win.id) === screen ? 'stage' : 'offscreen';
              target = { ...cellOf(win.id), scale: 1, opacity: 1 };
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
                arrange={!vp.mobile && tabs.length > 1}
                dropTarget={dropTarget === win.id}
                onPeek={!isLive(win) || win.minimized || screenOf(win.id) === screen ? undefined : () => goScreen(screenOf(win.id))}
                reduced={reduced}
                wm={actions}
                onFrameKey={onKey}
              />
            );
          })}
        </AnimatePresence>
      </motion.div>

      {edgeControl('left')}
      {edgeControl('right')}

      {/* Bar hanya ada selama ada app berjalan: muncul dari bawah saat app pertama dibuka,
          turun lagi setelah app terakhir ditutup. Home tanpa app tetap bersih. */}
      <AnimatePresence>
        {tabs.length > 0 && (
          <motion.div
            key="taskbar"
            className="taskbar-slot"
            initial={reduced ? { opacity: 0 } : { y: '140%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '140%' }}
            transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 34 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
