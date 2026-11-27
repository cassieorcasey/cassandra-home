import type { AppId } from '../../types/os';

/**
 * Glyph garis satu tinta, kanvas 28×28, stroke 1.75, ujung dan sambungan membulat.
 * Semua memakai currentColor sehingga ketajaman kelimanya setara di atas swatch mana pun.
 */
const GLYPHS: Record<AppId, React.ReactNode> = {
  // buku catatan terbuka
  lemma: (
    <>
      <path d="M14 8.5C11 6.6 7.4 6.3 4 7.2v13.6c3.4-.9 7-.6 10 1.3 3-1.9 6.6-2.2 10-1.3V7.2c-3.4-.9-7-.6-10 1.3Z" />
      <path d="M14 8.5v13.6" />
    </>
  ),
  // tiga simpul yang terhubung
  synthesis: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="20" cy="9" r="3" />
      <circle cx="14" cy="20" r="3" />
      <path d="M11 9h6M9.44 11.63l3.12 5.74M18.56 11.63l-3.12 5.74" />
    </>
  ),
  // jalur bertitik menuju bendera
  conway: (
    <>
      <path d="M4.5 23c5 0 4.5-6.5 9.5-6.5 3.2 0 4-2.4 5.5-4" strokeDasharray="2.2 2.6" />
      <path d="M20.5 23V5" />
      <path d="M20.5 5.5H25l-1.6 2.6L25 10.7h-4.5" />
    </>
  ),
  // amplop
  subset: (
    <>
      <rect x="4" y="7" width="20" height="14" rx="2.5" />
      <path d="m4.6 8.6 9.4 6.6 9.4-6.6" />
    </>
  ),
  // bintang
  wishy: (
    <path d="M14 4.5l2.7 6.78 7.29.48-5.62 4.66 1.8 7.07L14 19.6l-6.17 3.89 1.8-7.07-5.62-4.66 7.29-.48Z" />
  ),
};

/**
 * Frosted Mineral Tile: squircle kaca buram + lapisan swatch per aplikasi + glyph tinta tunggal.
 * Ukuran dasar 64 px (radius 18, glyph 28); ukuran lain diskalakan proporsional lewat --tile.
 */
export function AppTile({ id, size = 64, className }: { id: AppId; size?: number; className?: string }) {
  return (
    <span
      className={className ? `app-tile ${className}` : 'app-tile'}
      data-app={id}
      style={{ '--tile': `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <svg
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[id]}
      </svg>
    </span>
  );
}
