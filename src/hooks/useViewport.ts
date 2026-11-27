import { useEffect, useState } from 'react';
import type { Rect } from './useWindowManager';

export const MOBILE_MAX = 767;
export const TOPBAR_H = 52;
// bilah bawah mobile mode Active: 44 ikon + 2×8 padding + 2 border, plus 8 jarak
const MOBILE_BAR_SPACE = 70;
const DOCK_SPACE = 92;
const STRIP_W = 184;
const STRIP_X = 24;

function safeBottom() {
  const probe = document.getElementById('safe-probe');
  return probe ? probe.getBoundingClientRect().height : 0;
}

function read() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { w, h, mobile: w <= MOBILE_MAX, sab: safeBottom() };
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
    return { x: 0, y: TOPBAR_H, w: vp.w, h: vp.h - TOPBAR_H - MOBILE_BAR_SPACE - Math.max(12, vp.sab) };
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
