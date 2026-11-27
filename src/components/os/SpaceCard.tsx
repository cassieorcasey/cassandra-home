import type { CassandraApp, Rect } from '../../types/os';
import { AppTile } from '../ui/AppTile';

/**
 * Kartu SPACES sederhana: kotak persegi bersudut bulat berisi ikon aplikasi,
 * nama di bawahnya. Tagline tetap tersedia untuk pembaca layar dan tooltip.
 */
interface Props {
  app: CassandraApp;
  index: number;
  running: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

export function SpaceCard({ app, index, running, onLaunch }: Props) {
  const id = app.id;

  return (
    <button
      type="button"
      className="app-card enter"
      data-app={id}
      style={{ '--d': `${460 + index * 60}ms` } as React.CSSProperties}
      aria-label={`Open ${app.name}: ${app.tagline}`}
      title={app.tagline}
      onClick={(e) => {
        const r = e.currentTarget.querySelector('.app-card-icon')!.getBoundingClientRect();
        onLaunch(id, { x: r.left, y: r.top, w: r.width, h: r.height });
      }}
    >
      <span className="app-card-face">
        <span className="app-card-icon" data-launch={`grid-${id}`}>
          <AppTile id={id} size={68} />
        </span>
        {running && <span className="app-card-dot" aria-hidden />}
      </span>
      <span className="app-card-title">{app.name}</span>
    </button>
  );
}
