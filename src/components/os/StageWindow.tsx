import { Icon } from '../ui/Icon';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { appById } from '../../config/apps.config';
import type { Win, WindowActions } from '../../hooks/useWindowManager';
import type { AppId, Rect } from '../../types/os';
import { resizeRect, type ResizeEdge } from '../../lib/screens';
import { AppTile } from '../ui/AppTile';
import { WINDOW_MORPH } from '../../config/motion';
import type { Morph } from '../../hooks/useMorph';

/**
 * stage: tampil di sel grid layar aktif; offscreen: di sel layarnya sendiri tapi digeser ke
 * samping (layar lain, tetap terpasang agar perpindahan layar bisa bergeser); hidden: diperkecil.
 */
export type Placement = 'stage' | 'offscreen' | 'hidden';

interface Props {
  win: Win;
  placement: Placement;
  /** Jendela yang difokus di layar aktif: menerima Esc, header & tab-nya ditandai. */
  focused: boolean;
  /** Lebih dari satu jendela tampil di layar ini: jendela yang difokus diberi cincin penanda. */
  split: boolean;
  target: { x: number; y: number; w: number; h: number; scale: number; opacity: number };
  /** Nilai live morph bila jendela ini sedang membuka/menutup lewat Tile-to-Window Morph. */
  morph: Morph | null;
  mobile: boolean;
  expanded: boolean;
  /** Ada layar lain: header bisa diseret ke samping untuk pindah layar (kursor grab). */
  canSwitch: boolean;
  /** Jendela layar tetangga yang mengintip di tepi: layarnya (klik = pindah ke sana), selain itu null. */
  peekTo: number | null;
  /** Desktop: header bisa diseret untuk mengatur posisi (ada jendela/layar lain). */
  arrange: boolean;
  /** Jendela lain sedang diseret di atas jendela ini: lepas = bertukar tempat. */
  dropTarget: boolean;
  /** Desktop, satu-satunya jendela di layarnya: tepi & sudut bisa ditarik untuk mengubah ukuran. */
  resizable: boolean;
  /** Bingkai layar jendela ini (batas ukuran bebas). */
  bounds: Rect;
  /** Garis pembatas sedang diseret: ikuti target seketika, tanpa pegas. */
  instant: boolean;
  reduced: boolean;
  wm: WindowActions;
  /** Tombol dari dalam iframe jendela ini (id = jendela asal). */
  onFrameKey: (e: KeyboardEvent, from: AppId) => void;
}

const spring = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;
const reducedFade = WINDOW_MORPH.reducedFadeMs / 1000;
const LOAD_TIMEOUT_MS = 15000;
/** Tinggi header jendela (CSS .window-header) dan garis tepi 1 px tiap sisi: selisih jendela → area isi. */
const HEADER_H = 48;
const EDGE = 2;
/** Batas waktu memaku iframe bila animasi tidak melaporkan selesai. */
const PIN_SETTLE_MS = 700;

const EDGES: ResizeEdge[] = ['e', 'w', 's', 'se', 'sw'];
const CURSOR: Record<ResizeEdge, string> = { e: 'ew-resize', w: 'ew-resize', s: 'ns-resize', se: 'nwse-resize', sw: 'nesw-resize' };
/** Busur di sudut bawah (pegangan sudut yang terlihat). */
const ARC: Partial<Record<ResizeEdge, string>> = { se: 'M 6 30 A 24 24 0 0 0 30 6', sw: 'M 30 30 A 24 24 0 0 1 6 6' };

/** Target di header yang tetap berfungsi sebagai tombol, bukan pegangan swipe. */
const NO_DRAG = '.traffic, .hdr-actions, button, a';

/** Gesture header di ponsel: jarak minimal sebelum arah dikunci, dan ambang aksinya. */
const SWIPE_LOCK = 10;
const SWIPE_DOWN_MIN = 96; // tarik ke bawah sejauh ini → perkecil ke tab
const FLICK_SPEED = 0.6; // px/ms: sentakan cepat cukup separuh ambang

interface Gesture {
  pointerId: number;
  /** titik pegangan di dalam jendela (desktop, atur posisi) */
  gx: number;
  gy: number;
  /** posisi kursor terakhir */
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  /** arah yang dikunci setelah SWIPE_LOCK px, null bila belum. */
  axis: 'x' | 'y' | null;
  dx: number;
  dy: number;
  t: number;
  /** kecepatan terakhir (px/ms) pada sumbu terkunci */
  v: number;
}

/** Render ulang hanya bila sesuatu yang memengaruhi jendela ini berubah (bukan setiap render App). */
const sameRect = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
function propsEqual(a: Props, b: Props) {
  return (
    a.win === b.win &&
    a.placement === b.placement &&
    a.focused === b.focused &&
    a.split === b.split &&
    sameRect(a.target, b.target) &&
    a.target.scale === b.target.scale &&
    a.target.opacity === b.target.opacity &&
    a.morph === b.morph &&
    a.mobile === b.mobile &&
    a.expanded === b.expanded &&
    a.canSwitch === b.canSwitch &&
    a.peekTo === b.peekTo &&
    a.arrange === b.arrange &&
    a.dropTarget === b.dropTarget &&
    a.resizable === b.resizable &&
    sameRect(a.bounds, b.bounds) &&
    a.instant === b.instant &&
    a.reduced === b.reduced &&
    a.wm === b.wm &&
    a.onFrameKey === b.onFrameKey
  );
}

export const StageWindow = memo(StageWindowView, propsEqual);

function StageWindowView({ win, placement, focused, split, target, morph, mobile, expanded, canSwitch, peekTo, arrange, dropTarget, resizable, bounds, instant, reduced, wm, onFrameKey }: Props) {
  const app = appById(win.id);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const placed = placement === 'stage';
  const loading = win.load === 'loading';
  /** Header setiap jendela yang tampil bisa diseret: samping = geser seluruh layar (semua perangkat),
   *  bawah = perkecil (ponsel). */
  const swipeable = placed && !morph;
  /** Sudah pulang ke kartu/tab lewat morph: sembunyi seketika (konten sudah pudar, permukaan
   *  jendela tidak boleh berkedip sekejap di ukuran penuh saat proxy dilepas). */
  const collapsed = placement === 'hidden' && win.minimized && !reduced && !morph;

  // ---- geser sementara selama swipe (jendela mengikuti jari)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  // ---- ubah ukuran jendela tunggal lewat tepi/sudut: geometri live selama seret, disimpan saat dilepas
  const [live, setLive] = useState<Rect | null>(null);
  const [held, setHeld] = useState<ResizeEdge | null>(null);
  const resize = useRef<{ id: number; edge: ResizeEdge; sx: number; sy: number; start: Rect } | null>(null);
  const onResizeDown = (e: ReactPointerEvent<HTMLElement>, edge: ResizeEdge) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { id: e.pointerId, edge, sx: e.clientX, sy: e.clientY, start: { x: target.x, y: target.y, w: target.w, h: target.h } };
    setHeld(edge);
    if (!focused) wm.focus(win.id);
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const r = resize.current;
    if (!r || r.id !== e.pointerId) return;
    setLive(resizeRect(r.start, r.edge, e.clientX - r.sx, e.clientY - r.sy, bounds));
  };
  const onResizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    const r = resize.current;
    if (!r || r.id !== e.pointerId) return;
    resize.current = null;
    setHeld(null);
    if (live) wm.setCustomSize(win.id, live);
    setLive(null);
  };

  // ---- isi iframe "menyusul": selama ukuran jendela beranimasi atau diseret, iframe dipaku di ukuran
  // terbesar yang dilewati (dipotong / ada ruang kosong) dan baru menyesuaikan sekali di akhir. Mengubah
  // ukuran iframe tiap frame memaksa app di dalamnya me-layout ulang puluhan kali per detik.
  // Ukuran iframe terakhir yang sudah menyesuaikan; paku diturunkan dari situ (tanpa setState saat render):
  //  - diseret (garis pembatas / sudut): iframe tetap di ukuran settle, tidak berubah per gerakan;
  //  - beranimasi ke ukuran baru: iframe di ukuran terbesar antara settle dan tujuan, sekali.
  const [settled, setSettled] = useState({ w: target.w, h: target.h });
  const curW = live ? live.w : target.w;
  const curH = live ? live.h : target.h;
  const holding = instant || !!live;
  const pin =
    reduced || !placed || (!holding && settled.w === curW && settled.h === curH)
      ? null
      : holding
        ? settled
        : { w: Math.max(settled.w, curW), h: Math.max(settled.h, curH) };
  const unpin = () => {
    if (!holding && (settled.w !== curW || settled.h !== curH)) setSettled({ w: curW, h: curH });
  };
  // cadangan bila animasi tidak memicu onAnimationComplete (mis. ukuran akhir sama dengan seretan terakhir)
  const pinned = !!pin;
  useEffect(() => {
    if (!pinned || holding) return;
    const t = window.setTimeout(() => setSettled({ w: curW, h: curH }), PIN_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [pinned, holding, curW, curH]);

  /** Desktop: posisi kiri-atas jendela yang sedang diseret (menempel ke titik pegangan kursor). */
  const [free, setFree] = useState<{ x: number; y: number } | null>(null);
  /** Header sedang diseret (layar mengikuti kursor): iframe tidak boleh mencuri pointer. */
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  /** Seretan baru saja selesai (arah sempat terkunci): telan klik yang menyusul pointerup. */
  const draggedRef = useRef(false);

  const onHeaderDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!swipeable || e.button !== 0 || (e.target as Element).closest(NO_DRAG)) return;
    // desktop tanpa jendela/layar lain: tidak ada yang bisa diatur
    if (!mobile && !arrange) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId,
      gx: e.clientX - target.x,
      gy: e.clientY - target.y,
      cx: e.clientX,
      cy: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      axis: null,
      dx: 0,
      dy: 0,
      t: e.timeStamp,
      v: 0,
    };
    setDragging(true);
  };

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    g.cx = e.clientX;
    g.cy = e.clientY;
    // desktop: atur posisi — jendela mengikuti kursor bebas (dua sumbu)
    if (!mobile) {
      if (!g.axis) {
        if (Math.hypot(dx, dy) < SWIPE_LOCK) return;
        g.axis = 'x'; // tanda "sudah diseret" (untuk menelan klik susulan)
      }
      setFree({ x: e.clientX - g.gx, y: e.clientY - g.gy });
      wm.dragHover(win.id, e.clientX, e.clientY);
      return;
    }
    if (!g.axis) {
      if (Math.hypot(dx, dy) < SWIPE_LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    const dt = Math.max(1, e.timeStamp - g.t);
    g.v = g.axis === 'y' ? (dy - g.dy) / dt : (dx - g.dx) / dt;
    g.t = e.timeStamp;
    g.dx = dx;
    g.dy = dy;
    if (g.axis === 'x') wm.dragScreen(dx);
    // tarik ke bawah (ponsel) memindahkan jendela ini saja; ke atas diberi tahanan karet
    else if (mobile) setOffset({ x: 0, y: dy > 0 ? dy : dy * 0.15 });
  };

  const end = (commit: boolean) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    setOffset(null);
    setDragging(false);
    if (g.axis) {
      draggedRef.current = true;
      // tidak ada klik yang menyusul (mis. pointercancel): jangan telan klik berikutnya yang sungguhan
      window.setTimeout(() => (draggedRef.current = false), 0);
    }
    if (!mobile) {
      setFree(null);
      if (g.axis) wm.dragDrop(win.id, g.cx, g.cy, !commit);
      return;
    }
    if (g.axis === 'x') {
      // ponsel: geser ke kiri = layar berikutnya, ke kanan = sebelumnya (App memutuskan dari jarak & kecepatan)
      wm.endScreenDrag(g.dx, g.v * 1000, !commit);
      return;
    }
    if (commit && mobile && g.axis === 'y' && (g.dy > SWIPE_DOWN_MIN || (g.dy > SWIPE_DOWN_MIN / 2 && g.v > FLICK_SPEED))) {
      wm.minimize(win.id);
    }
  };

  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId === e.pointerId) end(true);
  };

  // jendela berhenti bisa di-swipe di tengah gesture (Esc, pindah layar): akhiri tanpa aksi
  const endRef = useRef(end);
  useEffect(() => {
    endRef.current = end;
  });
  useEffect(() => {
    if (!swipeable && gesture.current) endRef.current(false);
  }, [swipeable]);

  // Placeholder tidak boleh menggantung selamanya bila koneksi iframe tak pernah selesai
  // (Chrome & Safari tetap memicu load untuk halaman galat/X-Frame-Options; ini untuk yang hang).
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => wm.markReady(win.id), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, win.nonce]);

  // Bridge pintasan: aplikasi Cassandra satu origin, jadi keydown di dalam iframe bisa didengar langsung.
  const keyRef = useRef(onFrameKey);
  const focusSelf = useRef(() => {});
  useEffect(() => {
    keyRef.current = onFrameKey;
    focusSelf.current = () => wm.focus(win.id);
  });
  const attachBridge = () => {
    try {
      const w = frameRef.current?.contentWindow;
      w?.addEventListener('keydown', (e) => {
        // aplikasi sudah memakai tombol ini (mis. Esc menutup dialognya sendiri): jangan ikut menciutkan jendela
        if (e.defaultPrevented) return;
        keyRef.current(e, win.id);
      });
      // aplikasi satu origin: ketukan di dalamnya langsung memfokus jendela ini (tanpa menunggu polling)
      w?.addEventListener('pointerdown', () => focusSelf.current());
    } catch {
      /* lintas-origin: pintasan tidak diteruskan, Tab tetap bisa keluar */
    }
  };

  const geo = live ? { ...target, ...live } : free ? { ...target, ...free } : offset ? { ...target, x: target.x + offset.x, y: target.y + offset.y } : target;
  const initial = { x: target.x, y: target.y, width: target.w, height: target.h, scaleX: target.scale, scaleY: target.scale, opacity: 0 };
  // dengan morph kontennya sudah pudar; exit instan agar tak memakai nilai morph milik peluncuran berikutnya
  const exit = { opacity: 0, transition: { duration: morph ? 0 : reduced ? reducedFade : 0.08 } };
  const hideNow = placement === 'hidden' && !morph;
  // selama morph permukaan jendela transparan (proxy di bawahnya yang menggambar), kontennya
  // dipotong ke kotak proxy dan memudar lewat morph.content
  const shown = morph ? 1 : target.opacity;

  return (
    <motion.section
      className={`stage-window ${placed ? 'is-placed' : ''} ${focused ? 'is-focused is-active' : ''} ${split ? 'is-split' : ''} ${placement !== 'stage' ? 'is-hidden' : ''} ${swipeable && (mobile ? canSwitch : arrange) ? 'is-swipeable' : ''} ${free ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''} ${resizable ? 'is-resizable' : ''} ${live ? 'is-interacting' : ''} ${offset || dragging ? 'is-interacting' : ''} ${morph ? 'is-morphing' : ''} ${collapsed ? 'is-collapsed' : ''} ${peekTo !== null ? 'is-peek' : ''}`}
      data-app={win.id}
      aria-label={app.name}
      aria-hidden={!placed || undefined}
      inert={!placed}
      // klik/ketuk di mana pun di jendela (header, tepi) memfokusnya; klik di dalam iframe
      // ditangani App lewat window blur
      onPointerDownCapture={() => placed && !focused && wm.focus(win.id)}
      // klik yang dibuat browser saat seretan header dilepas bukan ketukan pada jendela yang mengintip
      onClickCapture={(e) => {
        if (!draggedRef.current) return;
        draggedRef.current = false;
        e.stopPropagation();
      }}
      onClick={peekTo !== null ? () => wm.goToScreen(peekTo) : undefined}
      initial={initial}
      animate={{
        x: geo.x,
        y: geo.y,
        width: geo.w,
        height: geo.h,
        scaleX: target.scale,
        scaleY: target.scale,
        opacity: shown,
        borderRadius: mobile && placed && expanded && focused ? 0 : mobile ? 14 : 18,
        // tampil seketika di awal animasi; sembunyi hanya setelah selesai memudar
        visibility: hideNow ? undefined : 'visible',
        transitionEnd: hideNow ? { visibility: 'hidden' } : undefined,
      }}
      exit={exit}
      onAnimationComplete={unpin}
      transition={
        offset || free || live || instant || collapsed
          ? { duration: 0 }
          : reduced
            ? { duration: reducedFade }
            : { ...spring, opacity: { duration: shown ? 0.14 : 0.08 } }
      }
      style={{ transformOrigin: '0 0', zIndex: free ? 33 : morph || (focused && expanded) ? 31 : placed ? 30 : 20, clipPath: morph ? morph.clip : 'none' }}
    >
      <motion.div
        className="window-inner"
        inert={!placed}
        style={{ opacity: morph ? morph.content : 1, scale: morph ? morph.scale : 1 }}
      >
        <header
          className="window-header"
          onPointerDown={onHeaderDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          {swipeable && (mobile ? canSwitch : arrange) && <span className="swipe-grabber" aria-hidden />}
          {/* kontrol jendela sama di desktop & ponsel; di ponsel jendela selalu penuh, jadi tanpa tombol perbesar */}
          <div className="traffic" role="group" aria-label="Kontrol jendela">
            <button type="button" className="tl tl-close" aria-label="Tutup" title="Tutup" onClick={() => wm.close(win.id)}>
              <Icon name="close" size={16} />
            </button>
            <button type="button" className="tl tl-min" aria-label="Perkecil ke bar" title="Perkecil ke bar (Esc)" onClick={() => wm.minimize(win.id)}>
              <Icon name="minus" size={16} />
            </button>
            <button
              type="button"
              className="tl tl-max"
              aria-label={expanded && focused ? 'Kembali ke grid' : 'Penuhi layar'}
              title={expanded && focused ? 'Kembali ke grid' : 'Penuhi layar'}
              onClick={() => wm.toggleExpand(win.id)}
            >
              <Icon name={expanded && focused ? 'shrink' : 'expand'} size={16} />
            </button>
          </div>

          <div className="window-title">
            <AppTile id={app.id} size={20} />
            <span>{app.name}</span>
          </div>

          <div className="hdr-actions">
            <button type="button" className="hdr-btn" aria-label="Muat ulang" title="Muat ulang" onClick={() => wm.refresh(win.id)}>
              <Icon name="refresh" />
            </button>
            <a className="hdr-btn" href={app.url} target="_blank" rel="noopener" aria-label="Buka di tab baru" title="Buka di tab baru">
              <Icon name="external" />
            </a>
          </div>

          <motion.div
            className="loading-bar"
            aria-hidden
            // mulai dari 0 (dulu initial={false} langsung menampilkan 90 %, animasinya tak pernah jalan)
            initial={{ scaleX: 0, opacity: 1 }}
            // scaleX (komposit) bukan width (layout tiap frame selama 2,4 s)
            style={{ originX: 0 }}
            animate={loading ? { scaleX: 0.9, opacity: 1 } : { scaleX: 1, opacity: 0 }}
            transition={loading ? { duration: 2.4, ease: [0.2, 0, 0, 1] } : { duration: 0.35 }}
            key={win.nonce}
          />
        </header>

        <div className="window-body" aria-busy={loading}>
          {app.embedMode === 'iframe' ? (
            <>
              <iframe
                key={win.nonce}
                ref={frameRef}
                src={app.url}
                title={app.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
                onLoad={() => {
                  attachBridge();
                  wm.markReady(win.id);
                }}
                className={loading ? 'is-loading' : ''}
                style={pin ? { width: Math.max(0, pin.w - EDGE), height: Math.max(0, pin.h - HEADER_H - EDGE) } : undefined}
              />
              {loading && (
                <div className="frame-placeholder">
                  <AppTile id={app.id} size={72} />
                  <span className="sr-only">Memuat {app.name}…</span>
                </div>
              )}
            </>
          ) : (
            <div className="preview-card">
              <AppTile id={app.id} size={88} />
              <h2>{app.name}</h2>
              <p>{app.tagline}</p>
              <a className="btn-primary" href={app.url} target="_blank" rel="noopener">
                Buka di tab baru
              </a>
            </div>
          )}
        </div>
      </motion.div>

      {resizable &&
        placed &&
        !morph &&
        EDGES.map((edge) => (
          <span
            key={edge}
            className={`rz rz-${edge} ${held === edge ? 'is-held' : ''}`}
            aria-hidden
            style={{ cursor: CURSOR[edge] }}
            onPointerDown={(e) => onResizeDown(e, edge)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
          >
            {ARC[edge] && (
              <svg className="rz-arc" viewBox="0 0 36 36">
                <path d={ARC[edge]} stroke="currentColor" strokeWidth={5} strokeLinecap="round" fill="none" />
              </svg>
            )}
          </span>
        ))}
    </motion.section>
  );
}
