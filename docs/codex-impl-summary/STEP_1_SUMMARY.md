# Ringkasan Perubahan — Langkah 1: Penulis per Dokumen

Commit implementasi: `cb21591` — `codex-step: profile refactor`.
Checkpoint sebelumnya: `b2a498e`.

## Tujuan

Memisahkan identitas penulis dokumen dari profil akun/default aplikasi. Dokumen A dan B dapat memiliki nama, NIM, pembimbing, CV, dan foto berbeda. Ini menjadi fondasi agar advisor nantinya dapat mereview dokumen mahasiswa dengan identitas mahasiswa tersebut.

Workflow review advisor belum diimplementasikan pada langkah ini.

## Perubahan Perilaku

| Area | Sebelumnya | Sekarang |
| --- | --- | --- |
| Identitas penulis | Mengandalkan profil global | Disimpan pada masing-masing dokumen |
| Pengaturan penulis | Di pengaturan aplikasi | Ada bagian **Penulis dokumen** pada sidebar **Setting** editor |
| CV dan foto | Dipakai bersama oleh semua dokumen | Diedit dan disimpan otomatis untuk dokumen yang sedang dibuka |
| Preview dan PDF | Ada pembacaan profil global, termasuk pada CV builder | Membaca profil penulis dari dokumen yang dirender |
| Export/import `.hightex` v2 | Profil dan foto tidak ikut dalam paket | Profil, CV, dan foto ikut dalam paket |
| Profil global | Menjadi sumber profil dokumen saat dibaca | Menjadi default untuk dokumen baru; dapat disalin secara eksplisit ke dokumen lama |
| Dokumen tanpa profil | Berpotensi memakai profil pengguna yang membuka | Menampilkan data penulis belum lengkap dan menyediakan akses ke pengaturan dokumen |
| Variabel | Nama variabel menjadi primary key tunggal | Memakai gabungan ID dokumen dan nama variabel |

Form, card, tombol, sidebar, dan layout CV menggunakan komponen serta gaya tampilan yang sudah ada. Teks antarmuka baru tersedia dalam Bahasa Indonesia dan Inggris.

## Perbaikan yang Menyertai

- Variabel bernama sama pada dua dokumen tidak saling menimpa. Variabel identitas penulis tidak mengambil nilai pengganti dari profil global.
- Menyimpan pengaturan atau mengganti judul tidak menimpa profil, CV, atau foto terbaru dengan salinan data lama.
- Penulisan CV dan foto secara bersamaan mempertahankan kedua perubahan.
- Import v2 mempertahankan konfigurasi dokumen, termasuk data KP dan tanggalnya.
- Keyword Inggris pada manifest menggunakan daftar keyword Inggris.
- Pembimbing instansi KP tidak lagi memakai nama pembimbing kampus atau NIP bawaan sebagai pengganti.
- HTML CV dibatasi ke format teks yang didukung sebelum ditampilkan.
- Toggle **Prefer Cloud Profile** dihapus dari antarmuka karena profil render kini mengikuti dokumen.
- Tipe `User` umum tidak lagi menganggap seluruh pengguna pasti ber-role student. Pemilihan konteks multi-role lengkap masih termasuk pekerjaan berikutnya.

## Penyimpanan dan Kompatibilitas

- Database lokal naik dari versi 1 ke versi 2. Tabel variabel lama dipertahankan sebagai cadangan; data disalin ke tabel baru dengan kunci gabungan.
- Migrasi tidak otomatis menempelkan profil default atau akun login ke dokumen lama. Identitas dokumen tersebut perlu ditinjau per dokumen.
- Profil default lokal dan CV/foto lama tetap tersedia untuk disalin melalui tindakan eksplisit.
- Archive tetap memakai schema v2, dengan entry tambahan `files/profile.json` dan `files/assets/profile.webp`.
- Paket lama tanpa profil tetap dapat dibaca. Profil dalam manifest lama dibaca bila tersedia.
- Penambahan entry archive belum diuji terhadap server langsung.

## Breaking Changes

1. **Profil global tidak lagi memperbarui dokumen yang sudah ada.** Ubah identitas melalui pengaturan masing-masing dokumen. Dokumen lama tanpa profil perlu ditinjau; gunakan tindakan salin default bila datanya memang sesuai.
2. **CV dan foto berlaku per dokumen.** Mengubah CV pada satu dokumen tidak mengubah dokumen lainnya. CV/foto lama tetap tersedia melalui tindakan **Ambil CV dan foto default**.
3. **Database lokal menjadi versi 2.** Tabel variabel versi 1 tetap disimpan sebagai cadangan, tetapi tidak ada downgrade database otomatis. Mengembalikan kode ke checkpoint sebelum langkah pertama tidak otomatis mengembalikan versi IndexedDB; rollback aplikasi memerlukan backup data yang sesuai.
4. **Toggle Prefer Cloud Profile dihapus.** Pemilihan identitas dokumen sekarang dilakukan secara eksplisit pada dokumen.

Tidak perlu menghapus data aplikasi untuk menjalankan versi baru. Reader lama yang mengabaikan entry profil tambahan dapat kehilangan data penulis/foto ketika melakukan export ulang; gunakan aplikasi yang mendukung profil per dokumen untuk mempertahankannya.

## Hasil Validasi

- **29 test lolos**, termasuk 10 skenario baru untuk profil, variabel, migrasi, penulisan bersamaan, dan export/import.
- **Typecheck lolos:** `tsc --noEmit`.
- **Build lolos:** renderer, Electron main, dan preload.
- **Lint kode inti yang berubah lolos** tanpa warning. Ini bukan klaim bahwa lint seluruh repository sudah bersih.
- Tampilan aplikasi dan hasil PDF aktual **belum diuji melalui GUI**.

## Cara Review

Jalankan `bun run dev`, lalu:

1. Buka dua dokumen dan isi identitas berbeda melalui **Setting → Penulis dokumen**. Simpan dari header sidebar.
2. Isi CV dan pilih foto berbeda pada bab **Daftar Riwayat Hidup** masing-masing dokumen.
3. Periksa preview penuh dan PDF; kemudian ubah profil default aplikasi. Identitas dokumen yang sudah disimpan harus tetap sama.
4. Export/import `.hightex` dan periksa penulis, CV, foto, data KP, serta keyword dua bahasa.
5. Buka paket lama tanpa profil. Aplikasi harus meminta kelengkapan data penulis tanpa mengisinya dari profil yang sedang aktif.

Panduan lebih lengkap: [tests/manual-test.md](../../tests/manual-test.md).

## Belum Termasuk

- Reader dan penyimpanan snapshot review yang terisolasi dari draft.
- Antrean advisor, daftar mahasiswa, komentar, dan perubahan status review.
- Pengajuan submission mahasiswa.
- Login browser, logout server, dan update profil akun online.
- Perbaikan kontrak hash, konflik sinkronisasi, dan binding cloud per akun/dokumen.
- Data akademik KP serta workflow KP online di server.

Implementasi berikutnya menunggu review atas langkah pertama ini.
