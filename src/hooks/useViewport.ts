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
