import { Icon } from '../ui/Icon';
import { useRef } from 'react';
import { appById } from '../../config/apps.config';
import type { WindowManager } from '../../hooks/useWindowManager';

/**
 * Mobile tab bar (< 768px): Home + satu tombol per aplikasi terbuka.
 * Usap horizontal di bar ini = jalan pintas pindah ke aplikasi sebelah.
 * Di desktop, Tab-Deck adalah jendela-jendela itu sendiri yang diperkecil ke Side Stage Strip (lihat App.tsx).
 */
export function MobileTabBar({ wm }: { wm: WindowManager }) {
  const { apps, activeId } = wm.state;
  const startX = useRef<number | null>(null);

  const step = (dir: 1 | -1) => {
    if (!apps.length) return;
    const i = apps.findIndex((a) => a.id === activeId);
    const next = i === -1 ? (dir === 1 ? 0 : apps.length - 1) : i + dir;
    if (next >= 0 && next < apps.length) wm.focus(apps[next].id);
  };

  return (
    <nav
      className="tabbar glass"
      aria-label="Aplikasi terbuka"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        className={`tab ${activeId === null ? 'is-current' : ''}`}
        aria-label="Home"
        aria-current={activeId === null ? 'page' : undefined}
        onClick={wm.minimize}
      >
        <Icon name="grid" size={24} />
      </button>
      {apps.map((w) => {
        const app = appById(w.id);
        const current = w.id === activeId;
        return (
          <button
            key={w.id}
            type="button"
            className={`tab ${current ? 'is-current' : ''}`}
            aria-label={app.name}
            aria-current={current ? 'page' : undefined}
            onClick={() => wm.focus(w.id)}
          >
            <img src={app.icon} alt="" width={30} height={30} />
          </button>
        );
      })}
    </nav>
  );
}
