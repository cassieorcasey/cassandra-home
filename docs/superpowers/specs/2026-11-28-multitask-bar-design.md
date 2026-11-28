# Multitask Bar — Design

Tanggal: 2026-11-28 · Status: draf, menunggu persetujuan

## Maksud

Berpindah dan membuka banyak web app tanpa harus kembali ke Launchpad. Sebuah
bottom bar simpel bekerja seperti deretan tab browser: setiap app yang sedang
berjalan punya tab, dan tab itu tetap ada walau jendelanya diperkecil.
Referensi (cutefish.my.id, 8 snapshot) memberi bentuknya: pil melayang di
tengah bawah, ikon besar, label saat hover. Paging dan baris kedua adalah ide
pengguna, tidak ada di referensi.

## Tujuan

- Tab = app yang berjalan (jendela terbuka atau diperkecil), urut sesuai waktu dibuka.
- Satu halaman bar memuat 4 tab. Tab ke-5 dan seterusnya ada di halaman
  berikutnya; geser ke kanan/kiri untuk berpindah halaman, dengan titik
  indikator halaman.
- Gulir ke bawah pada bar menampilkan baris kedua berisi kelima app untuk
  diluncurkan. Gulir ke atas kembali ke baris tab.
- Klik tab: jendela app itu tampil di depan (dari diperkecil maupun dari latar).
  Klik tab yang sedang aktif: jendelanya diperkecil.
- Minimize hanya menyembunyikan jendela; tab-nya tetap di bar dan sesi
  iframe tetap hidup.

## Bukan tujuan

- Membuka satu app lebih dari sekali (satu app = satu tab; dua iframe dengan
  sesi yang sama berisiko bentrok).
- Menyusun ulang tab dengan drag.
- Mengubah isi Launchpad, Spotlight, atau gestur drag/resize jendela.

## Anti-tujuan

- Bar yang menutupi kontrol jendela atau isi iframe secara permanen.
- Gestur bar yang memicu gestur swipe jendela (atau sebaliknya).
- Merusak Tile-to-Window Morph yang sudah ada.

## Pendekatan

Tiga cara dipertimbangkan:

- **A. Dua lapis**: bar tab mungil, tarik ke atas memunculkan panel app.
  Panel lebih lega, tapi menambah overlay dan bentrok dengan tarik-atas di jendela.
- **B. Satu bar, dua baris (dipilih)**: bar setinggi satu baris dengan snap
  vertikal; baris 1 tab berjalan (paging horizontal 4 per halaman), baris 2
  peluncur 5 app. Paling dekat dengan konsep pengguna, tanpa overlay baru.
- **C. Tab + tombol "+"**: paling sederhana, tapi tanpa gestur gulir.

Pengguna memilih **B**. Jika di uji layar HP terasa sempit, jalan mundurnya A.

## Perilaku

**Bentuk.** Pil melayang di tengah bawah, di atas safe-area. Tinggi baris
~64 px, ikon `AppTile` 44 px, jarak antar-ikon 14 px. Lebar mengikuti isi
(maks. 4 ikon + padding). Di kanan bar: titik halaman bila tab > 4.
Tab aktif diberi garis/titik penanda di bawah ikon; tab diperkecil tampil
dengan ikon sedikit redup. Label nama app muncul saat hover (desktop) atau
long-press (sentuh).

**Baris 2 (peluncur).** Kelima app dalam satu baris; app yang sudah berjalan
diberi titik. Klik app yang belum berjalan meluncurkannya dengan morph dari
ikon di bar; klik app yang sudah berjalan sama dengan klik tab-nya. Setelah
meluncurkan, bar kembali ke baris 1. Petunjuk kecil (garis/chevron) di tepi
bar menandakan ada baris kedua.

**Gestur.** Axis-lock 10 px seperti swipe jendela. Horizontal di baris 1 =
ganti halaman (snap, ambang 30% lebar atau flick). Vertikal = ganti baris.
Roda mouse: deltaY ganti baris, deltaX/shift+roda ganti halaman. Keyboard:
fokus pada bar, panah kiri/kanan pindah tab, atas/bawah ganti baris.
Pointer di bar tidak diteruskan ke jendela di bawahnya.

**Kapan tampil.** Bar selalu tampil saat ada minimal satu app berjalan.
Saat tidak ada app berjalan (hanya Launchpad), bar tetap tampil di baris 2
sebagai peluncur. Stage window menyisakan ruang di bawah setinggi bar
(`stageRect` dikurangi tinggi bar + margin), sehingga bar tidak menutupi jendela.

**Morph.** Membuka dari bar: tile asal = rect ikon di bar. Minimize: jendela
morph mengecil ke ikon tab-nya di bar (bukan ke kartu Launchpad). Close:
tetap morph ke kartu Launchpad seperti sekarang, lalu tab hilang. Bila ikon
tab ada di halaman bar yang tidak terlihat, bar berpindah ke halaman itu dulu.

**Ikon mengalir ke bar (permintaan pengguna).** Saat membuka app dari
Launchpad (atau Spotlight / baris 2), ikon app di tile terbang ke slot
tab-nya di bar, bersamaan dengan morph jendela yang sudah ada. Dua gerak
berjalan paralel: (1) jendela membesar dari tile ke stage; (2) "ikon hantu"
(salinan AppTile) meluncur dari tile ke slot bar mengikuti lintasan lengkung
ringan, mendarat tepat saat jendela hampir selesai (~380 ms, pegas yang sama
dengan `WINDOW_MORPH.open`). Di bar, slot baru melebar dari lebar 0 sementara
tab lain bergeser memberi tempat, dan bar sendiri ikut melebar; begitu ikon
mendarat, ia menggantikan placeholder slot dan titik aktif menyala. Tile
asal tetap di Launchpad (sudah meredup di belakang jendela) dan hanya
mendapat titik "berjalan". Bila tab baru jatuh di halaman bar yang tidak
terlihat, bar pindah halaman lebih dulu dan ikon terbang ke posisi di sana.
Peluncuran dari baris 2 tidak punya tile Launchpad; ikon cukup tumbuh di
tempat (skala 1 → 1.15 → 1) lalu jendela morph dari ikon itu.
Saat close: jendela morph kembali ke kartu Launchpad seperti sekarang, slot
tab menyempit dan tab di sebelahnya merapat. Reduced motion: tanpa
terbang; ikon dan slot muncul dengan crossfade 120 ms.

**Esc** = minimize jendela aktif ke tab-nya (bukan ke Launchpad).

## Keputusan yang saya ambil (bisa dikoreksi)

- Tinggi/ukuran ikon dan jarak di atas.
- Klik tab aktif = minimize (perilaku taskbar umum).
- Baris 2 selalu memuat kelima app, bukan hanya yang belum berjalan.
- Ikon yang terbang adalah salinan (tile Launchpad tetap di tempatnya, bukan
  ikut pindah), dan close tidak mengembalikan ikon terbang, hanya menyempitkan slot.
- Ruang di bawah stage disisakan untuk bar agar tidak menutupi jendela.

## Keputusan pengguna

- **Side Stage Strip dihapus.** Bar menjadi satu-satunya pengalih app; jendela
  aktif tampil langsung di layar tengah dengan lebar penuh (`STRIP_*`,
  `deckSlot`, `deck` dan `stripLeft` ikut dibuang), dan perpindahan ke app
  lain lewat tab di bar (geser kanan untuk halaman berikutnya).

## Pertanyaan terbuka

Tidak ada.

## Yang diserahkan ke pembangun

Nama komponen dan file, detail pegas/durasi animasi (memakai `config/motion.ts`),
struktur reducer untuk urutan tab (`order: AppId[]` disarankan, terpisah dari
`deck`), dan cara mengukur rect ikon untuk morph (mengikuti pola
`registerTileElement`).
