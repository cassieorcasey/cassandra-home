import { Icon } from '../ui/Icon';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { appById } from '../../config/apps.config';
import type { Win, WindowActions } from '../../hooks/useWindowManager';

export type Placement = 'stage' | 'deck' | 'hidden';

interface Props {
  win: Win;
  placement: Placement;
  target: { x: number; y: number; w: number; h: number; scale: number; opacity: number };
  /** false selama cangkang penerbangan masih menuju stage. */
  revealed: boolean;
  mobile: boolean;
  expanded: boolean;
  reduced: boolean;
  wm: WindowActions;
  onFrameKey: (e: KeyboardEvent) => void;
}

const spring = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;

export function StageWindow({ win, placement, target, revealed, mobile, expanded, reduced, wm, onFrameKey }: Props) {
  const app = appById(win.id);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = placement === 'stage';
  const loading = win.load === 'loading';

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

  const initial = { x: target.x, y: target.y, width: target.w, height: target.h, scaleX: target.scale, scaleY: target.scale, opacity: 0 };
  const exit = { opacity: 0, transition: { duration: reduced ? 0.18 : 0.08 } };
  const shown = revealed ? target.opacity : 0;

  return (
    <motion.section
      className={`stage-window ${active ? 'is-active' : ''} ${placement === 'deck' ? 'is-deck' : ''}`}
      aria-label={app.name}
      initial={initial}
      animate={{
        x: target.x,
        y: target.y,
        width: target.w,
        height: target.h,
        scaleX: target.scale,
        scaleY: target.scale,
        opacity: shown,
        borderRadius: mobile && active ? 0 : 18,
        transitionEnd: { visibility: placement === 'hidden' ? 'hidden' : 'visible' },
      }}
      exit={exit}
      transition={reduced ? { duration: 0.18 } : { ...spring, opacity: { duration: shown ? 0.14 : 0.08 } }}
      style={{ transformOrigin: '0 0', visibility: 'visible', zIndex: active ? 30 : 20 }}
    >
      <div className="window-inner" inert={!active}>
        <header className="window-header">
          {mobile ? (
            <button type="button" className="hdr-btn" aria-label="Kembali ke Home" onClick={wm.minimize}>
              <Icon name="chevronLeft" />
            </button>
          ) : (
            <div className="traffic" role="group" aria-label="Kontrol jendela">
              <button type="button" className="tl tl-close" aria-label="Tutup" title="Tutup" onClick={() => wm.close(win.id)}>
                <Icon name="close" size={11} />
              </button>
              <button type="button" className="tl tl-min" aria-label="Minimize ke Dock" title="Minimize (Esc)" onClick={wm.minimize}>
                <Icon name="minus" size={11} />
              </button>
              <button
                type="button"
                className="tl tl-max"
                aria-label={expanded ? 'Perkecil' : 'Perluas'}
                title={expanded ? 'Perkecil' : 'Perluas'}
                onClick={wm.toggleExpand}
              >
                <Icon name={expanded ? 'shrink' : 'expand'} size={11} />
              </button>
            </div>
          )}

          <div className="window-title">
            <img src={app.icon} alt="" width={20} height={20} />
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
                  <img src={app.icon} alt="" width={72} height={72} />
                  <span className="sr-only">Memuat {app.name}…</span>
                </div>
              )}
            </>
          ) : (
            <div className="preview-card">
              <img src={app.icon} alt="" width={88} height={88} />
              <h2>{app.name}</h2>
              <p>{app.tagline}</p>
              <a className="btn-primary" href={app.url} target="_blank" rel="noopener">
                Buka di tab baru
              </a>
            </div>
          )}
        </div>
      </div>

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
