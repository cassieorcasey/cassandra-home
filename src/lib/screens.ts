import type { AppId, Rect } from '../types/os';

/** Bagi `r` jadi dua di sepanjang sisi terpanjangnya (lebar ≥ tinggi → kiri-kanan). */
function split(r: Rect, gap: number): [Rect, Rect] {
  if (r.w >= r.h) {
    const w = (r.w - gap) / 2;
    return [
      { x: r.x, y: r.y, w, h: r.h },
      { x: r.x + w + gap, y: r.y, w, h: r.h },
    ];
  }
  const h = (r.h - gap) / 2;
  return [
    { x: r.x, y: r.y, w: r.w, h },
    { x: r.x, y: r.y + h + gap, w: r.w, h },
  ];
}

/** Bagi `r` tegak lurus terhadap pembagian pertama (untuk sisi kedua grid 3 / 4). */
function splitAcross(r: Rect, gap: number, firstWasVertical: boolean): [Rect, Rect] {
  if (firstWasVertical) {
    const h = (r.h - gap) / 2;
    return [
      { x: r.x, y: r.y, w: r.w, h },
      { x: r.x, y: r.y + h + gap, w: r.w, h },
    ];
  }
  const w = (r.w - gap) / 2;
  return [
    { x: r.x, y: r.y, w, h: r.h },
    { x: r.x + w + gap, y: r.y, w, h: r.h },
  ];
}

/**
 * Sel grid untuk `count` jendela (1–4) di dalam `stage`.
 * 1 = penuh; 2 = dibagi di sisi terpanjang; 3 = sel pertama utuh, sisi kedua dibagi lagi;
 * 4 = kedua sisi dibagi (2×2). Urutan sel: baris demi baris (kiri-atas dulu).
 */
export function gridCells(stage: Rect, count: number, gap: number): Rect[] {
  if (count <= 1) return [stage];
  const [a, b] = split(stage, gap);
  if (count === 2) return [a, b];
  const vertical = stage.w >= stage.h; // pembagian pertama kiri-kanan
  const [b1, b2] = splitAcross(b, gap, vertical);
  if (count === 3) return [a, b1, b2];
  const [a1, a2] = splitAcross(a, gap, vertical);
  // 2×2 dibaca baris demi baris: kiri-atas, kanan-atas, kiri-bawah, kanan-bawah
  return vertical ? [a1, b1, a2, b2] : [a1, a2, b1, b2];
}

/** Sel setiap app yang tampil (tidak diperkecil) di layar `screen` berkapasitas `k`. */
export function screenLayout(tabs: AppId[], minimized: Set<AppId>, screen: number, k: number, stage: Rect, gap: number) {
  const visible = tabs.slice(screen * k, screen * k + k).filter((id) => !minimized.has(id));
  const cells = gridCells(stage, visible.length, gap);
  return new Map(visible.map((id, i) => [id, cells[i]] as const));
}

/** Ukuran viewport dan tata letak "mengintip" saat ada lebih dari satu layar. */
export interface PeekSpec {
  /** lebar viewport */
  w: number;
  /** lebar tepi layar tetangga yang terlihat */
  peek: number;
  /** jarak antara layar */
  gap: number;
  /** margin kiri layar pertama */
  margin: number;
}

/**
 * Bingkai layar `s` (dari `count` layar) dalam koordinat viewport saat layar `current` tampil.
 * Satu layar: stage apa adanya. Lebih dari satu: layar dirantai ke kanan dan menyempit, sehingga
 * tepi layar tetangga terlihat selebar `peek` di kiri/kanan; pindah layar menggeser rantai
 * sejauh `w - 2·peek - gap`.
 */
export function screenFrame(stage: Rect, p: PeekSpec, s: number, count: number, current: number): Rect {
  if (count <= 1) return stage;
  const shift = p.w - 2 * p.peek - p.gap;
  const base = s === 0 ? p.margin : p.w - p.peek + (s - 1) * shift;
  const w = s === 0 ? p.w - p.peek - p.gap - p.margin : p.w - 2 * p.peek - 2 * p.gap;
  return { x: base - current * shift, y: stage.y, w, h: stage.h };
}

/** Jarak geser rantai layar per layar (dipakai juga sebagai lebar ambang seret). */
export const screenShift = (p: PeekSpec) => p.w - 2 * p.peek - p.gap;
