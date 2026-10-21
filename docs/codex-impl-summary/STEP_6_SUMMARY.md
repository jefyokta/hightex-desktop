# Langkah 6 — Export PDF Snapshot

Tanggal: 21 Oktober 2026. Status: **siap review**, dikerjakan bersama langkah 7–8 atas persetujuan pengguna. Perubahan belum di-commit.

## Perubahan

Viewer submission dan file `.hightex` lokal sekarang mempunyai tombol **Export PDF**. Export membuka dialog penyimpanan, menggunakan folder dan timeout export yang sudah dikonfigurasi, lalu merender byte snapshot dalam jendela cetak terpisah dengan database memori. Jendela dan handler IPC dibersihkan setelah selesai, gagal atau timeout. Klik ganda dikunci selama export.

Halaman cetak memakai `SubmissionPrint`, `FullDocument`, `PrintStyles` dan utilitas `createElementFromUrl` yang sudah ada. Compiler, resolver, preview editor dan pengaturan zoom tidak diubah. Ukuran tinggi CV disesuaikan **hanya saat export PDF** agar padding dari CV lama tidak menghasilkan halaman kosong tambahan; isi CV tetap dapat mengalir jika panjang.

Metadata PDF mengambil judul, penulis dan keyword dari snapshot. Subject mencatat hash SHA-256, ID dokumen, kelengkapan profil serta ID submission/dokumen server bila tersedia. Snapshot tanpa nama penulis menghasilkan metadata author kosong dan penanda data tidak lengkap; akun pembaca tidak dipakai sebagai penulis.

Untuk sumber submission, service memeriksa sesi dan mengunduh ulang file untuk memeriksa akses serta hash sebelum merender. Sesi diperiksa kembali sebelum hasil disimpan. Sumber file lokal dapat diekspor tanpa login/koneksi server, menggunakan kategori lokal yang sesuai. Akses IPC inisialisasi/hasil terikat pada jendela, frame dan request export masing-masing. Export tidak menulis draft atau binding cloud.

## Breaking Changes dan Migrasi

Tidak ada perubahan format `.hightex`, skema draft atau kontrak API server. Restart aplikasi/dev process diperlukan karena main/preload mempunyai IPC PDF baru; renderer dan preload harus berasal dari versi yang sama.

Export langsung dari submission membutuhkan akses server yang masih valid. Untuk penggunaan offline, buka salinan `.hightex` lokal. Pengaturan timeout/folder export lama tetap dipakai. Tidak ada dependensi baru.

## Validasi

- Uji PDF native Electron dengan build produksi menghasilkan PDF TA, proposal dan KP untuk dua penulis dengan ID lokal sama; metadata, hash, isi penulis, jumlah halaman, dan pembersihan jendela diperiksa. Jumlah halaman mencakup sheet CV di luar Paged.js; halaman kosong tambahan sudah dihilangkan.
- Snapshot legacy tanpa profil tetap mempunyai author kosong. Sumber submission advisor tetap menghasilkan author mahasiswa; akses ditolak, hash berbeda dan sesi berubah menghentikan export. Pembatalan dialog tidak membuat PDF.
- Uji regresi `preview-equivalence.cjs`: TA, proposal dan KP tetap **identik per piksel** dengan preview lama. Draft tidak berubah dan penulis snapshot kedua tetap terisolasi.
- Unit suite gabungan langkah 6–8: **154 lolos, 0 gagal**, 22 file, 638 assertion. Typecheck, lint kode fitur terkait dan build renderer/main/preload lolos. Warning chunk besar dan beberapa warning tooling/UI lama tetap ada.
- Script PDF: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/snapshot-pdf.cjs` setelah `vite build`. Script preview: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/preview-equivalence.cjs`.

## Cara Review

1. Restart aplikasi/dev process, buka snapshot lewat **Submissions → Baca snapshot** atau buka file `.hightex` lokal.
2. Tunggu preview selesai lalu pilih **Export PDF**. Periksa cover, bab, CV, foto dan metadata judul/author pada pembaca PDF.
3. Buka snapshot penulis berbeda dengan ID lokal yang sama dan export lagi. Periksa bahwa identitas/isi masing-masing tetap benar dan draft tidak berubah.
4. Buka file tanpa profil: penanda data tidak lengkap harus tetap terlihat dan author PDF tidak menjadi akun reviewer. Batalkan dialog export untuk memastikan tidak ada file baru.

PDF native diuji pada macOS di lingkungan ini. Pemeriksaan installer/hasil cetak Windows dan Linux masih termasuk penerimaan lintas platform pada langkah 10.
