/** Logika halaman Multitask Bar (tanpa React). */
export const TABS_PER_PAGE = 4;
/** Geser sejauh ini (bagian dari lebar baris) atau secepat ini (px/s) untuk ganti halaman. */
const SWIPE_RATIO = 0.3;
const SWIPE_VELOCITY = 500;

/** Kapasitas satu layar (= satu halaman bar): 4 di desktop/tablet, 2 di HP. */
export const screenCapacity = (mobile: boolean): 2 | 4 => (mobile ? 2 : 4);

export const pageCount = (n: number, k = TABS_PER_PAGE) => Math.max(1, Math.ceil(n / k));
export const pageOf = (index: number, k = TABS_PER_PAGE) => Math.floor(index / k);
export const clampPage = (page: number, n: number, k = TABS_PER_PAGE) => Math.min(Math.max(page, 0), pageCount(n, k) - 1);

/** dx negatif (geser ke kiri) membuka halaman berikutnya. */
export function nextPageFromSwipe(page: number, n: number, dx: number, width: number, velocity: number, k = TABS_PER_PAGE) {
  const far = Math.abs(dx) >= width * SWIPE_RATIO;
  const fast = Math.abs(velocity) >= SWIPE_VELOCITY;
  if (!far && !fast) return page;
  const dir = (far ? dx : velocity) < 0 ? 1 : -1;
  return clampPage(page + dir, n, k);
}

// ---- Geometri bar (harus sama dengan styles/taskbar.css) ----
/** Tinggi pil = tinggi satu baris. */
export const BAR_H = 64;
export const TB_ICON = 44;
export const TB_GAP = 14;
export const TB_SLOT = TB_ICON + TB_GAP;
export const TB_RADIUS = 13;
/** padding kiri/kanan pil */
const BAR_PAD = 10;
/** jarak pil dari bawah (di atas safe area) */
const BAR_BOTTOM = 12;
/** kolom titik halaman: jarak 10 + titik 5 */
const DOTS_W = 15;

export const slotsWidth = (slots: number) => slots * TB_ICON + (slots - 1) * TB_GAP;
/** Jumlah slot yang terlihat di baris tab pada halaman `page`. */
export const pageSlots = (n: number, page: number, k = TABS_PER_PAGE) => Math.min(Math.max(n - page * k, 1), k);

/**
 * Rect akhir ikon tab ke-`index` saat bar menetap di baris tab halaman `page` dengan `n` tab.
 * Dihitung dari tata letak (bukan dibaca dari DOM) supaya morph bisa berangkat seketika
 * sementara bar masih beranimasi pindah halaman / berubah lebar.
 */
export function tabSlotRect(vp: { w: number; h: number; sab: number }, n: number, index: number, page: number, k = TABS_PER_PAGE) {
  const inner = slotsWidth(pageSlots(n, page, k));
  const barW = BAR_PAD * 2 + inner + (pageCount(n, k) > 1 ? DOTS_W : 0);
  const left = vp.w / 2 - barW / 2 + BAR_PAD + (index - page * k) * TB_SLOT;
  const top = vp.h - BAR_BOTTOM - vp.sab - BAR_H + (BAR_H - TB_ICON) / 2;
  return { left, top, width: TB_ICON, height: TB_ICON, borderRadius: TB_RADIUS };
}
