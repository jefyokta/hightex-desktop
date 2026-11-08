# Rencana perapihan — 8 November 2026

Urutan pengerjaan: isolasi profil → form → UI branch comparison.

## 1. Isolasi profil, termasuk cloud

Keputusan awal: satu server/akun per profil cloud; profil lokal tanpa login juga tersedia. Origin memakai `hightex://profile.<profileId>`, tanpa `.local`. Rencana implementasi awal: [isolasi profil workspace](docs/contributors/profile-isolation-plan.md). Revisi desain menunggu tinjauan: [rencana revisi isolasi profil](docs/contributors/profile-isolation-revision-plan.md).

- [x] **Step 1 — Model profil:** pisahkan identitas workspace dari profil penulis dokumen; tetapkan ID stabil, host, dan ikatan akun.
- [x] **Step 2 — Cakupan isolasi:** petakan IndexedDB, localStorage/form, electron-store, SQLite, kredensial, cache, snapshot, dan backup.
- [x] **Step 3 — Kebijakan migrasi:** hanya untuk update yang memiliki data legacy; kelompokkan berdasarkan binding host/akun, dokumen tanpa binding masuk Lokal, dan branch mengikuti induk.
- [x] **Step 4 — Rencana pemulihan:** sumber lama dipertahankan, backup dan jurnal disimpan, target diverifikasi sebelum diaktifkan, dan migrasi gagal dapat diulang.
- [x] **Step 5 — Penyimpanan:** origin dan direktori data terpisah per profil; SQLite memakai model; akun lain tidak dapat mengambil alih profil yang sudah terikat.
- [x] **Step 6 — Perpindahan profil:** pemilih/buat profil, pemeriksaan origin IPC, dan relaunch konteks setelah seluruh jendela lain ditutup.
- [x] **Step 7 — Migrasi:** transfer data/aset/form dan SQLite ke profil tujuan, pertahankan profil penulis serta binding, dan salin sesi hanya ke akun/host yang cocok.
- [x] **Step 8 — Validasi akhir:** typecheck, lint file terkait, dan build lolos; 409 tes unit lolos; integrasi Electron memverifikasi origin/SQLite, startup instalasi baru, serta kegagalan verifikasi dan retry migrasi tanpa duplikasi.
- [x] **Perapihan CV global:** pisahkan editor CV/foto ke `/profile/cv`; Profile cukup memiliki tombol **Edit CV**. Gunakan tampilan kertas yang sama dengan CV di editor dokumen, penyimpanan eksplisit, dan perlindungan draft; CV tetap berlaku untuk seluruh dokumen workspace.

Selesai bila: profil mengakses penyimpanannya sendiri, host/akun cloud sesuai, instalasi baru melewati migrasi, dan data update tetap utuh serta dapat dipulihkan.

## 2. Form — input tidak lagi per dokumen

Tujuan: pengguna tidak perlu mengisi ulang data yang sama ketika berganti dokumen dan tidak kelupaan input.

- [x] **Step 1 — Petakan data:** data umum bersama; jadwal/pilihan formulir per tahap; identitas dan judul mengikuti profil/dokumen. Rincian: [isian formulir per profil](docs/contributors/form-workspace-input-plan.md).
- [x] **Step 2 — Tentukan cakupan:** draft mengikuti origin profil aktif; data profil/dokumen yang tersedia tetap diutamakan dan tidak menghapus isian bersama yang tertutup sementara.
- [x] **Step 3 — Rancang migrasi draft:** nilai sama digabungkan; nilai berbeda dipilih eksplisit atau dilewati. Draft lama tetap tersedia melalui panel pemulihan.
- [x] **Step 4 — Ubah penyimpanan:** satu key workspace, data umum bersama, jadwal/pilihan per tahap; tidak menulis ulang key draft per dokumen.
- [x] **Step 5 — Rapikan alur UI:** satu panel data tersedia sebelum memilih dokumen; pilih Sempro/Sidang untuk menampilkan hanya tahap aktif. Pemilihan formulir hanya mengganti preview. Ringkasan kosong/invalid dapat dibuka untuk menuju field, tanpa penjelasan berulang. Jadwal tetap opsional; reset memakai konfirmasi dan ekspor memeriksa seluruh paket.
- [x] **Step 6 — Validasi:** unit dan integrasi Electron lolos untuk pindah dokumen/tahap, buka ulang, konflik migrasi, reset, keutuhan sumber, serta preview dan PDF/ZIP.

Selesai bila: input bersama tetap tersedia saat berganti dokumen, data khusus dokumen tetap sesuai sumbernya, dan input lama dapat dipulihkan.

## 3. Branch comparison — perbaikan UI agar konsisten dengan editor

Tujuan: pengguna melihat isi dokumen dengan tampilan yang konsisten antara editor dan comparison. Tampilan yang berbeda saat ini membingungkan; fokus pekerjaan ini adalah UI comparison.

- [x] **Step 1 — Petakan perbedaan tampilan:** comparison lama meratakan struktur menjadi teks/JSON; kini memakai schema dan stylesheet editor untuk tipografi, paragraf, heading, list, tabel, gambar, dan caption.
- [x] **Step 2 — Rancang UI yang mengikuti editor:** panel Main/Branch, daftar perubahan, ringkasan status, penanda blok, dan navigasi sebelumnya/berikutnya. Rincian: [UI comparison](docs/contributors/branch-comparison-ui.md).
- [x] **Step 3 — Selaraskan render konten:** serialisasi schema editor dalam mode hanya baca dengan konteks gambar, sitasi, variabel, dan referensi per sisi. Tidak menjalankan editor/plugin yang menulis konten.
- [x] **Step 4 — Rapikan interaksi comparison:** navigasi antarperubahan, scroll bab panjang, pemilih pada layar kecil, loading, retry saat gagal, dan kondisi tanpa perubahan. Metadata tetap berlabel.
- [x] **Step 5 — Validasi visual dan perilaku:** integrasi Electron memeriksa konten campuran, format-only, tambah/hapus, navigasi, ukuran layar, dan keutuhan data. Pencocokan blok hanya untuk UI; algoritma comparison/merge tetap sama.
- [ ] **Pemeriksaan Windows native:** aturan border header/header-like sudah disamakan pada editor dan comparison serta diuji dengan rowspan di Electron macOS. Konfirmasi hasil pada Windows setelah build terbaru.

Selesai bila: isi dokumen terlihat konsisten dengan editor dan pengguna mudah mengenali perubahan tanpa harus memahami dua bentuk tampilan yang berbeda.

## 4. Login behavior

Tujuan: fitur server pada workspace Lokal menjelaskan batas aksesnya dan menawarkan alur yang bisa dipakai tanpa mengubah profil menjadi Cloud.

- [x] **Data dosen di Lokal:** tampilkan tombol **Unduh JSON di web** dan petunjuk singkat untuk login di browser, mengunduh, lalu memakai **Impor JSON**. Tidak membuka login desktop atau mengambil data Cloud dari workspace Lokal.
- [x] **Batas IPC:** permintaan fetch langsung dari Lokal/konfigurasi yang belum siap mengembalikan error `local_workspace` yang dapat ditampilkan ke pengguna. Tautan unduh dibuat dari host server terkonfigurasi, termasuk server dev.
- [x] **Unduhan web:** endpoint `/lecturers/export` di repo `../hightex` memerlukan login browser dan verifikasi email. File berisi nama/NIP dalam format yang dapat diimpor; tidak membuat token desktop atau mengikat akun ke workspace Lokal. Perubahan server perlu dirilis bersama perubahan desktop.
- [x] **Validasi desktop:** unit dan integrasi Electron memeriksa alur Lokal, tidak ada login/fetch tersembunyi, impor offline, data tetap utuh, serta alur autentikasi/fetch Cloud. Typecheck dan lint terkait lolos.
- [x] **Validasi server akhir:** 4 tes dan 14 assertion lolos menggunakan SQLite `:memory:`: login browser, verifikasi email, unduhan JSON nama/NIP tanpa token desktop, dan kondisi tanpa data yang dapat diimpor.


## 5. Branch comparison — keamanan konten dan perubahan di window lain

Pertanyaan: apakah comparison membuat instance Tiptap baru, apakah berisiko mengulang [kasus konten hilang](./docs/contributors/editor-content-loss.md), dan bagaimana jika Main/Branch sedang diedit di window lain?

Jawaban: comparison memakai serializer schema `generateHTML`, tanpa instance Editor baru, lifecycle autosave, atau penggantian global bab/dokumen. Hasilnya snapshot; perubahan sumber ditandai dan pengguna memperbaruinya melalui **Refresh**. Rincian: [snapshot dan editor yang terbuka](docs/contributors/branch-comparison-ui.md#snapshot-dan-editor-yang-sedang-terbuka).

- [x] **Step 1 — Audit jalur baca:** baca snapshot arsip dan render hanya baca; tidak mengaktifkan bab atau menjalankan plugin editor yang menulis konten.
- [x] **Step 2 — Ambil autosave terbaru:** minta editor Main/Branch yang sudah terbuka melakukan flush pada babnya sendiri sebelum capture. Editor belum siap atau gagal menyimpan menghentikan comparison dengan retry; tidak memakai placeholder.
- [x] **Step 3 — Tandai snapshot berubah:** amati database/aset sumber serta profil/sesi; tampilkan pemberitahuan singkat dan Refresh tanpa mengganti tampilan otomatis. Refresh tersedia juga untuk input yang masih menunggu autosave.
- [x] **Step 4 — Amankan lifecycle:** batalkan pengamatan saat tutup/refresh dan abaikan hasil load lama. Perubahan ketika capture berlangsung ikut menandai hasil sebagai berubah.
- [x] **Step 5 — Validasi:** 433 tes unit, typecheck, lint terkait, dan build lolos. Integrasi Electron dua window memeriksa edit Main/Branch, snapshot tetap stabil, refresh mengambil input tertunda dari editor asli, global editor tidak berubah, serta kegagalan editor belum siap tanpa perubahan data. Regresi konten hilang tetap lolos.
