import { useReducer } from 'react';

export interface Rect { x: number; y: number; w: number; h: number }

export interface OpenApp {
  id: string;
  origin: Rect | null; // posisi ikon asal untuk animasi morfin
  status: 'loading' | 'ready';
  nonce: number; // naik saat Refresh agar iframe dimuat ulang
}

export interface WMState {
  apps: OpenApp[]; // urutan buka (dipakai tab bar mobile)
  activeId: string | null;
  deck: string[]; // terbaru di depan
  expanded: boolean;
}

type Action =
  | { type: 'open'; id: string; origin: Rect | null }
  | { type: 'focus'; id: string }
  | { type: 'minimize' }
  | { type: 'close'; id: string }
  | { type: 'ready'; id: string }
  | { type: 'refresh'; id: string }
  | { type: 'toggleExpand' };

const pushActiveToDeck = (s: WMState, except?: string) =>
  [s.activeId, ...s.deck].filter((x): x is string => !!x && x !== except);

function reducer(s: WMState, a: Action): WMState {
  switch (a.type) {
    case 'open':
      if (s.apps.some((x) => x.id === a.id)) return reducer(s, { type: 'focus', id: a.id });
      return {
        ...s,
        apps: [...s.apps, { id: a.id, origin: a.origin, status: 'loading', nonce: 0 }],
        deck: pushActiveToDeck(s),
        activeId: a.id,
      };
    case 'focus':
      if (s.activeId === a.id) return s;
      return { ...s, deck: pushActiveToDeck(s, a.id), activeId: a.id };
    case 'minimize':
      if (!s.activeId) return s;
      return { ...s, deck: pushActiveToDeck(s), activeId: null, expanded: false };
    case 'close':
      return {
        apps: s.apps.filter((x) => x.id !== a.id),
        deck: s.deck.filter((x) => x !== a.id),
        activeId: s.activeId === a.id ? null : s.activeId,
        expanded: s.activeId === a.id ? false : s.expanded,
      };
    case 'ready':
      return { ...s, apps: s.apps.map((x) => (x.id === a.id ? { ...x, status: 'ready' } : x)) };
    case 'refresh':
      return {
        ...s,
        apps: s.apps.map((x) => (x.id === a.id ? { ...x, status: 'loading', nonce: x.nonce + 1 } : x)),
      };
    case 'toggleExpand':
      return { ...s, expanded: !s.expanded };
  }
}

export function useWindowManager() {
  const [state, dispatch] = useReducer(reducer, { apps: [], activeId: null, deck: [], expanded: false });
  return {
    state,
    open: (id: string, origin: Rect | null = null) => dispatch({ type: 'open', id, origin }),
    focus: (id: string) => dispatch({ type: 'focus', id }),
    minimize: () => dispatch({ type: 'minimize' }),
    close: (id: string) => dispatch({ type: 'close', id }),
    markReady: (id: string) => dispatch({ type: 'ready', id }),
    refresh: (id: string) => dispatch({ type: 'refresh', id }),
    toggleExpand: () => dispatch({ type: 'toggleExpand' }),
  };
}

export type WindowManager = ReturnType<typeof useWindowManager>;
