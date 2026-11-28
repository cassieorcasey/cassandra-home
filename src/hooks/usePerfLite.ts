import { useSyncExternalStore } from 'react';

/**
 * `true` setelah probe di main.tsx menandai perangkat lambat (`<html data-perf="lite">`).
 * Tanda itu dipasang ±1 detik setelah render pertama, jadi diamati, bukan dibaca sekali.
 */
const read = () => document.documentElement.dataset.perf === 'lite';
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-perf'] });
  return () => mo.disconnect();
}
export function usePerfLite() {
  return useSyncExternalStore(subscribe, read, () => false);
}
