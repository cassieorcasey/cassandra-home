import { motionValue, type MotionValue } from 'motion/react';
import { useState } from 'react';
import type { RectSnapshot } from '../types/os';

/**
 * Nilai live morph Tile-to-Window, dibagi antara proxy (FlightLayer) dan StageWindow.
 * Proxy menggambar permukaan + ikon; StageWindow tetap di ukuran akhirnya (iframe tidak
 * di-relayout tiap frame) dan dipotong `clip` agar kontennya hanya tampak di dalam proxy.
 */
export interface Morph {
  left: MotionValue<number>;
  top: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  radius: MotionValue<number>;
  /** opasitas konten internal jendela (header + iframe) */
  content: MotionValue<number>;
  /** skala konten internal: 0.98 → 1 mengikuti `content` */
  scale: MotionValue<number>;
  /** opasitas ikon di proxy: kebalikan `content` */
  icon: MotionValue<number>;
  /** opasitas proxy (fallback tanpa kartu tujuan memudar di tengah layar) */
  proxy: MotionValue<number>;
  /** clip-path jendela relatif terhadap kotaknya sendiri (`box`) */
  clip: MotionValue<string>;
  /** kotak jendela (ujung besar morph) */
  box: MotionValue<RectSnapshot | null>;
}

function createMorph(): Morph {
  const m: Morph = {
    left: motionValue(0),
    top: motionValue(0),
    width: motionValue(0),
    height: motionValue(0),
    radius: motionValue(0),
    content: motionValue(1),
    scale: motionValue(1),
    icon: motionValue(0),
    proxy: motionValue(1),
    clip: motionValue('none'),
    box: motionValue<RectSnapshot | null>(null),
  };
  const reclip = () => {
    const b = m.box.get();
    if (!b) return;
    const l = m.left.get() - b.left;
    const t = m.top.get() - b.top;
    const r = b.left + b.width - (m.left.get() + m.width.get());
    const btm = b.top + b.height - (m.top.get() + m.height.get());
    m.clip.set(`inset(${t}px ${r}px ${btm}px ${l}px round ${m.radius.get()}px)`);
  };
  for (const v of [m.left, m.top, m.width, m.height, m.radius]) v.on('change', reclip);
  m.box.on('change', reclip);
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
