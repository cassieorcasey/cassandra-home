# Cassandra Home

Landing page bergaya OS untuk ekosistem web app Cassandra: Lemma, Synthesis, Conway, Subset, dan Wishy. Setiap aplikasi dibuka sebagai jendela di dalam halaman (Stage Manager + Tab-Deck), dengan animasi pegas dari ikon ke jendela.

Live: https://cassieorcasey.github.io/cassandra-home/

## Fitur

- **Center Stage + Side Stage Strip** (desktop): jendela lain mengecil ke strip kiri, klik kartu untuk menukar fokus. Iframe tidak pernah dimuat ulang saat berpindah.
- **Unified Bottom Bar**: marka kinetik "Cassandra" + dok dengan pembesaran Gaussian; saat aplikasi terbuka marka menyusut jadi pil Home. Ikon terbang ke jendela dan kembali saat minimize. Di ponsel, geser jari di dok untuk memilih aplikasi.
- **Spotlight** (`⌘/Ctrl + K` atau tombol cari): cari aplikasi berdasarkan nama atau fungsi.
- `Esc` mengecilkan jendela ke deck, tidak pernah menutup sesi.
- Tema Sistem / Terang / Gelap, dukungan reduced motion, reduced transparency, dan increased contrast.

## Stack

React 19, TypeScript, Vite, `motion`. Deploy otomatis ke GitHub Pages lewat GitHub Actions setiap push ke `main`.

## Menambah aplikasi

Daftarkan di `src/config/apps.config.ts` dan taruh ikon 256×256 di `public/icons/`. Aplikasi di `cassieorcasey.github.io/<repo>/` berbagi origin dengan halaman ini, jadi sesi login dan pintasan keyboard bekerja di dalam iframe.

## Menjalankan lokal

```bash
npm install
npm run dev
```
