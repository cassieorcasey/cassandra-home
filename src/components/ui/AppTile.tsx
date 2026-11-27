import type { AppId } from '../../types/os';

/**
 * Frosted Mineral Tile: squircle kaca buram + lapisan swatch per aplikasi + ikon asli.
 * Ikon asli dipakai apa adanya (bentuk dan warna); hanya latar bawaannya yang dibuang
 * (public/icons/<id>-mark.webp) supaya menyatu dengan kaca.
 * Ukuran dasar 64 px (radius 18); ukuran lain diskalakan proporsional lewat --tile.
 */
export function AppTile({ id, size = 64, className }: { id: AppId; size?: number; className?: string }) {
  return (
    <span
      className={className ? `app-tile ${className}` : 'app-tile'}
      data-app={id}
      style={{ '--tile': `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <img src={`${import.meta.env.BASE_URL}icons/${id}-mark.webp`} alt="" draggable={false} />
    </span>
  );
}
