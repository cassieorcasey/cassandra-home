import { useCallback, useMemo, useReducer, useRef } from 'react';
import type { AppId, Flight, RectSnapshot, WindowTransitionPhase } from '../types/os';

export type { Rect } from '../types/os';

export interface Win {
  id: AppId;
  load: 'loading' | 'ready';
  nonce: number; // naik saat Refresh agar iframe dimuat ulang
  /** Diperkecil ke tab-nya di Multitask Bar: sesi iframe tetap hidup di latar. */
  minimized: boolean;
  /** Naik setiap aplikasi dibuka dari keadaan tertutup. Dipakai sebagai key jendela agar
   *  pembukaan ulang saat animasi tutup masih berjalan selalu memasang iframe baru. */
  session: number;
  /** opening/closing selama morph berjalan; jendela 'closing' masih dirender sampai morph mendarat. */
  phase: WindowTransitionPhase;
}

export interface WMState {
  wins: Win[]; // urutan dibuka
  activeId: AppId | null;
  expanded: boolean;
  flight: Flight | null;
  seq: number;
  sessions: number;
}

type FlightInput = Omit<Flight, 'key' | 'id' | 'phase' | 'mode'> | null;

export type Action =
  | { type: 'launch'; id: AppId; flight: FlightInput }
  | { type: 'focus'; id: AppId }
  | { type: 'minimize'; id: AppId; flight: FlightInput; next: AppId | null }
  | { type: 'close'; id: AppId; flight: FlightInput; next: AppId | null }
  | { type: 'landed'; key: number }
  | { type: 'ready'; id: AppId }
  | { type: 'refresh'; id: AppId }
  | { type: 'toggleExpand' };

const withFlight = (s: WMState, id: AppId, mode: Flight['mode'], f: FlightInput): Pick<WMState, 'flight' | 'seq'> =>
  f
    ? { flight: { ...f, id, mode, phase: mode === 'open' ? 'opening' : 'closing', key: s.seq + 1 }, seq: s.seq + 1 }
    : { flight: null, seq: s.seq };

/** Sedang dalam morph tutup (bukan collapse): sesinya dibuang begitu mendarat. */
const isDying = (w: Win) => w.phase === 'closing' && !w.minimized;
/** Jendela yang masih hidup (bukan sedang ditutup). */
export const isLive = (w: Win) => !isDying(w);
/** Tab di Multitask Bar: aplikasi berjalan (terbuka atau diperkecil), urut waktu dibuka. */
export const tabIds = (s: WMState): AppId[] => s.wins.filter(isLive).map((w) => w.id);

/** Selesaikan morph yang sedang berjalan seolah sudah mendarat. */
function settle(s: WMState): WMState {
  const f = s.flight;
  if (!f) return s;
  const wins =
    f.mode === 'close'
      ? s.wins.filter((w) => !(w.id === f.id && isDying(w)))
      : s.wins.map((w) => (w.id === f.id ? { ...w, phase: 'open' as const } : w));
  return { ...s, flight: null, wins };
}

export function reducer(prev: WMState, a: Action): WMState {
  // Morph baru untuk aplikasi lain menggantikan yang lama: yang lama dituntaskan dulu, supaya
  // tidak ada jendela yang tertahan di fase opening/closing. Morph aplikasi yang sama dilanjutkan
  // dari posisi live-nya (interupsi) oleh FlightLayer.
  const target =
    a.type === 'launch' || a.type === 'close' || a.type === 'minimize' ? a.id : null;
  const s = prev.flight && target && prev.flight.id !== target ? settle(prev) : prev;
  switch (a.type) {
    case 'launch': {
      if (s.activeId === a.id) return s;
      // sesi yang sedang ditutup tidak dihidupkan lagi: dibuang, lalu dibuka sesi baru
      const wins = s.wins.filter((w) => !(w.id === a.id && isDying(w)));
      const exists = wins.some((w) => w.id === a.id);
      const phase: WindowTransitionPhase = a.flight ? 'opening' : 'open';
      return {
        ...s,
        ...withFlight(s, a.id, 'open', a.flight),
        wins: exists
          ? wins.map((w) => (w.id === a.id ? { ...w, minimized: false, phase } : w))
          : [...wins, { id: a.id, load: 'loading', nonce: 0, minimized: false, session: s.sessions + 1, phase }],
        sessions: exists ? s.sessions : s.sessions + 1,
        activeId: a.id,
        expanded: false,
      };
    }
    case 'focus':
      if (s.activeId === a.id) return s;
      return {
        ...s,
        wins: s.wins.map((w) => (w.id === a.id ? { ...w, minimized: false, phase: 'open' } : w)),
        activeId: a.id,
        expanded: false,
        // fokus tidak menyentuh morph yang sedang berjalan (jendela lain boleh masih membuka/menutup)
      };
    case 'minimize': {
      const id = a.id;
      if (!s.wins.some((w) => w.id === id && isLive(w))) return s;
      return {
        ...s,
        ...withFlight(s, id, 'collapse', a.flight),
        wins: s.wins.map((w) => (w.id === id ? { ...w, minimized: true, phase: a.flight ? 'closing' : 'open' } : w)),
        // fokus pindah ke jendela lain yang masih tampil di layar ini (dipilih App)
        activeId: s.activeId === id ? a.next : s.activeId,
        expanded: s.activeId === id ? false : s.expanded,
      };
    }
    case 'close': {
      const wasActive = s.activeId === a.id;
      const animate = !!a.flight;
      return {
        ...s,
        ...(animate ? withFlight(s, a.id, 'close', a.flight) : { flight: s.flight }),
        // dengan morph, entri tetap ada (phase 'closing') sampai mendarat; tanpa morph langsung dibuang
        wins: animate
          ? s.wins.map((w) => (w.id === a.id ? { ...w, phase: 'closing' } : w))
          : s.wins.filter((w) => w.id !== a.id),
        activeId: wasActive ? a.next : s.activeId,
        expanded: wasActive ? false : s.expanded,
      };
    }
    case 'landed':
      return s.flight && s.flight.key === a.key ? settle(s) : s;
    case 'ready':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, load: 'ready' } : w)) };
    case 'refresh':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, load: 'loading', nonce: w.nonce + 1 } : w)) };
    case 'toggleExpand':
      return { ...s, expanded: !s.expanded };
  }
}

export const initial: WMState = { wins: [], activeId: null, expanded: false, flight: null, seq: 0, sessions: 0 };

/**
 * Potret elemen dalam koordinat "istirahat" Launchpad. Saat jendela terbuka, .launchpad
 * diperkecil ke 0.98 (scale dari tengahnya); getBoundingClientRect() mentah akan bergeser
 * dari posisi kartu begitu skala kembali ke 1. Skala itu dibalik di sini.
 */
function restSnapshot(el: HTMLElement): RectSnapshot {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const pad = el.closest<HTMLElement>('.launchpad');
  const s = pad && pad.offsetWidth ? pad.getBoundingClientRect().width / pad.offsetWidth : 1;
  if (!pad || Math.abs(s - 1) < 0.001) {
    return { top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: radius };
  }
  const p = pad.getBoundingClientRect();
  const cx = p.left + p.width / 2;
  const cy = p.top + p.height / 2;
  return {
    left: cx + (r.left - cx) / s,
    top: cy + (r.top - cy) / s,
    width: r.width / s,
    height: r.height / s,
    borderRadius: radius,
  };
}

export function useWindowManager() {
  const [state, dispatch] = useReducer(reducer, initial);

  // ---- registry kartu Launchpad per aplikasi: titik asal dan titik pulang morph
  const tileElements = useRef(new Map<AppId, HTMLElement>());
  const registerTileElement = useCallback((id: AppId, el: HTMLElement | null) => {
    if (el) tileElements.current.set(id, el);
    else tileElements.current.delete(id);
  }, []);
  /** Rect kartu SpaceCard terbaru (dibaca saat itu juga) atau null bila tidak terpasang. */
  const getTileRect = useCallback((id: AppId): RectSnapshot | null => {
    const el = tileElements.current.get(id);
    return el && el.isConnected ? restSnapshot(el) : null;
  }, []);

  // ---- registry ikon tab di Multitask Bar: target morph minimize dan ikon terbang
  const tabElements = useRef(new Map<AppId, HTMLElement>());
  const registerTabElement = useCallback((id: AppId, el: HTMLElement | null) => {
    if (el) tabElements.current.set(id, el);
    else tabElements.current.delete(id);
  }, []);
  /** Rect ikon tab saat ini (koordinat layar) atau null bila tab belum/tidak terpasang. */
  const getTabRect = useCallback((id: AppId): RectSnapshot | null => {
    const el = tabElements.current.get(id);
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    return { top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: radius };
  }, []);

  const actions = useMemo(
    () => ({
      launch: (id: AppId, flight: FlightInput = null) => dispatch({ type: 'launch', id, flight }),
      focus: (id: AppId) => dispatch({ type: 'focus', id }),
      minimize: (id: AppId, flight: FlightInput = null, next: AppId | null = null) => dispatch({ type: 'minimize', id, flight, next }),
      close: (id: AppId, flight: FlightInput = null, next: AppId | null = null) => dispatch({ type: 'close', id, flight, next }),
      landed: (key: number) => dispatch({ type: 'landed', key }),
      markReady: (id: AppId) => dispatch({ type: 'ready', id }),
      refresh: (id: AppId) => dispatch({ type: 'refresh', id }),
      toggleExpand: () => dispatch({ type: 'toggleExpand' }),
    }),
    [],
  );
  return { state, registerTileElement, getTileRect, registerTabElement, getTabRect, ...actions };
}

/** Aksi yang dipakai StageWindow; App membungkusnya dengan perhitungan rect morph. */
export interface WindowActions {
  close: (id: AppId) => void;
  /** Perkecil jendela ini ke tab-nya di Multitask Bar: sesi iframe tetap hidup. */
  minimize: (id: AppId) => void;
  focus: (id: AppId) => void;
  refresh: (id: AppId) => void;
  /** Jendela ini sementara memenuhi stage (atau kembali ke grid). */
  toggleExpand: (id: AppId) => void;
  markReady: (id: AppId) => void;
  /** Pindah ke layar berikutnya (1) atau sebelumnya (-1); diam di ujung. */
  switchScreen: (dir: 1 | -1) => void;
  /** Header diseret ke samping sejauh `dx`: seluruh layar mengikuti. */
  dragScreen: (dx: number) => void;
  /** Seret selesai: pindah layar bila lewat ambang/kecepatan (`v` px/s), selain itu kembali. */
  endScreenDrag: (dx: number, v: number, cancelled: boolean) => void;
}
