import { motionValue } from 'motion/react';
import { useEffect, useRef } from 'react';

type Kind = 'mouse' | 'pen' | 'touch' | 'none';
interface Target { el: HTMLElement; cx: number; cy: number; top: number; bottom: number; left: number; right: number }

/** Satu instance global: posisi pointer tidak pernah lewat state React. */
export const pointer = {
  x: motionValue(Number.NaN),
  y: motionValue(Number.NaN),
  kind: motionValue<Kind>('none'),
};

const targets = new Map<string, Target>();
let dirty = true;
let paused = false; // true selama layout morph berjalan

function remeasure() {
  for (const t of targets.values()) {
    const r = t.el.getBoundingClientRect();
    t.cx = r.left + r.width / 2;
    t.cy = r.top + r.height / 2;
    t.top = r.top;
    t.bottom = r.bottom;
    t.left = r.left;
    t.right = r.right;
  }
  dirty = false;
}

/** Dibaca oleh useTransform / useAnimationFrame, tidak oleh event. */
export function targetOf(key: string): Target | null {
  if (paused) return null;
  if (dirty) remeasure();
  return targets.get(key) ?? null;
}

export const invalidate = () => {
  dirty = true;
};
export const pauseProximity = (v: boolean) => {
  paused = v;
  if (!v) dirty = true;
};

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const onMove = (e: PointerEvent) => {
    pointer.kind.set(e.pointerType as Kind);
    if (e.pointerType === 'touch') return; // sentuh hanya lewat scrubber
    pointer.x.set(e.clientX);
    pointer.y.set(e.clientY);
  };
  const onLeave = () => {
    pointer.x.set(Number.NaN);
    pointer.y.set(Number.NaN);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', (e) => pointer.kind.set(e.pointerType as Kind), { capture: true, passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  window.addEventListener('resize', invalidate, { passive: true });
  window.addEventListener('orientationchange', invalidate);
  document.fonts?.addEventListener?.('loadingdone', invalidate);
}

/** Daftarkan elemen (slot ikon, slot huruf, bilah) tanpa memicu render. */
export function useProximityTarget<T extends HTMLElement = HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    install();
    const el = ref.current;
    if (!el) return;
    targets.set(key, { el, cx: 0, cy: 0, top: 0, bottom: 0, left: 0, right: 0 });
    const ro = new ResizeObserver(invalidate);
    ro.observe(el);
    invalidate();
    return () => {
      ro.disconnect();
      if (targets.get(key)?.el === el) targets.delete(key);
    };
  }, [key]);
  return ref;
}

/** Faktor Gaussian 0..1 untuk satu target, sumbu X. */
export function gaussianX(key: string, sigma: number, x: number): number {
  const t = targetOf(key);
  if (!t || Number.isNaN(x)) return 0;
  const d = x - t.cx;
  if (Math.abs(d) > 3 * sigma) return 0;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}
