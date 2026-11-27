export const BOTTOM_BAR_SPRINGS = {
  // Penerbangan ikon <-> jendela (ζ ≈ 0.88)
  layoutMorph: { type: 'spring', stiffness: 340, damping: 30, mass: 0.85 },
  // Pembesaran ikon dok
  dockMagnify: { type: 'spring', stiffness: 420, damping: 28, mass: 0.55 },
  // Respons tekan
  tactileTap: { type: 'spring', stiffness: 520, damping: 32 },
  // Pantulan ikon saat jendela mendarat (ζ ≈ 0.37)
  landBounce: { type: 'spring', stiffness: 600, damping: 14, mass: 0.6 },
} as const;

export const DOCK_GEOMETRY = {
  desktop: { icon: 48, gap: 14, smax: 1.32, sigma: 62, lift: 24, activateAbove: 24 },
  touch: { icon: 44, gap: 8, smax: 1.2, sigma: 52, lift: 20 },
} as const;
