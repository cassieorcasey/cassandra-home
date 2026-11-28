# Split Screens — Design

Tanggal: 2026-11-28 · Status: draf, menunggu persetujuan
Melanjutkan: `2026-11-28-multitask-bar-design.md` (Multitask Bar tetap; ini mengubah isi layar)

## Maksud

Multitasking sungguhan: beberapa web app tampil berdampingan di layar tengah.
Satu layar memuat sampai 4 app; app ke-5 dan seterusnya masuk layar berikutnya,
dan pengguna menggeser ke kanan untuk pindah layar. Bar bawah tetap jalan
untuk membuka app lain dan berpindah.

## Keputusan pengguna

- Grid otomatis 1–4 app per layar (desktop dan tablet); layar baru setiap 4 app.
- Di HP: dua app per layar, bertumpuk atas-bawah; app ke-3 masuk layar berikutnya.
- Drag dan resize bebas per jendela dihapus (digantikan grid).

## Perilaku

**Layar = halaman bar.** App berjalan diurutkan menurut waktu dibuka (sama dengan
tab sekarang). Kapasitas layar K = 4 di desktop/tablet, 2 di HP. Layar ke-s
berisi tab ke-Ks sampai Ks+K−1, persis halaman ke-s di bar.
Jadi geser bar ke kanan = pindah ke layar berikutnya, dan titik halaman = layar.

**Grid** di area stage (lebar penuh, di atas bar), jarak antar-jendela 12 px,
hanya untuk app yang tidak diperkecil di layar itu:

```
1        2            3              4
┌────┐   ┌──┬──┐      ┌──┬──┐        ┌──┬──┐
│ A  │   │A │B │      │A │B │        │A │B │
│    │   │  │  │      │  ├──┤        ├──┼──┤
└────┘   └──┴──┘      └──┴C─┘        │C │D │
                                     └──┴──┘
```

Bila stage lebih tinggi daripada lebarnya (tablet portrait), pembagian pertama
bertumpuk atas-bawah, bukan kiri-kanan.

**Fokus.** Satu jendela di layar aktif adalah yang difokus (`activeId`):
header-nya ditandai, menerima Esc, dan tab-nya bergaris aktif di bar. Klik
di jendela mana pun memfokusnya.

**Membuka app.** Tab baru di ujung urutan; layar ikut pindah ke layar app itu.
Jendela morph dari kartu ke sel grid-nya, sementara jendela lain di layar itu
beranimasi ke sel barunya. Ikon tetap terbang ke tab (seperti sekarang).

**Minimize / Esc.** Jendela yang difokus morph ke tab-nya (tetap di bar, redup);
jendela lain di layar itu mengisi ulang ruangnya. Klik tab itu lagi: kembali
ke sel yang sama dalam urutan.

**Close.** Morph ke kartu Home (seperti sekarang); tab hilang, dan urutan
bergeser, sehingga app dari layar berikutnya bisa naik ke layar ini (beranimasi).

**Pindah layar.** Geser bar, roda/shift+roda di bar, atau `Ctrl + ←/→`.
Seluruh jendela layar lama bergeser keluar ke samping dan jendela layar baru
masuk dari sisi seberang (pegas yang sama dengan halaman bar). Bila semua app
di layar itu diperkecil, layar menampilkan Home.

**Tombol perbesar (⤢).** Jendela yang difokus sementara memenuhi seluruh stage
di atas jendela lain di layarnya; klik lagi untuk kembali ke grid.

**HP (lebar ≤ 767 px).** Dua app per layar: 1 app = penuh, 2 app = atas-bawah
(jarak 8 px). Bar di HP memuat 2 tab per halaman, supaya halaman bar tetap
sama dengan layar. Swipe header ke samping = pindah layar; swipe header ke
bawah = perkecil jendela itu ke tab-nya. Tombol ⤢ juga ada di HP (satu jendela
memenuhi layar sementara).

## Keputusan yang saya ambil (bisa dikoreksi)

- Pembagian untuk 3 app: A setinggi penuh di kiri, B dan C bertumpuk di kanan.
- Jendela yang diperkecil tetap "memegang" tempatnya di urutan layar, jadi
  memulihkannya mengembalikan ke layar yang sama.
- Batas grid berlaku mulai lebar > 767 px (batas HP yang sudah ada).
- Tidak ada drag untuk menukar posisi jendela di grid (bisa ditambah nanti).

## Bukan tujuan

- Mengatur ulang posisi jendela dengan drag, ukuran sel berbeda-beda, lebih dari 4 per layar.
