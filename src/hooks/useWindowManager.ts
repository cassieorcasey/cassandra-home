import { useMemo, useReducer } from 'react';
import type { AppId, Flight, WindowLifecycle } from '../types/os';

export type { Rect } from '../types/os';

export interface Win {
  id: AppId;
  load: 'loading' | 'ready';
  nonce: number; // naik saat Refresh agar iframe dimuat ulang
  minimized: boolean;
}

export interface WMState {
  wins: Win[]; // urutan dibuka
  activeId: AppId | null;
  deck: AppId[]; // aplikasi latar belakang karena berpindah (Side Stage Strip), terbaru di depan
  expanded: boolean;
  flight: Flight | null;
  bounce: Partial<Record<AppId, number>>;
  seq: number;
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
          : [...s.wins, { id: a.id, load: 'loading', nonce: 0, minimized: false }],
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
    case 'toggleExpand':
      return { ...s, expanded: !s.expanded };
  }
}

const initial: WMState = { wins: [], activeId: null, deck: [], expanded: false, flight: null, bounce: {}, seq: 0 };

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
}
