export type AppId = 'lemma' | 'synthesis' | 'conway' | 'subset' | 'wishy';

export interface CassandraApp {
  id: AppId;
  name: string;
  tagline: string;
  category: 'App' | 'Tool' | 'Social' | 'Experiment';
  url: string;
  embedMode: 'iframe' | 'preview-card';
  featured?: boolean;
}

/** Siklus hidup satu jendela. Tepat satu jendela boleh 'active'. */
export type WindowLifecycle =
  | { phase: 'closed' }
  | { phase: 'active'; load: 'loading' | 'ready' }
  | { phase: 'background'; load: 'loading' | 'ready'; reason: 'switched' | 'minimized' };

export type BarMode = 'home' | 'active';

export interface Rect { x: number; y: number; w: number; h: number }

/** Penerbangan cangkang ikon ↔ jendela. Hanya satu yang berjalan. */
export interface Flight {
  key: number;
  id: AppId;
  direction: 'open' | 'minimize' | 'close';
  from: Rect;
  to: Rect;
}
