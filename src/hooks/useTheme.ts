import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const order: ThemePref[] = ['system', 'light', 'dark'];

function load(): ThemePref {
  try {
    const v = localStorage.getItem('cassandra-theme');
    return order.includes(v as ThemePref) ? (v as ThemePref) : 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(load);

  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', pref);
    try {
      localStorage.setItem('cassandra-theme', pref);
    } catch {
      /* storage tidak tersedia */
    }
  }, [pref]);

  const cycle = () => setPref((p) => order[(order.indexOf(p) + 1) % order.length]);
  return { pref, cycle };
}
