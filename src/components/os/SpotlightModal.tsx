import { Icon } from '../ui/Icon';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apps } from '../../config/apps.config';
import { AppTile } from '../ui/AppTile';
import type { AppId, RectSnapshot } from '../../types/os';

interface Props {
  reduced: boolean;
  onClose: () => void;
  /** origin = potret baris hasil yang dipilih, titik asal morph ke jendela */
  onLaunch: (id: AppId, origin: RectSnapshot | null) => void;
}

/** Modal menutup cepat (≈100 ms) begitu item dipilih, sementara morph sudah berangkat. */
const EXIT = { duration: 0.1 };

function snapshotOf(el: HTMLElement | null): RectSnapshot | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    borderRadius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
  };
}

export function SpotlightModal({ reduced, onClose, onLaunch }: Props) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fokus sinkron saat mount (masih di dalam rantai event ketukan) agar keyboard iOS muncul.
  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return apps;
    return apps.filter((a) => `${a.name} ${a.tagline} ${a.category}`.toLowerCase().includes(t));
  }, [q]);


  const pick = (i: number) => {
    const app = results[i];
    // baca rect sebelum modal mulai memudar (klik maupun Enter memakai baris yang sama)
    if (app) onLaunch(app.id, snapshotOf(document.getElementById(`sr-${app.id}`)));
  };

  return (
    <motion.div
      className="spotlight-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: EXIT }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="spotlight glass"
        role="dialog"
        aria-modal="true"
        aria-label="Cari aplikasi"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0, transition: EXIT } : { opacity: 0, y: -8, scale: 0.98, transition: EXIT }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <div className="spotlight-field">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0); // hasil berubah → sorotan kembali ke baris pertama
            }}
            placeholder="Cari nama atau fungsi aplikasi"
            aria-label="Cari aplikasi"
            aria-controls="spotlight-results"
            aria-activedescendant={results[sel] ? `sr-${results[sel].id}` : undefined}
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.max(0, Math.min(s + 1, results.length - 1))); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
            }}
          />
        </div>
        <ul id="spotlight-results" role="listbox" className="spotlight-list">
          {results.map((app, i) => (
            <li
              key={app.id}
              id={`sr-${app.id}`}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? 'is-selected' : ''}
              onMouseEnter={() => setSel(i)}
              onClick={() => pick(i)}
            >
              <AppTile id={app.id} size={36} />
              <span>
                <strong>{app.name}</strong>
                <small>{app.tagline}</small>
              </span>
            </li>
          ))}
          {results.length === 0 && <li className="empty">Tidak ada aplikasi yang cocok dengan “{q}”.</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}
