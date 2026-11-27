export const BOTTOM_BAR_SPRINGS = {
  // Home <-> Active App dan penerbangan ikon <-> jendela (ζ ≈ 0.88)
  layoutMorph: { type: 'spring', stiffness: 340, damping: 30, mass: 0.85 },
  // Pembesaran ikon dok
  dockMagnify: { type: 'spring', stiffness: 420, damping: 28, mass: 0.55 },
  // Tarikan magnetik & gelombang bobot huruf "Cassandra"
  magneticSignature: { type: 'spring', stiffness: 260, damping: 22, mass: 0.7 },
  // Respons tekan
  tactileTap: { type: 'spring', stiffness: 520, damping: 32 },
  // Pantulan ikon saat jendela mendarat (ζ ≈ 0.37)
  landBounce: { type: 'spring', stiffness: 600, damping: 14, mass: 0.6 },
  // Percepatan kilau
  shimmerSpeed: { stiffness: 120, damping: 20 },
} as const;

export const REDUCED = {
  fade: { duration: 0.16, ease: [0.2, 0, 0, 1] },
  crossfade: { duration: 0.18, ease: 'linear' },
} as const;

export const DOCK_GEOMETRY = {
  desktop: { icon: 48, gap: 14, smax: 1.32, sigma: 62, lift: 24, activateAbove: 24 },
  touch: { icon: 44, gap: 8, smax: 1.2, sigma: 52, lift: 20 },
  signature: { sigma: 28, wMin: 500, wMax: 800, wStep: 25, liftMax: 3, activateY: 48, px: 21.6 },
  magnet: { radius: 120, kx: 0.12, ky: 0.1, maxX: 6, maxY: 4 },
  /** Di bawah lebar ini pil Cassandra menjadi monogram "C". */
  pillWordMinWidth: 420,
} as const;
