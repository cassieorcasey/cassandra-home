import { useMemo, useReducer } from 'react';
import type { AppId, Flight, Rect, WindowLifecycle } from '../types/os';

export type { Rect } from '../types/os';

export interface Win {
  id: AppId;
  load: 'loading' | 'ready';
  nonce: number; // naik saat Refresh agar iframe dimuat ulang
  minimized: boolean;
  /** Naik setiap aplikasi dibuka dari keadaan tertutup. Dipakai sebagai key jendela agar
   *  pembukaan ulang saat animasi tutup masih berjalan selalu memasang iframe baru. */
  session: number;
  /** Geometri hasil drag/resize di desktop. Bertahan selama di Side Stage Strip atau
   *  di-minimize; hilang bersama entri jendela saat ditutup. Kosong = pakai stageRect. */
  rect?: Rect;
}

export interface WMState {
  wins: Win[]; // urutan dibuka
  activeId: AppId | null;
  deck: AppId[]; // aplikasi latar belakang karena berpindah (Side Stage Strip), terbaru di depan
  expanded: boolean;
  flight: Flight | null;
  bounce: Partial<Record<AppId, number>>;
  seq: number;
  sessions: number;
}

type FlightInput = Omit<Flight, 'key' | 'id' | 'direction'> | null;

type Action =
  | { type: 'launch'; id: AppId; flight: FlightInput }
  | { type: 'focus'; id: AppId }
  | { type: 'minimize'; flight: FlightInput }
  | { type: 'close'; id: AppId; flight: FlightInput }
  | { type: 'landed'; key: number }
  | { type: 'ready'; id: AppId }
  | { type: 'refresh'; id: AppId }
  | { type: 'setRect'; id: AppId; rect: Rect }
  | { type: 'toggleExpand' };

const withFlight = (s: WMState, id: AppId, direction: Flight['direction'], f: FlightInput): Pick<WMState, 'flight' | 'seq'> =>
  f ? { flight: { ...f, id, direction, key: s.seq + 1 }, seq: s.seq + 1 } : { flight: null, seq: s.seq };

const sendActiveToDeck = (s: WMState, except: AppId) =>
  [s.activeId, ...s.deck].filter((x): x is AppId => !!x && x !== except);

function reducer(s: WMState, a: Action): WMState {
  switch (a.type) {
    case 'launch': {
      if (s.activeId === a.id) return s;
      const exists = s.wins.some((w) => w.id === a.id);
      return {
        ...s,
        ...withFlight(s, a.id, 'open', a.flight),
        wins: exists
          ? s.wins.map((w) => (w.id === a.id ? { ...w, minimized: false } : w))
          : [...s.wins, { id: a.id, load: 'loading', nonce: 0, minimized: false, session: s.sessions + 1 }],
        sessions: exists ? s.sessions : s.sessions + 1,
        deck: sendActiveToDeck(s, a.id),
        activeId: a.id,
      };
    }
    case 'focus':
      if (s.activeId === a.id) return s;
      return {
        ...s,
        wins: s.wins.map((w) => (w.id === a.id ? { ...w, minimized: false } : w)),
        deck: sendActiveToDeck(s, a.id),
        activeId: a.id,
        flight: null,
      };
    case 'minimize': {
      const id = s.activeId;
      if (!id) return s;
      return {
        ...s,
        ...withFlight(s, id, 'minimize', a.flight),
        wins: s.wins.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
        activeId: null,
        expanded: false,
      };
    }
    case 'close': {
      const wasActive = s.activeId === a.id;
      return {
        ...s,
        ...(wasActive ? withFlight(s, a.id, 'close', a.flight) : { flight: s.flight }),
        wins: s.wins.filter((w) => w.id !== a.id),
        deck: s.deck.filter((x) => x !== a.id),
        activeId: wasActive ? null : s.activeId,
        expanded: wasActive ? false : s.expanded,
      };
    }
    case 'landed': {
      const f = s.flight;
      if (!f || f.key !== a.key) return s;
      const bounce = f.direction === 'open' ? s.bounce : { ...s.bounce, [f.id]: (s.bounce[f.id] ?? 0) + 1 };
      return { ...s, flight: null, bounce };
    }
    case 'ready':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, load: 'ready' } : w)) };
    case 'refresh':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, load: 'loading', nonce: w.nonce + 1 } : w)) };
    case 'setRect':
      return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, rect: a.rect } : w)) };
    case 'toggleExpand':
      return { ...s, expanded: !s.expanded };
  }
}

const initial: WMState = { wins: [], activeId: null, deck: [], expanded: false, flight: null, bounce: {}, seq: 0, sessions: 0 };

export function lifecycleOf(s: WMState, id: AppId): WindowLifecycle {
  const w = s.wins.find((x) => x.id === id);
  if (!w) return { phase: 'closed' };
  if (s.activeId === id) return { phase: 'active', load: w.load };
  return { phase: 'background', load: w.load, reason: w.minimized ? 'minimized' : 'switched' };
}

export function useWindowManager() {
  const [state, dispatch] = useReducer(reducer, initial);
  const actions = useMemo(
    () => ({
      launch: (id: AppId, flight: FlightInput = null) => dispatch({ type: 'launch', id, flight }),
      focus: (id: AppId) => dispatch({ type: 'focus', id }),
      minimize: (flight: FlightInput = null) => dispatch({ type: 'minimize', flight }),
      close: (id: AppId, flight: FlightInput = null) => dispatch({ type: 'close', id, flight }),
      landed: (key: number) => dispatch({ type: 'landed', key }),
      markReady: (id: AppId) => dispatch({ type: 'ready', id }),
      refresh: (id: AppId) => dispatch({ type: 'refresh', id }),
      setRect: (id: AppId, rect: Rect) => dispatch({ type: 'setRect', id, rect }),
      toggleExpand: () => dispatch({ type: 'toggleExpand' }),
    }),
    [],
  );
  return { state, ...actions };
}

/** Aksi yang dipakai StageWindow; App membungkusnya dengan perhitungan rect penerbangan. */
export interface WindowActions {
  close: (id: AppId) => void;
  minimize: () => void;
  focus: (id: AppId) => void;
  refresh: (id: AppId) => void;
  toggleExpand: () => void;
  markReady: (id: AppId) => void;
  /** Rect final setelah drag/resize (dikirim sekali pada pointerup/pointercancel). */
  setRect: (id: AppId, rect: Rect) => void;
  /** Pindah ke aplikasi berjalan berikutnya (1) atau sebelumnya (-1) dari `id`, berputar. */
  cycle: (id: AppId, dir: 1 | -1) => void;
}
