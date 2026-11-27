# cassandra.suite

Landing page bergaya OS untuk ekosistem web app Cassandra: Lemma, Synthesis, Conway, Subset, dan Wishy. Setiap aplikasi dibuka sebagai jendela di dalam halaman, tumbuh langsung dari kartunya di Launchpad dan pulang ke sana saat ditutup (Tile-to-Window Morph).

Live: https://cassieorcasey.github.io/cassandra-home/

## Fitur

- **Launchpad**: sapaan berganti bahasa, judul cassandra.suite dengan garis ombak yang tergambar sekali saat dimuat, dan kartu SPACES. Titik hijau di kartu menandai aplikasi yang sesinya masih hidup.
- **Tile-to-Window Morph**: jendela tumbuh dari kartu SPACES (atau baris Spotlight) dan menyusut kembali ke kartunya saat ditutup atau dikecilkan. Bisa dibatalkan di tengah jalan tanpa melompat.
- **Center Stage + Side Stage Strip** (desktop): jendela lain mengecil ke strip kiri; klik kartunya untuk menukar fokus. Iframe tidak pernah dimuat ulang saat berpindah.
- **Jendela desktop**: geser lewat header, ubah ukuran lewat tepi kiri/kanan/bawah dan busur sudut bawah, perluas ke layar penuh.
- **Ponsel**: jendela penuh layar; swipe header ke bawah untuk kembali ke Launchpad, ke samping untuk pindah aplikasi.
- **Spotlight** (`⌘/Ctrl + K`): cari aplikasi berdasarkan nama atau fungsi.
- `Esc` (atau tombol −) mengembalikan jendela ke Launchpad tanpa menutup sesinya; tombol × menutup sesi.
- Dukungan reduced motion (morph diganti crossfade 120 ms), reduced transparency, increased contrast, dan forced colors.

## Stack

React 19, TypeScript, Vite, `motion`. Deploy otomatis ke GitHub Pages lewat GitHub Actions setiap push ke `main`.

## Menambah aplikasi

Daftarkan di `src/config/apps.config.ts` dan taruh ikon tanpa latar di `public/icons/<id>-mark.webp`. Aplikasi di `cassieorcasey.github.io/<repo>/` berbagi origin dengan halaman ini, jadi sesi login dan pintasan keyboard (`Esc`, `⌘/Ctrl + K`) bekerja di dalam iframe. Bila aplikasi sendiri memakai `Esc` (mis. menutup dialog) dan memanggil `preventDefault()`, jendelanya tidak ikut dikecilkan.

## Menjalankan lokal

```bash
npm install
npm run dev
```
