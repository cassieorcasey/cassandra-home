/**
 * Kurva Tile-to-Window Morph.
 * - open: pegas buka, cepat tanpa overshoot berlebih (ζ ≈ 0.89).
 * - close: pegas tutup lebih sigap (ζ ≈ 0.96, ~240 ms).
 * Durasi `*Ms` adalah perkiraan waktu tempuh visual masing-masing pegas, dipakai untuk
 * menjadwalkan fade konten (buka: 40–100 %, tutup: 35 % pertama).
 */
export const WINDOW_MORPH = {
  open: { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 },
  close: { type: 'spring', stiffness: 440, damping: 36, mass: 0.8 },
  openMs: 380,
  closeMs: 240,
  /** pengganti morph saat prefers-reduced-motion */
  reducedFadeMs: 120,
} as const;
