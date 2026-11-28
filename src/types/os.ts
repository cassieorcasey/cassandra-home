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

/** Geometri jendela (posisi kiri-atas + ukuran), dipakai stage dan drag/resize. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Potret elemen di layar untuk morph: kotak viewport plus radius sudutnya. */
export interface RectSnapshot {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

/** Fase transisi satu jendela: sedang membuka, terbuka (termasuk di latar), atau sedang menutup. */
export type WindowTransitionPhase = 'opening' | 'open' | 'closing';

/**
 * Morph Tile-to-Window yang sedang berjalan. Hanya satu sekaligus.
 * - opening: dari kartu Launchpad / baris Spotlight ke jendela.
 * - closing: dari jendela ke kartu Launchpad; `mode` membedakan collapse (sesi tetap hidup)
 *   dan close (sesi dibuang). `fade` = tujuan tidak ditemukan, proxy memudar di tengah layar.
 */
export interface Flight {
  key: number;
  id: AppId;
  phase: 'opening' | 'closing';
  mode: 'open' | 'collapse' | 'close';
  from: RectSnapshot;
  to: RectSnapshot;
  fade: boolean;
}
