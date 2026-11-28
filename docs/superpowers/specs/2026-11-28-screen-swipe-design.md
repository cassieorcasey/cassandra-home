# Screen Swipe — Design

Tanggal: 2026-11-28 · Status: disetujui (opsi A)

## Maksud
App ke-5 dan seterusnya terasa "ada di sebelah kanan layar". Pindah layar cukup
dengan menggeser layar memakai kursor, tanpa scroll di bar.

## Perilaku
- **Seret header** jendela mana pun (bagian kosong, bukan tombol) ke kiri/kanan:
  seluruh layar (semua jendela yang tampil) mengikuti kursor, layar berikutnya
  masuk dari sisi seberang. Lepas lewat ambang (30 % lebar, atau sentakan) → pindah;
  kurang → kembali. Di ujung (tidak ada layar lagi) ada tahanan karet.
  Kursor `grab` di header bila ada lebih dari satu layar.
- **HP:** swipe header ke samping memakai gerak yang sama (kedua jendela yang
  bertumpuk ikut bergeser); swipe bawah tetap memperkecil.
- **Trackpad:** geser dua jari ke samping di atas area halaman (header, celah antar-
  jendela, tepi) pindah layar. Di dalam iframe, geseran milik app itu.
- **Penanda tepi** (desktop/tablet): pil kecil di tepi kanan berisi ikon app layar
  berikutnya + panah; di tepi kiri untuk layar sebelumnya. Klik = pindah layar.
- Bar, `Ctrl + ←/→` tetap berfungsi.

## Keputusan saya
- Ambang dan pegas sama dengan halaman bar (30 % / flick 500 px/s).
- Penanda tepi tidak ditampilkan di HP (layar sempit; titik halaman di bar sudah ada).

## Revisi (permintaan pengguna): meniru cutefish.my.id
Diamati dari `core/window-manager.js` dan `styles/window-manager.css` situs itu. Pengguna memilih
dua bagian: layar tetangga mengintip dan sensor tepi tanpa jeda.
- **Mengintip:** saat ada lebih dari satu layar, layar-layar dirantai ke kanan dan menyempit;
  tepi layar tetangga terlihat 54 px (24 px di ponsel). Rantai bergeser `lebar − 2·intip − jarak`
  per layar. Klik jendela yang mengintip = pindah ke layarnya.
- **Sensor tepi (desktop):** area tak terlihat 72 px di kiri/kanan; kursor masuk = pindah layar
  seketika, tanpa klik dan tanpa jeda. Sensor diam 450 ms setelah layar berpindah atau seretan
  header dilepas (browser mengirim pointerenter ke sensor yang muncul di bawah kursor yang diam).
- **Ponsel:** tombol panah melayang di kiri/kanan.
- Pil ikon di tepi dan "tepi panas" berjeda dihapus. Animasi buka dan susunan grid kita tetap.
