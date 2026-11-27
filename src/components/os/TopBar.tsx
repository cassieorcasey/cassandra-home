import { Icon, type IconName } from '../ui/Icon';
import type { ThemePref } from '../../hooks/useTheme';

interface Props {
  openCount: number;
  theme: ThemePref;
  onCycleTheme: () => void;
  onSpotlight: () => void;
  onHome: () => void;
}

const themeLabel: Record<ThemePref, [IconName, string]> = {
  system: ['auto', 'Tema: Sistem'],
  light: ['sun', 'Tema: Terang'],
  dark: ['moon', 'Tema: Gelap'],
};

export function TopBar({ openCount, theme, onCycleTheme, onSpotlight, onHome }: Props) {
  const [icon, label] = themeLabel[theme];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="topbar glass">
      <button type="button" className="brand" onClick={onHome} aria-label="Cassandra Home, kembali ke Home">
        <span className="brand-mark" aria-hidden />
        Cassandra Home
      </button>
      <div className="topbar-actions">
        {openCount > 0 && (
          <span className="tab-badge" role="status" aria-label={`${openCount} aplikasi terbuka`}>
            {openCount}
          </span>
        )}
        <button type="button" className="hdr-btn" onClick={onCycleTheme} aria-label={label} title={label}>
          <Icon name={icon} />
        </button>
        <button type="button" className="search-btn" onClick={onSpotlight} aria-label="Cari aplikasi">
          <Icon name="search" />
          <kbd className="desktop-only">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
      </div>
    </header>
  );
}
