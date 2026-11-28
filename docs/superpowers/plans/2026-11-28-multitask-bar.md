# Multitask Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven
> development (recommended) or inline execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti Side Stage Strip dengan bottom bar dua baris (tab app berjalan, 4 per halaman, geser kanan; baris 2 peluncur) beserta ikon yang terbang dari tile ke tab saat app dibuka.

**Architecture:** Logika murni (urutan tab, halaman, rect stage) dipisah ke modul tanpa React dan diuji dengan Vitest. Reducer window manager kehilangan `deck`; tab diturunkan dari `wins` (urutan dibuka). Komponen baru `TaskBar` mendaftarkan elemen slot tab seperti `registerTileElement`, sehingga morph minimize dan ikon terbang mendapat rect target. Perilaku UI diverifikasi dengan skrip Playwright (Chromium headless yang sudah dipakai di sesi ini).

**Tech Stack:** React 19, TypeScript, Vite 8, motion 14, Vitest (baru, devDependency), Playwright Python (sudah terpasang di sandbox).

**Spec:** `docs/superpowers/specs/2026-11-28-multitask-bar-design.md`

## Global Constraints

- Satu app = satu tab; maksimal 5 tab (5 app).
- `TABS_PER_PAGE = 4`.
- Ukuran ikon tab `44` px, jarak antar-ikon `14` px, tinggi baris bar `64` px.
- Axis-lock gestur `10` px; ganti halaman bila geser ≥ 30 % lebar baris atau flick.
- Ikon terbang memakai pegas `WINDOW_MORPH.open` (~380 ms); reduced motion = crossfade `120` ms (`WINDOW_MORPH.reducedFadeMs`).
- Minimize dan Esc = jendela morph ke ikon tab-nya; Close = morph ke kartu Launchpad (tidak berubah).
- Klik tab aktif = minimize; klik tab lain = fokus/pulihkan.
- Side Stage Strip dihapus seluruhnya: `deck`, `deckSlot`, `STRIP_*`, `stripLeft`, `padLeft`, `Placement 'deck'`, `.deck-hit`, `.deck-label`, `.stage-window.is-deck`.
- Bar tidak menutupi jendela: stage menyisakan ruang bawah `BAR_RESERVED`.
- Commit diatur pengguna (aturan tetap): pengimplementasi TIDAK commit/push; perubahan dikumpulkan dan pengguna ditanya di akhir.
- `npm run build` dan `npm run lint` (oxlint) harus bersih (0 error, 0 warning).

## Review Focus

1. Membuka app ke-5 saat bar di halaman 1: bar harus pindah ke halaman 2 sebelum ikon terbang mendarat, bukan mendarat di slot yang tak terlihat.
2. Menutup tab sehingga halaman aktif jadi kosong (mis. 5 → 4 tab di halaman 2): bar mundur ke halaman terakhir yang ada.
3. Minimize saat slot tab tidak terlihat (halaman lain atau bar di baris 2): bar kembali ke baris 1/halaman tab itu dulu, lalu jendela morph ke slot.
4. Gestur di bar tidak memicu swipe jendela di ponsel, dan swipe jendela (bawah = minimize) tetap jalan.
5. Jendela kustom (drag/resize) yang dulu dijepit `STRIP_LEFT_LIMIT` kini boleh ke tepi kiri dan tidak boleh tertutup bar di bawah.

---

### Task 1: Vitest dan reducer tanpa `deck`

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)
- Modify: `src/hooks/useWindowManager.ts` (ekspor `reducer`, `initial`; hapus `deck`, `sendActiveToDeck`)
- Create: `src/hooks/useWindowManager.test.ts`

**Interfaces:**
- Produces: `export function reducer(s: WMState, a: Action): WMState`, `export const initial: WMState`, `export type Action`; `WMState` tanpa `deck`. `export const tabIds = (s: WMState): AppId[]` = id dari `wins.filter(isLive)` dalam urutan dibuka.

- [ ] **Step 1: Pasang Vitest** — `npm i -D vitest`, tambah script `test`.
- [ ] **Step 2: Tulis tes gagal**

```ts
test('tabs follow open order and survive minimize', () => {
  let s = reducer(initial, { type: 'launch', id: 'lemma', flight: null });
  s = reducer(s, { type: 'launch', id: 'conway', flight: null });
  s = reducer(s, { type: 'minimize', flight: null });
  expect(tabIds(s)).toEqual(['lemma', 'conway']);
  expect(s.activeId).toBeNull();
  expect(s.wins.find((w) => w.id === 'conway')!.minimized).toBe(true);
});
test('focus restores a minimized tab without reordering', () => {
  /* launch lemma, launch conway, minimize, focus lemma → activeId 'lemma', tabIds tetap ['lemma','conway'] */
});
test('close removes the tab', () => {
  /* launch lemma, launch conway, close conway (flight null) → tabIds ['lemma'], activeId null */
});
test('state has no deck', () => { expect('deck' in initial).toBe(false); });
```

- [ ] **Step 3: Jalankan, pastikan gagal** — `npx vitest run src/hooks/useWindowManager.test.ts` → FAIL (`reducer`/`tabIds` tidak diekspor).
- [ ] **Step 4: Implementasi** — ekspor `reducer`, `initial`, `Action`; tambah `tabIds`; hapus `deck` dan semua pemakaiannya di reducer.
- [ ] **Step 5: Jalankan** — `npx vitest run` → PASS. (Build boleh merah sampai Task 3.)

### Task 2: Logika halaman bar

**Files:**
- Create: `src/lib/taskbar.ts`, `src/lib/taskbar.test.ts`

**Interfaces:**
- Produces:
  - `export const TABS_PER_PAGE = 4`
  - `pageCount(n: number): number` → `max(1, ceil(n/4))`
  - `pageOf(index: number): number` → `floor(index/4)`
  - `clampPage(page: number, n: number): number` → dijepit ke `[0, pageCount(n)-1]`
  - `nextPageFromSwipe(page: number, n: number, dx: number, width: number, velocity: number): number` — dx negatif (geser kiri) = halaman berikut; ambang `|dx| >= 0.3*width` atau `|velocity| >= 500` px/s.

- [ ] **Step 1: Tes gagal** — kasus: `pageCount(0)=1, (4)=1, (5)=2`; `pageOf(4)=1`; `clampPage(1, 4)=0`; `nextPageFromSwipe(0,5,-200,400,0)=1`; `(0,5,-50,400,0)=0`; `(0,5,-50,400,-800)=1`; `(1,5,-200,400,0)=1` (tidak melewati akhir); `(1,5,200,400,0)=0`.
- [ ] **Step 2: Jalankan** → FAIL (modul tidak ada).
- [ ] **Step 3: Implementasi** fungsi di atas.
- [ ] **Step 4: Jalankan** `npx vitest run` → PASS.

### Task 3: Hapus Side Stage Strip, sisakan ruang bar

**Files:**
- Modify: `src/hooks/useViewport.ts`, `src/hooks/useViewport.test.ts` (baru), `src/App.tsx`, `src/components/os/StageWindow.tsx`, `src/components/os/Launchpad.tsx`, `src/styles/globals.css`, `src/components/stage/FlightLayer.tsx` (komentar)

**Interfaces:**
- Produces: `export const BAR_H = 64`, `export const BAR_RESERVED = BAR_H + 24` (bar + jarak), `stageRect(vp, expanded)` dengan `x = 24` (desktop normal), bawah = `vp.h - STAGE_MARGIN - BAR_RESERVED - vp.sab`; mobile: tinggi dikurangi `BAR_RESERVED`. `clampWindowRect(r, vp, edge?)` tanpa parameter `minLeft`, batas bawah dikurangi `BAR_RESERVED`. `Placement = 'stage' | 'hidden'`.

- [ ] **Step 1: Tes gagal** (`useViewport.test.ts`): untuk `vp={w:1440,h:900,mobile:false,sab:0,sat:0}`: `stageRect(vp,false)` = `{x:24, y:12, w:1392, h:900-12-12-88}`; `clampWindowRect({x:0,y:800,w:500,h:400}, vp).y + h <= 900 - 8 - 88`; mobile `{w:390,h:844,sab:34,sat:47}` → `h = 844-47-34-88`.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi** — hapus `STRIP_*`, `deckSlot`, `STRIP_RESERVED`, `STRIP_LEFT_LIMIT`; terapkan rumus di atas. Di `App.tsx` hapus `deckOnDesktop`, `stripLeft`, cabang placement `'deck'`, cabang `state.deck.includes` di `launch`, prop `padLeft`. Di `StageWindow` hapus prop `stripLeft`, placement `'deck'`, `.deck-hit`. Di `Launchpad` hapus `padLeft`. Hapus CSS `.stage-window.is-deck`, `.deck-hit*`, `.deck-label` dan perbarui komentar hero (strip kiri tak ada lagi).
- [ ] **Step 4: Verifikasi** — `npx vitest run` PASS; `npm run build` exit 0; `npm run lint` 0 warning; `grep -rn "deck\|STRIP\|stripLeft\|padLeft" src` → tidak ada hasil.

### Task 4: Komponen `TaskBar` (tampilan, halaman, gestur)

**Files:**
- Create: `src/components/os/TaskBar.tsx`, `src/styles/taskbar.css` (diimpor di `main.tsx`)
- Modify: `src/hooks/useWindowManager.ts` (registry slot tab), `src/App.tsx` (render `TaskBar`)
- Test: `/home/claude/tb.py` (Playwright)

**Interfaces:**
- Consumes: `tabIds`, `TABS_PER_PAGE`, `pageCount`, `pageOf`, `clampPage`, `nextPageFromSwipe`.
- Produces:
  - `useWindowManager` → `registerTabElement(id: AppId, el: HTMLElement | null)`, `getTabRect(id: AppId): RectSnapshot | null` (rect mentah `getBoundingClientRect`, radius dari CSS).
  - `<TaskBar tabs: AppId[] activeId: AppId | null minimized: Set<AppId> row: 0|1 page: number onRow(r) onPage(p) onTab(id, rect) onLaunch(id, rect) registerTab reduced />` — `row` dan `page` dikendalikan App (`useState`), supaya App bisa memaksa halaman sebelum morph.
  - Markup: `<nav class="taskbar" data-row data-page aria-label="Aplikasi berjalan">`, slot `button.tb-tab[data-app]` dengan `aria-current="true"` untuk aktif dan `data-min` untuk diperkecil; baris 2 `button.tb-launch[data-app]` dengan `.tb-dot` bila berjalan; titik halaman `.tb-pages > i`; petunjuk baris `.tb-hint`.
  - Bar tampil di baris 2 bila `tabs.length === 0`.

- [ ] **Step 1: Tulis skrip Playwright gagal** `tb.py` (dev server, viewport 1440×900 dan 390×844 touch): buka 5 app lewat kartu → `.tb-tab` terlihat = 4, `.tb-pages i` = 2; drag horizontal −200 px pada bar → `data-page="1"`, `.tb-tab` terlihat = 1; `wheel deltaY 100` → `data-row="1"`, `.tb-launch` = 5 dengan 5 `.tb-dot`; `wheel deltaY -100` → `data-row="0"`; di 390 px swipe vertikal di bar tidak mengubah state jendela (activeId tetap, cek `.stage-window.is-active` masih ada); `.taskbar` bottom ≤ viewport − safe area dan tidak tumpang tindih `.stage-window.is-active` (rect).
- [ ] **Step 2: Jalankan** `python3 /home/claude/tb.py` → FAIL (`.taskbar` tidak ada).
- [ ] **Step 3: Implementasi** `TaskBar` + CSS (pil melayang `surface-container`, tanpa backdrop-filter; ikon `AppTile` 44 px; baris di dalam viewport setinggi 64 px yang ditranslasi `-64*row` dengan pegas; halaman ditranslasi horizontal). Gestur: pointer events + axis-lock 10 px + `setPointerCapture`, `stopPropagation`; `wheel` (`deltaY` baris, `deltaX`/shift halaman, dengan debounce 250 ms); keyboard: panah kiri/kanan antar tab, atas/bawah ganti baris. Hover/long-press menampilkan label nama app (`.tb-label`). Tambah `registerTabElement`/`getTabRect` di hook. App: `const [row, setRow]`, `const [page, setPage]`, efek yang menjepit `page` dengan `clampPage` saat jumlah tab berubah (Review Focus 2).
- [ ] **Step 4: Jalankan** `tb.py` → PASS; `npm run build`, `npm run lint` bersih.

### Task 5: Perilaku tab, minimize ke tab, peluncuran dari baris 2

**Files:**
- Modify: `src/App.tsx`, `src/components/os/StageWindow.tsx` (label tombol minimize "Perkecil ke bar (Esc)"), `src/hooks/useWindowManager.ts` (komentar `minimized`)
- Test: `/home/claude/tb2.py`

**Interfaces:**
- Consumes: `getTabRect`, `TaskBar` props, `pageOf`.
- Produces di App: `tabFlight(id): FlightInput` = `{ from: snap(effectiveRect(id)), to: getTabRect(id) ?? centerFallback(), fade: !rect }`; `ensureTabVisible(id): Promise<void>` = set `row=0` dan `page=pageOf(index)`, lalu tunggu 2 rAF sebelum membaca rect.

- [ ] **Step 1: Skrip gagal** `tb2.py`: buka Lemma → klik `.tb-tab[data-app=lemma]` (aktif) → jendela tidak aktif, tab masih ada dengan `data-min`; selama morph, rect proxy `.flight-shell` di akhir berada di dalam rect tab (toleransi 4 px); klik tab lagi → jendela aktif; tekan Esc → hasil sama dengan minimize; buka 5 app, pindah ke halaman 2, Esc pada app di halaman 1 → `data-page="0"` sebelum proxy mendarat (Review Focus 3); dari baris 2 klik app belum berjalan → jendela aktif dan bar kembali `data-row="0"`; tombol close → proxy mendarat di kartu `.app-card-face` (bukan tab) dan tab hilang.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi** — `collapse` memakai `ensureTabVisible` lalu `tabFlight`; `focusCard` setelah minimize diganti fokus ke tab (`.tb-tab[data-app]`); `onTab(id)`: aktif → `collapse()`, lainnya → `wm.launch(id, flight dari tab)` bila diperkecil, `wm.focus(id)` bila tidak; `onLaunch(id, rect)` dari baris 2 → `launch(id, rect)` + `setRow(0)`. Swipe bawah di ponsel tetap memanggil `wm.minimize` (yang kini ke tab).
- [ ] **Step 4: Jalankan** `tb2.py` → PASS; `tb.py` tetap PASS; build/lint bersih.

### Task 6: Ikon terbang dari tile ke tab

**Files:**
- Create: `src/components/stage/IconFlight.tsx`
- Modify: `src/App.tsx`, `src/components/os/TaskBar.tsx` (slot tumbuh), `src/styles/taskbar.css`
- Test: `/home/claude/tb3.py`

**Interfaces:**
- Consumes: `getTileRect`, `getTabRect`, `WINDOW_MORPH`, `ensureTabVisible`.
- Produces: `<IconFlight flight={{ key: number; id: AppId; from: RectSnapshot; to: RectSnapshot } | null} onDone={(key) => void} />` — portal `div.icon-flight` (z-index di atas jendela dan setara bar, karena ikon mendarat di bar), `AppTile` yang bergerak dari pusat `from` (ukuran ikon tile 68 px) ke `to` (44 px) dengan lintasan lengkung: `x` pegas linier, `y` pegas dengan offset busur `-min(120, jarak*0.25)` di tengah (dua keyframe), `scale 68/44 → 1`. App menyimpan `iconFlight` di `useState`; slot tab baru diberi `data-arriving` (ikon tak terlihat, lebar tumbuh dari 0 via `motion` `layout`) sampai `onDone`, lalu ikon slot tampil dan titik aktif menyala.
- Peluncuran dari baris 2: tidak ada `IconFlight`; ikon `.tb-launch` memantul `scale 1 → 1.15 → 1` (200 ms) dan morph jendela berangkat dari rect ikon itu.
- Reduced motion: tidak ada `IconFlight`; slot muncul dengan `opacity 0→1` 120 ms.

- [ ] **Step 1: Skrip gagal** `tb3.py`: klik kartu Lemma → dalam 60 ms ada `.icon-flight` yang rect-nya dekat tile (≤ 8 px); setelah ~450 ms `.icon-flight` hilang dan rect `.tb-tab[data-app=lemma] .app-tile` sama dengan rect terakhir ikon terbang (≤ 4 px); di tengah perjalanan (~190 ms) `y` ikon lebih kecil dari garis lurus tile→tab (busur ke atas); buka 4 app lalu buka app ke-5 dari halaman 1 → `data-page="1"` sebelum `.icon-flight` mendarat (Review Focus 1); dengan `reduced_motion='reduce'` → tidak pernah ada `.icon-flight`.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi** sesuai Interfaces; `launch()` memanggil `ensureTabVisible(id)` lalu membaca `getTabRect(id)` (slot sudah ada dalam DOM dengan `data-arriving`) untuk `to`.
- [ ] **Step 4: Jalankan** `tb3.py`, `tb2.py`, `tb.py` → PASS; `npx vitest run` PASS; build/lint bersih.

### Task 7: Verifikasi akhir dan README

**Files:**
- Modify: `README.md` (ganti bagian Side Stage Strip dengan Multitask Bar)
- Test: semua skrip + ukur fps (`perf3.py` disesuaikan: buka app via kartu, ukur selama morph + ikon terbang)

- [ ] **Step 1:** Perbarui README.
- [ ] **Step 2:** `npx vitest run`, `npm run build`, `npm run lint`, `tb.py`, `tb2.py`, `tb3.py` → semua lulus; fps morph tanpa throttle ≥ 55.
- [ ] **Step 3:** Tangkapan layar 1440×900, 820×1180, 390×844 (bar baris 1, halaman 2, baris 2) untuk diperiksa dan dikirim ke pengguna.
- [ ] **Step 4:** Tanyakan ke pengguna soal commit/push (aturan tetap).
