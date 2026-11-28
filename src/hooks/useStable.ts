import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Fungsi dengan identitas tetap yang selalu memanggil versi terbaru `fn`. Dipakai untuk callback yang
 * diteruskan ke komponen ber-`memo`, supaya mereka tidak ikut render ulang setiap kali App render.
 */
export function useStable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
