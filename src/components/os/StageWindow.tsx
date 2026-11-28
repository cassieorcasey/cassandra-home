import { Icon } from '../ui/Icon';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { appById } from '../../config/apps.config';
import type { Win, WindowActions } from '../../hooks/useWindowManager';
import type { AppId } from '../../types/os';
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
  /** Jendela layar tetangga yang mengintip di tepi: klik = pindah ke layarnya. */
  onPeek?: () => void;
  /** Desktop: header bisa diseret untuk mengatur posisi (ada jendela/layar lain). */
  arrange: boolean;
  /** Jendela lain sedang diseret di atas jendela ini: lepas = bertukar tempat. */
  dropTarget: boolean;
  reduced: boolean;
  wm: WindowActions;
  /** Tombol dari dalam iframe jendela ini (id = jendela asal). */
  onFrameKey: (e: KeyboardEvent, from: AppId) => void;
}

const spring = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;
const reducedFade = WINDOW_MORPH.reducedFadeMs / 1000;
const LOAD_TIMEOUT_MS = 15000;

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

export function StageWindow({ win, placement, focused, split, target, morph, mobile, expanded, canSwitch, onPeek, arrange, dropTarget, reduced, wm, onFrameKey }: Props) {
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

  const geo = free ? { ...target, ...free } : offset ? { ...target, x: target.x + offset.x, y: target.y + offset.y } : target;
  const initial = { x: target.x, y: target.y, width: target.w, height: target.h, scaleX: target.scale, scaleY: target.scale, opacity: 0 };
  // dengan morph kontennya sudah pudar; exit instan agar tak memakai nilai morph milik peluncuran berikutnya
  const exit = { opacity: 0, transition: { duration: morph ? 0 : reduced ? reducedFade : 0.08 } };
  const hideNow = placement === 'hidden' && !morph;
  // selama morph permukaan jendela transparan (proxy di bawahnya yang menggambar), kontennya
  // dipotong ke kotak proxy dan memudar lewat morph.content
  const shown = morph ? 1 : target.opacity;

  return (
    <motion.section
      className={`stage-window ${placed ? 'is-placed' : ''} ${focused ? 'is-focused is-active' : ''} ${split ? 'is-split' : ''} ${placement !== 'stage' ? 'is-hidden' : ''} ${swipeable && (mobile ? canSwitch : arrange) ? 'is-swipeable' : ''} ${free ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''} ${offset || dragging ? 'is-interacting' : ''} ${morph ? 'is-morphing' : ''} ${collapsed ? 'is-collapsed' : ''} ${onPeek ? 'is-peek' : ''}`}
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
      onClick={onPeek}
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
      transition={
        offset || free || collapsed
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

    </motion.section>
  );
}
