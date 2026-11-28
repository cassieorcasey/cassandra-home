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
