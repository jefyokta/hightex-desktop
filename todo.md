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

Selesai bila: profil mengakses penyimpanannya sendiri, host/akun cloud sesuai, instalasi baru melewati migrasi, dan data update tetap utuh serta dapat dipulihkan.

## 2. Form — input tidak lagi per dokumen

Tujuan: pengguna tidak perlu mengisi ulang data yang sama ketika berganti dokumen dan tidak kelupaan input.

- [ ] **Step 1 — Petakan data:** tinjau draft form yang sekarang disimpan berdasarkan ID dokumen; tentukan input yang bisa dipakai bersama, yang berbeda antara proposal/sidang, dan yang tetap berasal dari dokumen terpilih.
- [ ] **Step 2 — Tentukan cakupan:** gunakan workspace sebagai cakupan input bersama; putuskan aturan pengisian otomatis dan prioritas antara input tersimpan dengan data dokumen/cloud.
- [ ] **Step 3 — Rancang migrasi draft:** tentukan cara mengambil input lama dari beberapa dokumen ketika nilainya berbeda, tanpa menimpa atau menghapus draft lama secara diam-diam.
- [ ] **Step 4 — Ubah penyimpanan:** simpan input yang disepakati di luar ID dokumen, pertahankan pemisahan data per tahap bila diperlukan, dan jalankan migrasi sesuai keputusan.
- [ ] **Step 5 — Rapikan alur UI:** gunakan kembali input tersimpan saat berganti dokumen; tampilkan field wajib yang belum lengkap sebelum ekspor serta sediakan cara mengedit/reset input bersama.
- [ ] **Step 6 — Validasi:** cek pindah dokumen, pindah tahap, buka ulang aplikasi, konflik data migrasi, serta kesesuaian data pada preview dan hasil PDF/ZIP.

Selesai bila: input bersama tetap tersedia saat berganti dokumen, data khusus dokumen tetap sesuai sumbernya, dan input lama dapat dipulihkan.

## 3. Branch comparison — perbaikan UI agar konsisten dengan editor

Tujuan: pengguna melihat isi dokumen dengan tampilan yang konsisten antara editor dan comparison. Tampilan yang berbeda saat ini membingungkan; fokus pekerjaan ini adalah UI comparison.

- [ ] **Step 1 — Petakan perbedaan tampilan:** bandingkan isi yang sama di editor dan comparison; catat perbedaan tipografi, paragraf, heading, list, tabel, gambar, caption, dan elemen dokumen lainnya.
- [ ] **Step 2 — Rancang UI yang mengikuti editor:** gunakan tampilan editor sebagai acuan dan tentukan penempatan label main/branch, penanda perubahan, ringkasan, serta navigasi tanpa mengaburkan bentuk asli konten.
- [ ] **Step 3 — Selaraskan render konten:** gunakan kembali komponen/render dan style editor yang sesuai dalam mode hanya baca, agar struktur serta format dokumen tetap dikenali di comparison.
- [ ] **Step 4 — Rapikan interaksi comparison:** terapkan penanda tambah/hapus/ubah yang jelas, navigasi antarperubahan, scroll konten panjang, serta kondisi loading, gagal, dan tanpa perubahan. Detail metadata tetap diberi label yang mudah dipahami.
- [ ] **Step 5 — Validasi visual dan perilaku:** cek konten yang sama di editor/comparison, termasuk teks berformat, tabel, gambar, caption, dan dokumen panjang; pastikan penanda diff terbaca dan comparison tidak mengubah isi main atau branch. Perubahan algoritma diff hanya bila diperlukan untuk mendukung UI dan dicatat terpisah.

Selesai bila: isi dokumen terlihat konsisten dengan editor dan pengguna mudah mengenali perubahan tanpa harus memahami dua bentuk tampilan yang berbeda.
