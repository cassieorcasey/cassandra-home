import { motionValue, type MotionValue } from 'motion/react';
import { useState } from 'react';
import type { RectSnapshot } from '../types/os';

/**
 * Nilai live morph Tile-to-Window, dibagi antara proxy (FlightLayer) dan StageWindow.
 *
 * Satu progres `t` (0 → 1) menggerakkan seluruh morph; rect yang terlihat = interpolasi `from` → `to`.
 * Proxy dan jendela sama-sama berdiri diam di kotak jendela (`box`) dengan ukuran tetap; yang bergerak
 * hanya `clip-path` (cat ulang, tanpa layout) yang dihitung sekali per frame dari `t`. Iframe tidak
 * di-relayout, dan bayangan besar tidak dirasterisasi ulang tiap frame.
 */
export interface Morph {
  /** progres morph 0 → 1 */
  t: MotionValue<number>;
  /** ujung awal & akhir morph yang sedang berjalan */
  from: RectSnapshot;
  to: RectSnapshot;
  /** kotak jendela (ujung besar morph): jendela berdiri diam di sini */
  box: RectSnapshot | null;
  /** clip-path jendela relatif terhadap `box`: rect yang terlihat pada `t` */
  clip: MotionValue<string>;
  /** kotak proxy: gabungan kedua ujung morph (kartu/tab bisa berada di luar kotak jendela) */
  shell: RectSnapshot | null;
  /** clip-path proxy relatif terhadap `shell` */
  shellClip: MotionValue<string>;
  /** posisi pusat rect yang terlihat, relatif terhadap `shell` (untuk ikon proxy) */
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  /** opasitas konten internal jendela (header + iframe) */
  content: MotionValue<number>;
  /** skala konten internal: 0.98 → 1 mengikuti `content` */
  scale: MotionValue<number>;
  /** opasitas ikon di proxy: kebalikan `content` */
  icon: MotionValue<number>;
  /** opasitas proxy (fallback tanpa kartu tujuan memudar di tengah layar) */
  proxy: MotionValue<number>;
  /** rect yang terlihat sekarang (dipakai untuk melanjutkan morph yang diinterupsi) */
  current: () => RectSnapshot;
  /** pasang ujung, kotak jendela & kotak proxy baru lalu hitung ulang clip untuk `t` sekarang */
  setup: (from: RectSnapshot, to: RectSnapshot, box: RectSnapshot, shell: RectSnapshot) => void;
}

const ZERO: RectSnapshot = { left: 0, top: 0, width: 0, height: 0, borderRadius: 0 };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** clip-path yang memperlihatkan `r` saja di dalam kotak `b` */
const insetOf = (r: RectSnapshot, b: RectSnapshot) => {
  const l = r.left - b.left;
  const t = r.top - b.top;
  return `inset(${t}px ${b.width - l - r.width}px ${b.height - t - r.height}px ${l}px round ${r.borderRadius}px)`;
};
/** Kotak yang memuat kedua rect (kotak proxy: kartu/tab bisa berada di luar kotak jendela). */
export const union = (a: RectSnapshot, b: RectSnapshot): RectSnapshot => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
    borderRadius: 0,
  };
};

function createMorph(): Morph {
  const m: Morph = {
    t: motionValue(0),
    from: ZERO,
    to: ZERO,
    box: null,
    clip: motionValue('none'),
    shell: null,
    shellClip: motionValue('none'),
    cx: motionValue(0),
    cy: motionValue(0),
    content: motionValue(1),
    scale: motionValue(1),
    icon: motionValue(0),
    proxy: motionValue(1),
    current: () => {
      const k = m.t.get();
      return {
        left: mix(m.from.left, m.to.left, k),
        top: mix(m.from.top, m.to.top, k),
        width: mix(m.from.width, m.to.width, k),
        height: mix(m.from.height, m.to.height, k),
        borderRadius: mix(m.from.borderRadius, m.to.borderRadius, k),
      };
    },
    setup: (from, to, box, shell) => {
      m.from = from;
      m.to = to;
      m.box = box;
      m.shell = shell;
      reclip();
    },
  };
  // satu hitungan per frame: rect live → clip jendela, clip proxy, pusat ikon
  const reclip = () => {
    const b = m.box;
    const s = m.shell;
    if (!b || !s) return;
    const r = m.current();
    m.clip.set(insetOf(r, b));
    m.shellClip.set(insetOf(r, s));
    m.cx.set(r.left - s.left + r.width / 2);
    m.cy.set(r.top - s.top + r.height / 2);
  };
  m.t.on('change', reclip);
  m.content.on('change', (v) => {
    m.scale.set(0.98 + 0.02 * v);
    m.icon.set(1 - v);
  });
  return m;
}

/** Satu set nilai morph untuk seluruh aplikasi (hanya satu morph berjalan sekaligus). */
export function useMorph(): Morph {
  const [m] = useState(createMorph);
  return m;
}
