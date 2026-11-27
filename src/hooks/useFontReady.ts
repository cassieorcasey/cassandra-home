import { useEffect, useState } from 'react';
import { DOCK_GEOMETRY } from '../config/motion';
import { invalidate } from './usePointerProximity';

export const SIGNATURE = [...'Cassandra'];
let cached: number[] | null = null;
let pending: Promise<number[]> | null = null;

async function measureWidths(px = DOCK_GEOMETRY.signature.px): Promise<number[]> {
  try {
    await Promise.all([
      document.fonts.load(`500 ${px}px Unbounded`),
      document.fonts.load(`800 ${px}px Unbounded`),
    ]);
  } catch {
    /* font gagal dimuat: ukur dengan fallback */
  }
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `800 ${px}px Unbounded, system-ui, sans-serif`;
  return SIGNATURE.map((c) => Math.ceil(ctx.measureText(c).width));
}

/** Lebar advance tiap huruf pada bobot 800, diukur sekali setelah Unbounded siap. */
export function useSignatureWidths(): number[] | null {
  const [w, setW] = useState(cached);
  useEffect(() => {
    if (cached) return;
    pending ??= measureWidths().then((x) => (cached = x));
    let alive = true;
    pending.then((x) => {
      if (!alive) return;
      setW(x);
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, []);
  return w;
}
