import { motion } from 'motion/react';
import type { CassandraApp } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';

interface Props {
  app: CassandraApp;
  size: number;
  launchKey: string;
  running?: boolean;
  showLabel?: boolean;
  onLaunch: (origin: Rect) => void;
}

export function toRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function AppIcon({ app, size, launchKey, running, showLabel = true, onLaunch }: Props) {
  return (
    <motion.button
      type="button"
      className="app-icon"
      aria-label={`Buka ${app.name}`}
      title={app.name}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={(e) => {
        const img = e.currentTarget.querySelector('[data-squircle]');
        onLaunch(toRect(img ?? e.currentTarget));
      }}
    >
      <span className="squircle" data-squircle data-launch={launchKey} style={{ width: size, height: size }}>
        <img src={app.icon} alt="" width={size} height={size} draggable={false} />
      </span>
      {showLabel && <span className="app-icon__label">{app.name}</span>}
      {running && <span className="run-dot" aria-hidden />}
    </motion.button>
  );
}
