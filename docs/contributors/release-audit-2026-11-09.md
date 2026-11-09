# Audit sebelum rilis — 9 November 2026

Audit dilakukan dari `89b0f38`, dengan perubahan sejak `v1.3.3` sebagai acuan.
Fokusnya isolasi profil, penyimpanan dokumen, preview/PDF, branch, form, dan updater.
Pengujian Electron memakai direktori sementara; data HighTex harian tidak dipakai.
Nomor versi, tag, dan release GitHub tidak diubah.

## Bug yang direproduksi dan diperbaiki

### Perubahan profil global menimbulkan konflik merge palsu

Sesudah membuat branch, mengubah nama, CV, foto, atau pembimbing pada profil lokal
membuat merge gagal meskipun Main belum berubah. Revisi sebelumnya memakai hash
seluruh archive, termasuk identitas global.

Branch baru memakai revisi dokumen yang tetap mencakup judul, kategori, kata kunci,
konfigurasi, bab, variabel, referensi, dan aset konten. Identitas global tidak ikut
menentukan konflik. Pembimbing dan komite khusus dokumen cloud tetap diperiksa.

Untuk branch lama, hash archive lama tetap diverifikasi. Jika perlu, entri identitas
direkonstruksi dari profil yang direkam pada branch; hasilnya harus cocok dengan hash
asli secara penuh. Jika kecocokan tidak bisa dibuktikan, merge tetap ditolak.
Sesudah merge berhasil, baseline memakai format revisi baru.

Regresi: `tests/document-branches.test.ts`, termasuk foto, branch lama, perubahan
judul/isi Main, dan pembimbing cloud.

### Identitas PDF bisa berubah saat render berjalan

Perubahan profil saat pemuatan kategori berhasil mengubah penulis PDF dari profil
awal menjadi profil baru. Snapshot konten sudah terpisah, tetapi variabel identitas
dan pemuatan profil masih membaca sumber workspace yang hidup.

Ekspor PDF sekarang menangkap profil workspace bersama snapshot dokumen. Database
print tidak membaca identitas workspace lagi. Preview kerja tetap dapat mengikuti
profil terbaru; PDF arsip tetap memakai profil penulis arsip.

Regresi: `tests/print-store.test.ts` dan `tests/integration/draft-pdf.cjs`, yang sengaja
mengubah isi serta profil setelah snapshot dibuat. Pemeriksaan PDF mencakup metadata,
CV, gambar, isolasi ekspor bersamaan, dan tidak adanya penulisan compiler ke draft.

### Updater gagal memulihkan status setelah kegagalan installer

Kegagalan native yang dilempar setelah fase quit membuat updater tetap berstatus
installing. Kegagalan yang dilaporkan lewat event bisa menghasilkan respons sukses.
Adapter native juga belum menunggu persetujuan penutupan editor.

Adapter native sekarang menunggu persiapan editor dan meneruskan kegagalan installer.
Facade memulihkan fase agar instalasi dapat dicoba lagi. Adapter native/macOS
memeriksa kembali pembatalan dan penyimpanan profil setelah persiapan editor selesai.

Regresi: `tests/updater-install.test.ts`.

## Hasil pengujian

- `bun test ./tests`: **483 lolos, 0 gagal**, 66 file.
- TypeScript aplikasi dan konfigurasi Vite: lolos.
- Build Vite renderer, main Electron, dan preload: lolos; masih ada peringatan ukuran bundle.
- Lint file TypeScript yang diperbaiki: 0 error, 1 warning Fast Refresh yang sudah ada
  pada modul `use-printable.tsx` karena mengekspor provider dan hook.
- Lint seluruh repo pada baseline audit: **1008 error dan 59 warning**. Hasil ini belum
  bersih dan tidak disamakan dengan keberhasilan pemeriksaan file yang diperbaiki.

Tes Electron berikut lolos di macOS. Jalankan dengan awalan
`env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron`:

| Script                                               | Cakupan                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/workspace-profiles.cjs --startup` | Startup build, preload/IPC nyata, host dan userData profil, editor hanya untuk dokumen, profil diperbarui dari main window. |
| `tests/integration/workspace-profiles.cjs`           | Migrasi/retry, IndexedDB/Blob, SQLite, pemisahan binding akun, dan pengaman pergantian profil.                              |
| `tests/integration/profile-settings-ui.cjs`          | Profil/CV lokal/cloud, draft, save, offline, sesi kedaluwarsa, serta validasi dan retry.                                    |
| `tests/integration/draft-pdf.cjs`                    | PDF skripsi, proposal, KP, profil/konten saat snapshot, metadata, gambar, watermark, serta ekspor bersamaan.                |
| `tests/integration/snapshot-pdf.cjs`                 | Identitas arsip, metadata PDF, arsip lama tanpa penulis, serta pemeriksaan akses dan pembatalan.                            |
| `tests/integration/form-generation.cjs`              | Input bersama, tahap aktif, validasi seluruh paket, PDF/ZIP, dan keutuhan sumber.                                           |
| `tests/integration/branch-comparison.cjs`            | Rendering editor/comparison, tabel, perubahan lintas window, flush/retry, dan keutuhan sumber.                              |
| `tests/integration/branch-guide-ui.cjs`              | Form kosong, panduan, aksi branch, kegagalan membuka editor, dan viewport modal.                                            |
| `tests/integration/editor-close-ui.cjs`              | Flush input terakhir, cancel, save gagal/retry, lokasi archive, buka ulang, konfigurasi, dan draft pengaturan.              |

Fixture deep-link, PDF, dan close editor disesuaikan dengan facade updater, schema
database, serta API profil/session saat ini. Kegagalan tulis file dan penolakan akses
yang sengaja diuji tetap dapat muncul di log tes yang berhasil.

## Batas pengujian

- Instalasi updater secara penuh dari aplikasi packaged A ke B belum diuji di audit ini.
  Unit test memakai adapter/helper fixture; ini tidak membuktikan instalasi pada OS pengguna.
- Windows dan Linux belum diuji lewat aplikasi native pada audit macOS ini.
- Login/sinkronisasi dengan layanan produksi tidak dijalankan; tes memakai fixture.
- Tidak semua script integrasi lama di repo dijalankan. Hasil ini mencakup alur yang
  tercatat di atas, bukan jaminan bahwa seluruh kombinasi dokumen dan lingkungan bebas bug.
