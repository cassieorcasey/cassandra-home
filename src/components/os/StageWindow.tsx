import { Icon } from '../ui/Icon';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { appById } from '../../config/apps.config';
import { clampWindowRect, type ResizeEdge, type Viewport } from '../../hooks/useViewport';
import type { Win, WindowActions } from '../../hooks/useWindowManager';
import { AppTile } from '../ui/AppTile';
import type { Rect } from '../../types/os';

export type Placement = 'stage' | 'deck' | 'hidden';

interface Props {
  win: Win;
  placement: Placement;
  target: { x: number; y: number; w: number; h: number; scale: number; opacity: number };
  /** false selama cangkang penerbangan masih menuju stage. */
  revealed: boolean;
  mobile: boolean;
  expanded: boolean;
  /** Ada aplikasi lain yang berjalan: swipe samping di ponsel bisa berpindah. */
  canCycle: boolean;
  /** Viewport saat ini; dipakai pembatas geometri selama drag/resize. */
  vp: Viewport;
  reduced: boolean;
  wm: WindowActions;
  onFrameKey: (e: KeyboardEvent) => void;
}

const spring = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;

/** Tepi atas sengaja tanpa pegangan: header-lah pegangan geser (pola referensi). */
const EDGES: ResizeEdge[] = ['e', 'w', 's', 'se', 'sw'];
/** Busur seperempat lingkaran untuk pegangan sudut bawah (viewBox 36). */
const ARC: Partial<Record<ResizeEdge, string>> = {
  se: 'M 6 30 A 24 24 0 0 0 30 6',
  sw: 'M 30 30 A 24 24 0 0 1 6 6',
};
const CURSOR: Record<ResizeEdge, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'sw-resize',
  nw: 'nwse-resize',
  se: 'se-resize',
};
/** Target di header yang tetap berfungsi sebagai tombol, bukan pegangan geser. */
const NO_DRAG = '.traffic, .hdr-actions, button, a';

/** Gesture header di ponsel: jarak minimal sebelum arah dikunci, dan ambang aksinya. */
const SWIPE_LOCK = 10;
const SWIPE_DOWN_MIN = 96; // tarik ke bawah sejauh ini → minimize
const SWIPE_SIDE_MIN = 72; // geser ke samping sejauh ini → pindah aplikasi
const FLICK_SPEED = 0.6; // px/ms: sentakan cepat cukup separuh ambang

interface Gesture {
  kind: 'move' | 'swipe' | ResizeEdge;
  pointerId: number;
  sx: number;
  sy: number;
  start: Rect;
  /** swipe: arah yang dikunci setelah SWIPE_LOCK px, null bila belum. */
  axis: 'x' | 'y' | null;
  dx: number;
  dy: number;
  t: number;
  /** kecepatan terakhir (px/ms) pada sumbu terkunci */
  v: number;
}

export function StageWindow({ win, placement, target, revealed, mobile, expanded, canCycle, vp, reduced, wm, onFrameKey }: Props) {
  const app = appById(win.id);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = placement === 'stage';
  const loading = win.load === 'loading';
  /** Drag & resize hanya untuk jendela aktif di desktop, dan dimatikan selama expanded. */
  const interactive = active && !mobile && !expanded;
  /** Di ponsel header jendela aktif menerima swipe: bawah = minimize, samping = pindah aplikasi. */
  const swipeable = active && mobile;

  // ---- geometri sementara: lokal di sini selama gesture, dikirim ke window manager sekali di akhir
  const [live, setLive] = useState<Rect | null>(null);
  /** Gesture yang sedang berjalan (null = tidak ada); dipakai untuk kelas tampilan. */
  const [busy, setBusy] = useState<Gesture['kind'] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const liveRef = useRef<Rect | null>(null);

  const setGlobalLock = (cursor: string | null) => {
    const root = document.documentElement;
    if (cursor) {
      root.setAttribute('data-wm-interacting', '');
      root.style.setProperty('--wm-cursor', cursor);
    } else {
      root.removeAttribute('data-wm-interacting');
      root.style.removeProperty('--wm-cursor');
    }
  };

  const begin = (e: ReactPointerEvent<HTMLElement>, kind: Gesture['kind']) => {
    if (!(kind === 'swipe' ? swipeable : interactive) || e.button !== 0) return;
    // gesture lama yang pointerup-nya hilang tidak boleh memblokir gesture baru
    if (gesture.current) end(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      kind,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      start: { x: target.x, y: target.y, w: target.w, h: target.h },
      axis: null,
      dx: 0,
      dy: 0,
      t: e.timeStamp,
      v: 0,
    };
    liveRef.current = null;
    setBusy(kind);
    setGlobalLock(kind === 'move' ? 'grabbing' : kind === 'swipe' ? 'default' : CURSOR[kind]);
  };

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    const s = g.start;
    let next: Rect;
    if (g.kind === 'swipe') {
      if (!g.axis) {
        if (Math.hypot(dx, dy) < SWIPE_LOCK) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      const dt = Math.max(1, e.timeStamp - g.t);
      g.v = g.axis === 'y' ? (dy - g.dy) / dt : (dx - g.dx) / dt;
      g.t = e.timeStamp;
      g.dx = dx;
      g.dy = dy;
      // jendela mengikuti jari; ke atas dan ke samping tanpa aplikasi lain diberi tahanan karet
      next =
        g.axis === 'y'
          ? { ...s, y: s.y + (dy > 0 ? dy : dy * 0.15) }
          : { ...s, x: s.x + dx * (canCycle ? 0.6 : 0.15) };
    } else if (g.kind === 'move') {
      next = clampWindowRect({ ...s, x: s.x + dx, y: s.y + dy }, vp);
    } else {
      const k = g.kind;
      const left = s.x + (k.includes('w') ? dx : 0);
      const top = s.y + (k.includes('n') ? dy : 0);
      const right = s.x + s.w + (k.includes('e') ? dx : 0);
      const bottom = s.y + s.h + (k.includes('s') ? dy : 0);
      next = clampWindowRect({ x: left, y: top, w: right - left, h: bottom - top }, vp, k);
    }
    liveRef.current = next;
    setLive(next);
  };

  const end = (commit: boolean) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    const final = liveRef.current;
    liveRef.current = null;
    if (g.kind === 'swipe') {
      if (commit && g.axis === 'y' && (g.dy > SWIPE_DOWN_MIN || (g.dy > SWIPE_DOWN_MIN / 2 && g.v > FLICK_SPEED))) {
        wm.minimize();
      } else if (
        commit &&
        canCycle &&
        g.axis === 'x' &&
        (Math.abs(g.dx) > SWIPE_SIDE_MIN || (Math.abs(g.dx) > SWIPE_SIDE_MIN / 2 && Math.abs(g.v) > FLICK_SPEED))
      ) {
        // geser ke kiri = aplikasi berikutnya, ke kanan = sebelumnya (seperti bilah Home iPhone)
        wm.cycle(win.id, g.dx < 0 ? 1 : -1);
      }
    } else if (commit && final) wm.setRect(win.id, final);
    setLive(null);
    setBusy(null);
    setGlobalLock(null);
  };

  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId === e.pointerId) end(true);
  };

  // Jaring pengaman: pointerup bisa hilang (tombol dilepas di luar browser, di atas iframe,
  // capture lepas karena fokus pindah). Tanpa ini gesture menggantung: iframe tetap
  // pointer-events:none dan seluruh halaman terkunci.
  const endRef = useRef(end);
  useEffect(() => {
    endRef.current = end;
  });
  useEffect(() => {
    if (!busy) return;
    const finish = (e: PointerEvent) => {
      if (gesture.current && e.pointerId === gesture.current.pointerId) endRef.current(true);
    };
    const abort = () => endRef.current(true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('blur', abort);
    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('blur', abort);
    };
  }, [busy]);

  // jendela berhenti interaktif di tengah gesture (Esc, expand, pindah fokus): akhiri tanpa menyimpan
  useEffect(() => {
    if (!interactive && !swipeable) end(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, swipeable]);
  // jangan tinggalkan kunci seleksi/cursor global bila jendela dilepas saat gesture berjalan
  useEffect(() => () => setGlobalLock(null), []);

  const onHeaderDown = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest(NO_DRAG)) return;
    begin(e, mobile ? 'swipe' : 'move');
  };

  useEffect(() => {
    if (!active) setMenuOpen(false);
  }, [active]);

  // Bridge pintasan: aplikasi Cassandra satu origin, jadi keydown di dalam iframe bisa didengar langsung.
  const keyRef = useRef(onFrameKey);
  keyRef.current = onFrameKey;
  const attachBridge = () => {
    try {
      const w = frameRef.current?.contentWindow;
      w?.addEventListener('keydown', (e) => keyRef.current(e));
    } catch {
      /* lintas-origin: pintasan tidak diteruskan, Tab tetap bisa keluar */
    }
  };

  const geo = live ?? target;
  const initial = { x: target.x, y: target.y, width: target.w, height: target.h, scaleX: target.scale, scaleY: target.scale, opacity: 0 };
  const exit = { opacity: 0, transition: { duration: reduced ? 0.18 : 0.08 } };
  const shown = revealed ? target.opacity : 0;

  return (
    <motion.section
      className={`stage-window ${active ? 'is-active' : ''} ${placement === 'deck' ? 'is-deck' : ''} ${placement === 'hidden' ? 'is-hidden' : ''} ${interactive ? 'is-movable' : ''} ${swipeable ? 'is-swipeable' : ''} ${busy ? 'is-interacting' : ''}`}
      aria-label={app.name}
      aria-hidden={placement === 'hidden' || undefined}
      inert={placement === 'hidden'}
      initial={initial}
      animate={{
        x: geo.x,
        y: geo.y,
        width: geo.w,
        height: geo.h,
        scaleX: target.scale,
        scaleY: target.scale,
        opacity: shown,
        borderRadius: mobile && active ? 0 : 18,
        transitionEnd: { visibility: placement === 'hidden' ? 'hidden' : 'visible' },
      }}
      exit={exit}
      transition={
        live
          ? { duration: 0 }
          : reduced
            ? { duration: 0.18 }
            : { ...spring, opacity: { duration: shown ? 0.14 : 0.08 } }
      }
      style={{ transformOrigin: '0 0', zIndex: active ? 30 : 20 }}
    >
      <div className="window-inner" inert={!active}>
        <header
          className="window-header"
          onPointerDown={onHeaderDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          {swipeable && <span className="swipe-grabber" aria-hidden />}
          {mobile ? (
            <button type="button" className="hdr-btn" aria-label="Kembali ke Home" onClick={wm.minimize}>
              <Icon name="chevronLeft" />
            </button>
          ) : (
            <div className="traffic" role="group" aria-label="Kontrol jendela">
              <button type="button" className="tl tl-close" aria-label="Tutup" title="Tutup" onClick={() => wm.close(win.id)}>
                <Icon name="close" size={10} />
              </button>
              <button type="button" className="tl tl-min" aria-label="Minimize ke Dock" title="Minimize (Esc)" onClick={wm.minimize}>
                <Icon name="minus" size={10} />
              </button>
              <button
                type="button"
                className="tl tl-max"
                aria-label={expanded ? 'Perkecil' : 'Perluas'}
                title={expanded ? 'Perkecil' : 'Perluas'}
                onClick={wm.toggleExpand}
              >
                <Icon name={expanded ? 'shrink' : 'expand'} size={10} />
              </button>
            </div>
          )}

          <div className="window-title">
            <AppTile id={app.id} size={20} />
            <span>{app.name}</span>
          </div>

          {mobile ? (
            <div className="menu-wrap">
              <button
                type="button"
                className="hdr-btn"
                aria-label="Menu jendela"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Icon name="more" />
              </button>
              {menuOpen && (
                <div className="window-menu glass" role="menu">
                  <button role="menuitem" onClick={() => { setMenuOpen(false); wm.refresh(win.id); }}>
                    <Icon name="refresh" />Muat ulang
                  </button>
                  <a role="menuitem" href={app.url} target="_blank" rel="noopener" onClick={() => setMenuOpen(false)}>
                    <Icon name="external" />Buka di tab baru
                  </a>
                  <button role="menuitem" className="danger" onClick={() => wm.close(win.id)}>
                    <Icon name="close" />Tutup aplikasi
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hdr-actions">
              <button type="button" className="hdr-btn" aria-label="Muat ulang" title="Muat ulang" onClick={() => wm.refresh(win.id)}>
                <Icon name="refresh" />
              </button>
              <a className="hdr-btn" href={app.url} target="_blank" rel="noopener" aria-label="Buka di tab baru" title="Buka di tab baru">
                <Icon name="external" />
              </a>
            </div>
          )}

          <motion.div
            className="loading-bar"
            aria-hidden
            initial={false}
            animate={loading ? { width: '90%', opacity: 1 } : { width: '100%', opacity: 0 }}
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
      </div>

      {interactive &&
        EDGES.map((edge) => (
          <span
            key={edge}
            className={`rz rz-${edge} ${busy === edge ? 'is-held' : ''}`}
            aria-hidden
            style={{ cursor: CURSOR[edge] }}
            onPointerDown={(e) => begin(e, edge)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onLostPointerCapture={onUp}
          >
            {ARC[edge] && (
              <svg className="rz-arc" viewBox="0 0 36 36">
                <path d={ARC[edge]} stroke="currentColor" strokeWidth={5} strokeLinecap="round" fill="none" />
              </svg>
            )}
          </span>
        ))}

      {placement === 'deck' && (
        <button type="button" className="deck-hit" aria-label={`Pindah ke ${app.name}`} onClick={() => wm.focus(win.id)}>
          <span className="deck-label" style={{ fontSize: 13 / target.scale, padding: `${4 / target.scale}px ${10 / target.scale}px` }}>
            {app.name}
          </span>
        </button>
      )}
    </motion.section>
  );
}
