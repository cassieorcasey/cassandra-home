import { useEffect, useState } from 'react';
import type { Rect } from './useWindowManager';

export const MOBILE_MAX = 767;
/** Tidak ada bilah atas; jarak atas = safe area (poni iPhone) bila ada. */
export const TOPBAR_H = 0;
// bilah bawah mobile mode Active: 44 ikon + 2×8 padding + 2 border, plus 8 jarak
const MOBILE_BAR_SPACE = 70;
const DOCK_SPACE = 92;
const STRIP_W = 184;
const STRIP_X = 24;

function probe(id: string) {
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().height : 0;
}

function read() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { w, h, mobile: w <= MOBILE_MAX, sab: probe('safe-probe'), sat: probe('safe-probe-top') };
}

export type Viewport = ReturnType<typeof read>;

export function useViewport() {
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    on();
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

/** Area Center Stage untuk ukuran layar saat ini. */
export function stageRect(vp: Viewport, expanded: boolean): Rect {
  if (vp.mobile) {
    return { x: 0, y: vp.sat, w: vp.w, h: vp.h - vp.sat - MOBILE_BAR_SPACE - Math.max(12, vp.sab) };
  }
  if (expanded) return { x: 8, y: TOPBAR_H + 8, w: vp.w - 16, h: vp.h - TOPBAR_H - 16 };
  const left = STRIP_X + STRIP_W + 28;
  return { x: left, y: TOPBAR_H + 12, w: vp.w - left - 24, h: vp.h - TOPBAR_H - 12 - DOCK_SPACE };
}

/** Posisi kartu ke-i di Side Stage Strip (desktop). */
export function deckSlot(vp: Viewport, i: number) {
  const stage = stageRect(vp, false);
  const scale = STRIP_W / stage.w;
  const cardH = stage.h * scale;
  return { x: STRIP_X, y: TOPBAR_H + 20 + Math.min(i, 3) * (cardH + 16), scale };
}

export const STRIP_RESERVED = STRIP_X + STRIP_W + 28;

/** Ukuran minimum jendela desktop: header dan tombol kontrol tidak bertabrakan. */
export const MIN_WIN_W = 360;
export const MIN_WIN_H = 260;
const WIN_MARGIN = 8;

/** Sisi yang ditarik saat resize (arah mata angin). */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Pembatas geometri jendela desktop. Jendela tetap utuh di dalam viewport (tidak keluar
 * dari atas atau samping) dan tepi bawahnya berhenti di atas UnifiedBottomBar, sehingga
 * .window-header selalu terjangkau.
 * - Tanpa `edge` (drag, viewport berubah ukuran): ukuran dijepit dulu, lalu posisi.
 * - Dengan `edge` (resize): hanya sisi yang ditarik yang bergerak; sisi seberang tetap diam.
 */
export function clampWindowRect(r: Rect, vp: Viewport, edge?: ResizeEdge): Rect {
  const L = WIN_MARGIN;
  const T = TOPBAR_H + WIN_MARGIN;
  const R = vp.w - WIN_MARGIN;
  const B = vp.h - DOCK_SPACE;
  const minW = Math.min(MIN_WIN_W, R - L);
  const minH = Math.min(MIN_WIN_H, B - T);

  if (!edge) {
    const w = clampNum(r.w, minW, R - L);
    const h = clampNum(r.h, minH, B - T);
    return {
      x: Math.round(clampNum(r.x, L, R - w)),
      y: Math.round(clampNum(r.y, T, B - h)),
      w: Math.round(w),
      h: Math.round(h),
    };
  }

  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (edge.includes('w')) left = clampNum(left, L, right - minW);
  if (edge.includes('e')) right = clampNum(right, left + minW, R);
  if (edge.includes('n')) top = clampNum(top, T, bottom - minH);
  if (edge.includes('s')) bottom = clampNum(bottom, top + minH, B);
  left = Math.round(left);
  top = Math.round(top);
  return { x: left, y: top, w: Math.round(right) - left, h: Math.round(bottom) - top };
}
