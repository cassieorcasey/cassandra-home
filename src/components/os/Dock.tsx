import { Icon } from '../ui/Icon';
import { apps } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';
import { AppIcon } from '../ui/AppIcon';

interface Props {
  running: Set<string>;
  hidden: boolean;
  onHome: () => void;
  onLaunch: (id: string, origin: Rect) => void;
}

export function Dock({ running, hidden, onHome, onLaunch }: Props) {
  return (
    <nav className={`dock glass ${hidden ? 'is-hidden' : ''}`} aria-label="Dock" inert={hidden}>
      <button type="button" className="dock-home" onClick={onHome} aria-label="Home" title="Home">
        <Icon name="grid" size={24} />
      </button>
      <span className="dock-sep" aria-hidden />
      {apps.map((app) => (
        <AppIcon
          key={app.id}
          app={app}
          size={44}
          launchKey={`dock-${app.id}`}
          running={running.has(app.id)}
          showLabel={false}
          onLaunch={(r) => onLaunch(app.id, r)}
        />
      ))}
    </nav>
  );
}
