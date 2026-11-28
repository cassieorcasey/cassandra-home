# Split Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven
> development (recommended) or inline execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beberapa app tampil berdampingan dalam grid (4 per layar di desktop/tablet, 2 bertumpuk di HP); layar = halaman Multitask Bar, geser untuk pindah layar.

**Architecture:** Kapasitas layar K jadi parameter seluruh logika halaman bar (`src/lib/taskbar.ts`), sehingga halaman bar = layar. Modul murni baru `src/lib/screens.ts` menghitung sel grid. App menurunkan placement setiap jendela dari (urutan tab, diperkecil, layar aktif, K); StageWindow kehilangan drag/resize dan mendapat posisi "di luar layar" untuk animasi geser layar. Fokus jendela lewat klik header/bingkai atau deteksi iframe yang menerima fokus (`window` blur + `document.activeElement`).

**Tech Stack:** React 19, TypeScript, motion, Vitest, Playwright (Python).

**Spec:** `docs/superpowers/specs/2026-11-28-split-screens-design.md`

## Global Constraints

- K = 4 bila lebar > 767 px, K = 2 bila ≤ 767 px (`MOBILE_MAX`).
- Jarak antar-sel grid: 12 px (desktop/tablet), 8 px (HP).
- 3 app: A penuh di sisi pertama, B dan C bertumpuk di sisi kedua.
- Stage lebih tinggi daripada lebar → pembagian pertama atas-bawah.
- Drag dan resize jendela dihapus: `Win.rect`, `setRect`, `clampWindowRect`, `ResizeEdge`, `MIN_WIN_*`, pegangan `.rz-*`.
- Pindah layar: geser/roda di bar, `Ctrl + ←/→`, swipe header ke samping di HP; pegas sama dengan halaman bar.
- Commit diatur pengguna; build, lint (oxlint 0), Vitest, dan semua skrip `tb*.py` harus lulus.

## Review Focus

1. Close app di layar 1 saat ada layar 2: app pertama layar 2 naik ke layar 1, dan layar aktif dijepit bila layar terakhir jadi kosong.
2. Semua app di layar aktif diperkecil: Home tampil, bar tetap di halaman itu, Esc tidak melakukan apa-apa.
3. Klik di dalam iframe jendela yang tidak difokus memindahkan fokus (Esc lalu memperkecil jendela itu, bukan yang lain).
4. Membuka app saat layar aktif bukan layar terakhir: layar pindah ke layar app baru sebelum morph mendarat di selnya.
5. Rotasi/resize jendela browser melewati 767 px: K berubah, halaman dijepit ulang, grid dihitung ulang tanpa jendela tertinggal di luar layar.

---

### Task 1: Halaman bar berkapasitas K

**Files:** Modify `src/lib/taskbar.ts`, `src/lib/taskbar.test.ts`, pemanggil di `TaskBar.tsx`, `App.tsx`.

**Interfaces — Produces:** `pageCount(n, k = 4)`, `pageOf(i, k = 4)`, `clampPage(p, n, k = 4)`, `nextPageFromSwipe(page, n, dx, width, v, k = 4)`, `pageSlots(n, page, k = 4)`, `tabSlotRect(vp, n, index, page, k = 4)`, `screenCapacity(mobile: boolean): 2 | 4`. `TaskBar` menerima prop `perPage: number`; lebar halaman track = `perPage * TB_SLOT`.

- [ ] Tes gagal: `pageCount(3, 2) = 2`, `pageOf(2, 2) = 1`, `pageSlots(3, 1, 2) = 1`, `tabSlotRect(phoneVp, 3, 2, 1, 2).left = 195 - (20 + 44 + 15)/2 + 10`, `screenCapacity(true) = 2`.
- [ ] Jalankan → FAIL. Implementasi. Jalankan → PASS (tes lama tetap lulus).

### Task 2: Grid sel (`src/lib/screens.ts`)

**Interfaces — Produces:** `gridCells(stage: Rect, count: number, gap: number): Rect[]`; `screenLayout(tabs: AppId[], minimized: Set<AppId>, screen: number, k: number, stage: Rect, gap: number): Map<AppId, Rect>` (hanya app tidak diperkecil di layar itu, urut tab).

- [ ] Tes gagal untuk stage `{x:24,y:12,w:1392,h:788}`, gap 12: count 1 = stage; count 2 = `[{x:24,w:690},{x:726,w:690}]` tinggi penuh; count 3 = A kiri penuh, B/C kanan tinggi 388; count 4 = 2×2 `w 690 h 388`. Stage portrait `{x:0,y:0,w:400,h:800}` count 2 = atas-bawah `h 396`. `screenLayout` melewati app yang diperkecil dan app di layar lain.
- [ ] FAIL → implementasi → PASS.

### Task 3: Reducer tanpa rect, fokus setelah minimize

**Files:** `src/hooks/useWindowManager.ts`, tesnya.

**Interfaces — Produces:** hapus `rect`, `setRect`; `minimize(flight, next: AppId | null)` → `activeId = next`; `focus(id)` tidak mengubah status jendela lain.

- [ ] Tes gagal: minimize dengan `next = 'lemma'` → `activeId 'lemma'`, `conway` diperkecil; `focus` pada jendela tidak diperkecil tidak mengubah `minimized` jendela lain.
- [ ] FAIL → implementasi → PASS.

### Task 4: Grid di layar, pindah layar, hapus drag/resize

**Files:** `src/App.tsx`, `src/components/os/StageWindow.tsx`, `src/hooks/useViewport.ts`, `src/styles/globals.css`, `TaskBar.tsx`. Test: `/home/claude/tb6.py`.

**Interfaces:** `Placement = 'stage' | 'offscreen' | 'hidden'`; `target` untuk `offscreen` = sel di layarnya digeser `±(vp.w)` × selisih layar. State App `screen` menggantikan `barPage` (bar `page = screen`). StageWindow: kelas `is-focused` untuk `activeId`; `onPointerDown` di bingkai → `wm.focus(id)`; App memasang listener `window blur` → cari `.stage-window` yang memuat `document.activeElement` (iframe) → `focus`. Swipe header HP ke samping → `wm.switchScreen(±1)`; ke bawah → `wm.minimizeId(win.id)`. `Ctrl + ←/→` → pindah layar.

- [ ] Skrip gagal `tb6.py`: desktop 1440 — buka 4 app → 4 `.stage-window` tampil, rect tidak saling tumpang dan cocok dengan `gridCells` (±2 px); buka ke-5 → `data-page=1`, 1 jendela tampil penuh; drag bar kanan → 4 jendela tampil; klik header jendela B → B `is-focused`; Esc → B diperkecil, 3 jendela mengisi ulang; close A → app ke-5 naik ke layar 1 (4 tampil, `data-page=0`, titik halaman hilang); `Ctrl+→` tanpa layar 2 → tetap. Klik di dalam iframe jendela lain (`frame.focus()` lewat evaluate) → fokus pindah. HP 390 — buka 3 app → 2 jendela atas-bawah di layar 2? (app ke-3 di layar 2, `data-page=1`), swipe header kiri-kanan → layar 0 dengan 2 jendela bertumpuk; swipe header bawah → jendela itu diperkecil. Resize 1440 → 700 → K = 2, halaman dijepit, tidak ada jendela tampil di luar viewport.
- [ ] FAIL → implementasi → PASS; perbarui `tb.py`–`tb5.py` yang mengandaikan satu jendela, catat setiap perubahan tes sebagai Ruling.

### Task 5: Verifikasi akhir

- [ ] Vitest, build, lint, `tb.py`–`tb6.py`; fps buka/pindah layar median ≤ 17 ms; README (bagian Multitask Bar dan Jendela desktop); tangkapan layar 1440, 820, 390.
- [ ] Review akhir oleh reviewer baru; satu putaran perbaikan; tanyakan commit ke pengguna.
