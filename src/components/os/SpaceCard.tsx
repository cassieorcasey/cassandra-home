import type { AppId, CassandraApp } from '../../types/os';
import { AppTile } from '../ui/AppTile';

/**
 * Kartu SPACES sederhana: kotak persegi bersudut bulat berisi ikon aplikasi,
 * nama di bawahnya. Tagline tetap tersedia untuk pembaca layar dan tooltip.
 * `.app-card-face` adalah jangkar morph: titik asal saat dibuka dan titik pulang saat
 * jendela ditutup atau di-collapse (radiusnya dibaca langsung dari elemen ini).
 */
interface Props {
  app: CassandraApp;
  index: number;
  running: boolean;
  onLaunch: (id: AppId) => void;
  registerTile: (id: AppId, el: HTMLElement | null) => void;
}

export function SpaceCard({ app, index, running, onLaunch, registerTile }: Props) {
  const id = app.id;

  return (
    <button
      type="button"
      className="app-card enter"
      data-app={id}
      style={{ '--d': `${460 + index * 60}ms` } as React.CSSProperties}
      aria-label={running ? `Open ${app.name} (running): ${app.tagline}` : `Open ${app.name}: ${app.tagline}`}
      title={app.tagline}
      onClick={() => onLaunch(id)}
    >
      <span className="app-card-face" ref={(el) => registerTile(id, el)}>
        <span className="app-card-icon">
          <AppTile id={id} size={68} />
        </span>
        {running && <span className="app-card-dot" aria-hidden />}
      </span>
      <span className="app-card-title">{app.name}</span>
    </button>
  );
}
