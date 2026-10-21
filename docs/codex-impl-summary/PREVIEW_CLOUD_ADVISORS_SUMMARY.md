# Perbaikan Pembimbing pada Preview Dokumen Cloud

Tanggal: 21 Oktober 2026. Status: **siap review**, belum di-commit.

## Masalah dan Perubahan

Preview penuh sebelumnya langsung membaca profil yang tersimpan di IndexedDB. Data akademik cloud disegarkan saat membuka editor/pengaturan, tetapi tidak saat membuka atau me-reload preview. Jika cache pembimbing kosong atau penugasan berubah setelah editor dibuka, lembar persetujuan masih memakai nilai lama tersebut.

Route print dokumen kerja sekarang menunggu refresh data akademik cloud sebelum memuat dokumen dan profil untuk preview. Nama/NIP pembimbing utama serta pembimbing kedua mengikuti penugasan aktif dari server. Pembimbing kedua yang sudah tidak ditugaskan dihapus dari cache, sehingga layout satu pembimbing kembali dipakai. Helper refresh menerima bridge API yang tersedia pada iframe atau parent.

Dokumen lokal tanpa binding tidak memuat data akademik server. Saat offline, preview cloud tetap memakai cache. Viewer submission dan PDF snapshot tidak mengaktifkan refresh ini; identitas dan pembimbingnya tetap mengikuti paket yang direview.

`consent.tsx`, compiler, resolver, stylesheet dan zoom tidak diubah.

## Validasi

- GUI Electron dengan source terbaru: cache pembimbing kosong terisi sebelum render; nama/NIP kedua pembimbing tampil; perubahan pembimbing utama serta penghapusan pembimbing kedua terbaca pada reload; cache offline dipertahankan; dokumen lokal dan archive terisolasi.
- Kasus cache kosong yang sama gagal ketika refresh preview dinonaktifkan melalui transform uji sementara, membuktikan perbedaan perilaku sebelum/sesudah perbaikan tanpa mengubah source pengguna.
- Regresi preview TA/proposal/KP tetap identik per piksel dengan snapshot. Draft tidak berubah oleh snapshot, penulis kedua terisolasi, dan zoom viewer tidak mengubah pagination.
- **22 unit test lolos**, 93 assertion, pada `cloud-academic.test.ts` dan `document-profile.test.ts`. Typecheck dan build lolos. Lint lolos dengan dua aturan baseline dinonaktifkan: `prefer-const` pada variabel stylesheet lama di PrintLayout dan `react-refresh/only-export-components` pada ekspor hook/provider lama.
- Pemeriksaan server demo lokal bersifat baca-saja terhadap dokumen: `/me` dan paket cloud sama-sama berisi pembimbing utama; server belum mengirim pembimbing kedua. Token uji dicabut. Desktop tidak membuat pembimbing kedua dari data yang tidak tersedia.

Script GUI: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/preview-equivalence.cjs --dev --cloud-advisors`.

## Breaking Changes dan Cara Review

Tidak ada perubahan format archive, skema database atau kontrak API. Preview penuh dokumen cloud sekarang menunggu percobaan refresh; saat server gagal dijangkau, cache tetap digunakan. Tidak perlu migrasi data.

Buka kembali preview penuh dokumen cloud atau tekan reload preview. Periksa nama/NIP pada lembar persetujuan. Jika server hanya mengirim pembimbing utama, layout tetap satu pembimbing. Jika ada penugasan `secondary`, kedua pembimbing harus tampil. Snapshot lama tetap memakai penugasan yang tercatat saat paketnya dibuat.
