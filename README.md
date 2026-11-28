# cassandra.suite

Landing page bergaya OS untuk ekosistem web app Cassandra: Lemma, Synthesis, Conway, Subset, dan Wishy. Setiap aplikasi dibuka sebagai jendela di dalam halaman, tumbuh langsung dari kartunya di Launchpad dan pulang ke sana saat ditutup (Tile-to-Window Morph).

Live: https://cassieorcasey.github.io/cassandra-home/

## Fitur

- **Launchpad**: sapaan berganti bahasa, judul cassandra.suite dengan garis ombak yang tergambar sekali saat dimuat, dan kartu SPACES. Titik hijau di kartu menandai aplikasi yang sesinya masih hidup.
- **Tile-to-Window Morph**: jendela tumbuh dari kartu SPACES (atau baris Spotlight) dan menyusut kembali ke kartunya saat ditutup. Bisa dibatalkan di tengah jalan tanpa melompat.
- **Split Screens**: beberapa aplikasi tampil berdampingan dalam grid otomatis: sampai 4 per layar di desktop/tablet (1 penuh, 2 berdampingan, 3 = satu besar + dua bertumpuk, 4 = 2×2) dan 2 bertumpuk atas-bawah di ponsel. Aplikasi berikutnya membuka layar baru di sebelah kanan, dan tepi layar tetangga selalu mengintip di samping. Arahkan kursor ke tepi layar untuk langsung pindah (tanpa klik), seret header jendela ke samping, geser dua jari di trackpad, ketuk panah di ponsel, lewat bar, atau `Ctrl + ←/→`. Klik jendela (atau di dalam aplikasinya) untuk memfokusnya; tombol ⤢ membuat jendela itu memenuhi layar sementara.
- **Multitask Bar**: pil di bawah layar berisi tab aplikasi yang sedang berjalan, seperti tab browser. Satu halaman bar = satu layar; geser ke kiri/kanan (atau shift + roda) untuk halaman berikutnya. Gulir ke bawah (tarik ke atas di layar sentuh) untuk baris kedua berisi semua aplikasi. Saat aplikasi dibuka dari kartu, ikonnya terbang ke tab barunya bersamaan dengan jendela yang tumbuh. Klik tab untuk berpindah; klik tab yang aktif untuk mengecilkannya. Iframe tidak pernah dimuat ulang saat berpindah.
- **Ponsel**: swipe header ke bawah untuk mengecilkan jendela itu ke tab, ke samping untuk pindah layar (kedua jendela ikut bergeser).
- **Spotlight** (`⌘/Ctrl + K`): cari aplikasi berdasarkan nama atau fungsi.
- `Esc` (atau tombol −) mengecilkan jendela yang difokus ke tab-nya tanpa menutup sesi; tombol × menutup sesi dan jendela pulang ke kartunya.
- Dukungan reduced motion (morph diganti crossfade 120 ms), reduced transparency, increased contrast, dan forced colors.

## Stack

React 19, TypeScript, Vite, `motion`. Deploy otomatis ke GitHub Pages lewat GitHub Actions setiap push ke `main`.

## Menambah aplikasi

Daftarkan di `src/config/apps.config.ts` dan taruh ikon tanpa latar di `public/icons/<id>-mark.webp`. Aplikasi di `cassieorcasey.github.io/<repo>/` berbagi origin dengan halaman ini, jadi sesi login dan pintasan keyboard (`Esc`, `⌘/Ctrl + K`) bekerja di dalam iframe. Bila aplikasi sendiri memakai `Esc` (mis. menutup dialog) dan memanggil `preventDefault()`, jendelanya tidak ikut dikecilkan.

## Menjalankan lokal

```bash
npm install
npm run dev
npm test        # uji logika (Vitest)
```
