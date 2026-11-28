import { animate, motion, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { appById, apps } from '../../config/apps.config';
import { BAR_H, nextPageFromSwipe, pageCount, pageOf, pageSlots, slotsWidth, TABS_PER_PAGE, TB_ICON, TB_SLOT } from '../../lib/taskbar';
import type { AppId, RectSnapshot } from '../../types/os';
import { AppTile } from '../ui/AppTile';

/** Lebar satu halaman tab (4 ikon + 4 jarak): geseran track per halaman. */
const PAGE_W = TABS_PER_PAGE * TB_SLOT;
const AXIS_LOCK = 10;
const ROW_SWIPE = 24;
const LONG_PRESS_MS = 450;
const WHEEL_LOCK_MS = 250;
const SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;


const rectOf = (el: Element): RectSnapshot => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
};

interface Props {
  tabs: AppId[];
  activeId: AppId | null;
  minimized: Set<AppId>;
  /** 0 = tab berjalan, 1 = peluncur. Dikendalikan App supaya App bisa memaksa baris/halaman sebelum morph. */
  row: 0 | 1;
  page: number;
  onRow: (row: 0 | 1) => void;
  onPage: (page: number) => void;
  onTab: (id: AppId) => void;
  onLaunch: (id: AppId, origin: RectSnapshot) => void;
  registerTab: (id: AppId, el: HTMLElement | null) => void;
  /** Tab yang sedang "tiba" (ikon terbang menuju ke sana): ikonnya disembunyikan sampai mendarat. */
  arriving?: AppId | null;
  reduced: boolean;
}

type Gesture = { id: number; x0: number; y0: number; axis: 'x' | 'y' | null; lastX: number; lastT: number; v: number };

/**
 * Multitask Bar: pil melayang di bawah dengan dua baris yang di-snap vertikal.
 * Baris 1 = tab aplikasi berjalan (4 per halaman, geser kiri/kanan), baris 2 = peluncur kelima aplikasi.
 */
export function TaskBar({ tabs, activeId, minimized, row, page, onRow, onPage, onTab, onLaunch, registerTab, arriving, reduced }: Props) {
  const n = tabs.length;
  const pages = pageCount(n);
  const trackX = useMotionValue(-page * PAGE_W);
  const rowsY = useMotionValue(-row * BAR_H);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const wheelAt = useRef(0);
  const pressTimer = useRef<number | undefined>(undefined);
  const [label, setLabel] = useState<AppId | null>(null);
  const [bounce, setBounce] = useState<AppId | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const trackAnim = useRef<ReturnType<typeof animate> | null>(null);
  const settleTrack = (p: number) => {
    trackAnim.current?.stop();
    trackAnim.current = animate(trackX, -p * PAGE_W, reduced ? { duration: 0 } : SPRING);
  };
  useEffect(() => {
    settleTrack(page);
    return () => trackAnim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, trackX, reduced]);
  useEffect(() => {
    const c = animate(rowsY, -row * BAR_H, reduced ? { duration: 0 } : SPRING);
    return () => c.stop();
  }, [row, rowsY, reduced]);

  // roda mouse: deltaY ganti baris, deltaX / shift+roda ganti halaman (non-passive agar halaman di belakang tidak ikut menggulir)
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt.current < WHEEL_LOCK_MS) return;
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      // macOS mengubah shift+roda menjadi deltaX (deltaY = 0)
      const d = horizontal ? (e.shiftKey ? e.deltaY || e.deltaX : e.deltaX) : e.deltaY;
      if (Math.abs(d) < 4) return;
      wheelAt.current = now;
      if (horizontal) {
        if (row === 0) onPage(Math.min(Math.max(page + (d > 0 ? 1 : -1), 0), pages - 1));
      } else if (n > 0) onRow(d > 0 ? 1 : 0);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [row, page, pages, n, onRow, onPage]);

  const cancelPress = () => {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = undefined;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    swallowClick.current = false;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-app]')?.dataset.app as AppId | undefined;
    if (id && e.pointerType !== 'mouse') {
      pressTimer.current = window.setTimeout(() => {
        setLabel(id);
        swallowClick.current = true;
      }, LONG_PRESS_MS);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      cancelPress();
      trackAnim.current?.stop(); // drag mengambil alih pegas halaman yang mungkin masih berjalan
      // capture baru setelah arah terkunci: ketukan biasa tetap mengenai tombolnya
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      swallowClick.current = true;
    }
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.v = ((e.clientX - g.lastX) / dt) * 1000;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    if (g.axis === 'x' && row === 0) {
      const atEdge = (page === 0 && dx > 0) || (page === pages - 1 && dx < 0);
      trackX.set(-page * PAGE_W + dx * (atEdge ? 0.25 : 1));
    }
  };
  const endGesture = (e: React.PointerEvent, cancelled: boolean) => {
    cancelPress();
    if (e.pointerType !== 'mouse') window.setTimeout(() => setLabel(null), 900); // label tekan-lama
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (!g.axis) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.axis === 'x' && row === 0) {
      const next = cancelled ? page : nextPageFromSwipe(page, n, dx, PAGE_W, g.v);
      if (next !== page) onPage(next);
      else settleTrack(page);
    } else if (g.axis === 'y' && !cancelled && Math.abs(dy) >= ROW_SWIPE && n > 0) {
      // tarik ke atas = "gulir ke bawah" ke baris peluncur
      onRow(dy < 0 ? 1 : 0);
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (swallowClick.current) {
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = false;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nav = navRef.current;
    if (!nav) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (n === 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? 1 : 0;
      onRow(next);
      requestAnimationFrame(() => {
        const target =
          next === 1
            ? nav.querySelector<HTMLElement>('.tb-launch')
            : (nav.querySelector<HTMLElement>('.tb-tab[aria-current="true"]') ?? nav.querySelector<HTMLElement>('.tb-tab'));
        target?.focus({ preventScroll: true });
      });
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const list = [...nav.querySelectorAll<HTMLElement>(row === 0 ? '.tb-tab' : '.tb-launch')];
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    const j = Math.min(Math.max(i + (e.key === 'ArrowRight' ? 1 : -1), 0), list.length - 1);
    if (row === 0) onPage(Math.floor(j / TABS_PER_PAGE));
    list[j].focus({ preventScroll: true });
  };

  const slots = row === 1 ? apps.length : pageSlots(n, page);
  const running = new Set(tabs);

  return (
    <motion.nav
      ref={navRef}
      className="taskbar"
      data-row={row}
      data-page={page}
      aria-label="Aplikasi berjalan"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e, false)}
      onPointerCancel={(e) => endGesture(e, true)}
      // di sentuhan, tombol yang ditekan memegang capture implisit dan melepasnya saat bar mengambil alih:
      // hanya capture milik bar sendiri yang hilang yang berarti gestur batal
      onLostPointerCapture={(e) => e.target === e.currentTarget && endGesture(e, true)}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {n > 0 && (
        <button
          type="button"
          className="tb-hint"
          aria-label={row === 0 ? 'Tampilkan semua aplikasi' : 'Kembali ke tab'}
          data-up={row === 1 || undefined}
          onClick={() => onRow(row === 0 ? 1 : 0)}
        />
      )}
      <motion.div className="tb-viewport" animate={{ width: slotsWidth(slots) }} transition={reduced ? { duration: 0 } : SPRING} initial={false}>
        <motion.div className="tb-rows" style={{ y: rowsY }}>
          <div className="tb-row" aria-hidden={row !== 0 || undefined} inert={row !== 0 || undefined}>
            <motion.div className="tb-track" style={{ x: trackX }}>
              {tabs.map((id, index) => {
                const app = appById(id);
                const active = id === activeId;
                return (
                  <button
                    key={id}
                    type="button"
                    className="tb-tab"
                    data-app={id}
                    data-min={minimized.has(id) || undefined}
                    data-arriving={arriving === id || undefined}
                    aria-current={active || undefined}
                    aria-label={active ? `${app.name} (aktif), perkecil` : `Buka ${app.name}`}
                    onClick={() => onTab(id)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setLabel(id)}
                    onPointerLeave={() => setLabel(null)}
                    onFocus={(e) => {
                      onPage(pageOf(index)); // tab yang difokus keyboard selalu di halaman yang terlihat
                      if (e.currentTarget.matches(':focus-visible')) setLabel(id);
                    }}
                    onBlur={() => setLabel(null)}
                  >
                    <span className="tb-icon" ref={(el) => registerTab(id, el)}>
                      <AppTile id={id} size={TB_ICON} />
                    </span>
                    <span className="tb-ind" aria-hidden />
                  </button>
                );
              })}
            </motion.div>
          </div>
          <div className="tb-row" aria-hidden={row !== 1 || undefined} inert={row !== 1 || undefined}>
            <div className="tb-track">
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="tb-launch"
                  data-app={app.id}
                  aria-label={running.has(app.id) ? `${app.name} (berjalan)` : `Buka ${app.name}`}
                  data-bounce={bounce === app.id || undefined}
                  onClick={(e) => {
                    setBounce(app.id);
                    window.setTimeout(() => setBounce(null), 220);
                    onLaunch(app.id, rectOf(e.currentTarget.querySelector('.tb-icon')!));
                  }}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setLabel(app.id)}
                  onPointerLeave={() => setLabel(null)}
                  onFocus={(e) => e.currentTarget.matches(':focus-visible') && setLabel(app.id)}
                  onBlur={() => setLabel(null)}
                >
                  <span className="tb-icon">
                    <AppTile id={app.id} size={TB_ICON} />
                  </span>
                  {running.has(app.id) && <span className="tb-dot" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
      {row === 0 && pages > 1 && (
        <div className="tb-pages" aria-label={`Halaman ${page + 1} dari ${pages}`}>
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} data-on={i === page || undefined} />
          ))}
        </div>
      )}
      <LabelBubble id={label} navRef={navRef} />
    </motion.nav>
  );
}

/** Label nama aplikasi di atas ikon yang di-hover / difokus / ditekan lama. */
function LabelBubble({ id, navRef }: { id: AppId | null; navRef: React.RefObject<HTMLElement | null> }) {
  const [x, setX] = useState<number | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!id || !nav) return;
    const raf = requestAnimationFrame(() => {
      const row = nav.dataset.row === '1' ? '.tb-launch' : '.tb-tab';
      const el = nav.querySelector(`${row}[data-app="${id}"]`);
      if (!el) return setX(null);
      const r = el.getBoundingClientRect();
      setX(r.left + r.width / 2 - nav.getBoundingClientRect().left);
    });
    return () => cancelAnimationFrame(raf);
  }, [id, navRef]);
  if (!id || x === null) return null;
  return (
    <span className="tb-label" style={{ left: x }} role="tooltip">
      {appById(id).name}
    </span>
  );
}
