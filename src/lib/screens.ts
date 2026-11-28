import type { AppId, Rect } from '../types/os';

/** Rasio garis pembatas satu layar: r1 = garis utama, r2 = garis kedua (sisi kedua / baris bersama). */
export interface SplitRatios {
  r1: number;
  r2: number;
}
export const EVEN: SplitRatios = { r1: 0.5, r2: 0.5 };

/** Bagi `r` jadi dua (bagian pertama = `ratio` dari ruang tanpa celah), kiri-kanan bila `across` false. */
function cut(r: Rect, gap: number, ratio: number, horizontal: boolean): [Rect, Rect] {
  if (horizontal) {
    const w = (r.w - gap) * ratio;
    return [
      { x: r.x, y: r.y, w, h: r.h },
      { x: r.x + w + gap, y: r.y, w: r.w - gap - w, h: r.h },
    ];
  }
  const h = (r.h - gap) * ratio;
  return [
    { x: r.x, y: r.y, w: r.w, h },
    { x: r.x, y: r.y + h + gap, w: r.w, h: r.h - gap - h },
  ];
}

/**
 * Sel grid untuk `count` jendela (1–4) di dalam `stage`.
 * 1 = penuh; 2 = dibagi di sisi terpanjang (r1); 3 = sel pertama utuh, sisi kedua dibagi lagi (r2);
 * 4 = kedua sisi dibagi dengan garis bersama (r2). Urutan sel: baris demi baris (kiri-atas dulu).
 */
export function gridCells(stage: Rect, count: number, gap: number, ratios: SplitRatios = EVEN): Rect[] {
  if (count <= 1) return [stage];
  const wide = stage.w >= stage.h; // pembagian pertama kiri-kanan
  const [a, b] = cut(stage, gap, ratios.r1, wide);
  if (count === 2) return [a, b];
  const [b1, b2] = cut(b, gap, ratios.r2, !wide);
  if (count === 3) return [a, b1, b2];
  const [a1, a2] = cut(a, gap, ratios.r2, !wide);
  return wide ? [a1, b1, a2, b2] : [a1, a2, b1, b2];
}

/** Garis pembatas yang bisa diseret: `axis` = arah seret, `span` = ruang yang dibagi, `origin` = awalnya. */
export interface SplitLine {
  key: keyof SplitRatios;
  axis: 'x' | 'y';
  rect: Rect;
  span: number;
  origin: number;
}

export function splitLines(stage: Rect, count: number, gap: number, ratios: SplitRatios = EVEN): SplitLine[] {
  if (count <= 1) return [];
  const wide = stage.w >= stage.h;
  const lines: SplitLine[] = [];
  const main = wide
    ? { axis: 'x' as const, span: stage.w - gap, origin: stage.x }
    : { axis: 'y' as const, span: stage.h - gap, origin: stage.y };
  const at = main.origin + main.span * ratios.r1;
  lines.push({
    key: 'r1',
    ...main,
    rect: wide ? { x: at, y: stage.y, w: gap, h: stage.h } : { x: stage.x, y: at, w: stage.w, h: gap },
  });
  if (count === 2) return lines;
  // garis kedua: di sisi kedua saja (3 app) atau melintang seluruh stage (4 app)
  const [, b] = cut(stage, gap, ratios.r1, wide);
  const box = count === 3 ? b : stage;
  const second = wide
    ? { axis: 'y' as const, span: box.h - gap, origin: box.y }
    : { axis: 'x' as const, span: box.w - gap, origin: box.x };
  const at2 = second.origin + second.span * ratios.r2;
  lines.push({
    key: 'r2',
    ...second,
    rect: wide ? { x: box.x, y: at2, w: box.w, h: gap } : { x: at2, y: box.y, w: gap, h: box.h },
  });
  return lines;
}

/** Jepit rasio supaya kedua sisi minimal `min` px; ruang yang terlalu kecil tetap dibagi rata. */
export function clampRatio(r: number, span: number, min: number) {
  if (span < 2 * min) return 0.5;
  return Math.min(Math.max(r, min / span), 1 - min / span);
}

/** Sel setiap app yang tampil (tidak diperkecil) di layar `screen` berkapasitas `k`. */
export function screenLayout(tabs: AppId[], minimized: Set<AppId>, screen: number, k: number, stage: Rect, gap: number, ratios: SplitRatios = EVEN) {
  const visible = tabs.slice(screen * k, screen * k + k).filter((id) => !minimized.has(id));
  const cells = gridCells(stage, visible.length, gap, ratios);
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

export type ResizeEdge = 'e' | 'w' | 's' | 'se' | 'sw';
/** Ukuran minimum jendela tunggal yang diubah ukurannya lewat pegangan. */
export const MIN_WIN = { w: 360, h: 260 };

/** Rect jendela setelah tepi/sudut `edge` diseret sejauh (dx, dy), dijepit ke `bounds` dan ukuran minimum. */
export function resizeRect(r: Rect, edge: ResizeEdge, dx: number, dy: number, bounds: Rect): Rect {
  let { x, w, h } = r;
  const { y } = r;
  const right = r.x + r.w;
  if (edge.includes('e')) w = Math.min(Math.max(r.w + dx, MIN_WIN.w), bounds.x + bounds.w - r.x);
  if (edge.includes('w')) {
    x = Math.min(Math.max(r.x + dx, bounds.x), right - MIN_WIN.w);
    w = right - x;
  }
  if (edge.includes('s')) h = Math.min(Math.max(r.h + dy, MIN_WIN.h), bounds.y + bounds.h - r.y);
  return { x, y, w, h };
}
