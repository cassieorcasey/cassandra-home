import { useEffect, useState } from 'react';
import type { Rect } from './useWindowManager';
import { BAR_H } from '../lib/taskbar';

export { BAR_H };

export const MOBILE_MAX = 767;
/** Tidak ada bilah atas; jarak atas = safe area (poni iPhone) bila ada. */
export const TOPBAR_H = 0;
/** Jarak jendela desktop dari tepi viewport (bawah = margin + Multitask Bar + safe area). */
const STAGE_MARGIN = 12;
/** Tinggi satu baris Multitask Bar dan ruang yang disisakan stage di bawahnya (bar + jarak). */
export const BAR_RESERVED = BAR_H + 24;

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
  // ponsel: penuh dari poni sampai di atas indikator Home (env(safe-area-inset-*))
  if (vp.mobile) return { x: 0, y: vp.sat, w: vp.w, h: vp.h - vp.sat - vp.sab - BAR_RESERVED };
  if (expanded) return { x: 8, y: TOPBAR_H + 8, w: vp.w - 16, h: vp.h - TOPBAR_H - 16 - vp.sab - BAR_RESERVED };
  const top = TOPBAR_H + STAGE_MARGIN;
  return { x: 24, y: top, w: vp.w - 48, h: vp.h - top - STAGE_MARGIN - vp.sab - BAR_RESERVED };
}

/** Ukuran minimum jendela desktop: header dan tombol kontrol tidak bertabrakan. */
export const MIN_WIN_W = 360;
export const MIN_WIN_H = 260;
const WIN_MARGIN = 8;

/** Sisi yang ditarik saat resize (arah mata angin). */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Pembatas geometri jendela desktop. Jendela tetap utuh di dalam viewport (tidak keluar
 * dari atas, samping, maupun bawah (margin viewport + bar + safe area bawah), sehingga
 * .window-header selalu terjangkau.
 * - Tanpa `edge` (drag, viewport berubah ukuran): ukuran dijepit dulu, lalu posisi.
 * - Dengan `edge` (resize): hanya sisi yang ditarik yang bergerak; sisi seberang tetap diam.
 * Bawahnya berhenti di atas Multitask Bar.
 */
export function clampWindowRect(r: Rect, vp: Viewport, edge?: ResizeEdge): Rect {
  const L = WIN_MARGIN;
  const T = TOPBAR_H + WIN_MARGIN;
  const R = vp.w - WIN_MARGIN;
  const B = vp.h - WIN_MARGIN - vp.sab - BAR_RESERVED;
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
