# Langkah 5 — Workflow Advisor

Tanggal: 21 Oktober 2026. Status: **siap review**. Checkpoint sebelum perubahan: `cbb1333` (`feat: submission`). Perubahan belum di-commit.

## Perubahan

Advisor sekarang dapat melihat antrean submission dan mahasiswa bimbingan aktif, membuka riwayat dokumen, memulai review, mengirim komentar maksimal **200 karakter Unicode**, lalu menyelesaikan review melalui dialog konfirmasi. Status dan komentar dibaca ulang dari server setelah aksi. Mahasiswa melihat hasil dan komentar setelah status `reviewed`.

UI menggunakan Card, Badge, Button, Textarea, dialog, warna dan bentuk panel yang sudah dipakai aplikasi. Kontrol review berada di kartu hasil review pada halaman snapshot yang sama. Snapshot tetap hanya baca; membuka/meninjau dokumen mahasiswa tidak membuat binding cloud advisor atau menerapkan profil advisor ke dokumen.

| Bagian | Implementasi |
| --- | --- |
| Daftar bimbingan | `GET /advisor/students`, hanya mentorship aktif; tandai pembimbing utama/kedua |
| Antrean | `GET /submission`; cocokkan pemilik dokumen dengan mahasiswa bimbingan |
| Riwayat | `GET /submission/{documentId}`; validasi pemilik sesuai mahasiswa yang dipilih |
| Mulai review | POST tanpa body ke `/submission/{documentId}/on-review`, hanya untuk versi aktif berstatus `waiting_for_review` |
| Komentar | POST `/submission/{submissionId}/comment` dengan `{ comment }`, hanya versi aktif `on_review`; komentar kosong atau lebih dari 200 karakter ditolak sebelum request |
| Selesai review | POST tanpa body ke `/submission/{documentId}/review`, hanya versi aktif `on_review`; komentar yang belum dikirim harus dikirim/dikosongkan terlebih dahulu |
| Hasil mahasiswa | Detail hasil hanya diminta setelah `reviewed`; komentar HTML ditampilkan sebagai teks |

Akses mengikuti pemilik, mentorship dan respons API, bukan role pertama akun. Akun dengan role student/advisor tetap memiliki konteks dokumen sendiri dan bimbingan yang terpisah. Dokumen sendiri tidak memperoleh kontrol advisor. Saat pemeriksaan ulang menemukan akses dicabut atau sesi berubah, kontrol ditolak dan halaman melepaskan snapshot yang sedang ditampilkan.

## Riwayat ketika antrean sudah kosong

Backend lokal saat ini mengirim mahasiswa tanpa ID dokumen pada `/advisor/students`; `/submission` advisor hanya memuat pengajuan aktif. Desktop tidak dapat otomatis menemukan semua dokumen yang telah selesai pada instalasi baru.

Solusinya: simpan hubungan mahasiswa–dokumen yang sudah terverifikasi dari antrean, pembukaan snapshot, atau pembukaan riwayat dengan ID eksplisit. Hubungan tersimpan per **server dan akun**, tetap tersedia setelah restart/review selesai, dan diperiksa kembali ke server setiap kali dibuka. Mahasiswa yang mentorship-nya dicabut dihapus dari daftar hubungan pada pemeriksaan berikutnya. Catatan lokal bukan bukti hak akses.

Untuk dokumen yang belum pernah dikenali, pilih mahasiswa lalu masukkan ID dokumen yang dibagikan mahasiswa, misalnya dari tautan snapshot `/dashboard/submissions/{documentId}/{submissionId}`. ID dokumen tidak ditebak dari ID mahasiswa. Dokumen milik mahasiswa lain ditolak. Agar seluruh riwayat tersedia otomatis di perangkat baru, backend perlu mengirim ID dokumen pada daftar bimbingan atau menyediakan endpoint pencarian dokumen mahasiswa.

## Klik ganda dan hasil request yang belum pasti

- Satu aksi tulis diproses pada satu waktu di main process. Renderer juga mengunci tombol selama aksi/dialog berjalan. Nonce request yang telah dikonfirmasi mencegah replay lokal yang masih tercatat.
- Intent disimpan sebelum POST pada store lokal baru `advisor-review`; cakupannya server, akun, dokumen dan submission. Store menyimpan ID dokumen yang dikenali, request yang belum terkonfirmasi, teks komentar pending dan maksimal 200 receipt request selesai; tidak menyimpan token/password atau file snapshot.
- Saat respons hilang/timeout/5xx, desktop hanya membaca ulang status/komentar. POST tidak diulang otomatis. Bila hasil belum dapat dibuktikan, semua aksi pada submission tersebut dikunci dan **Muat ulang** hanya memeriksa server.
- Komentar pending dipulihkan ketika halaman dibuka ulang. Konfirmasi harus menemukan ID komentar baru, teks yang sama dan ID advisor yang sesuai; komentar lama dengan teks identik tidak dianggap hasil pengiriman baru. Bila server mengembalikan ID komentar, ID tersebut juga harus cocok.
- Penolakan HTTP 4xx yang pasti ditampilkan sebagai error; status bukan dianggap berhasil. Pergantian sesi selama operasi menolak hasil sesi sebelumnya. Store akun lain tidak ditampilkan.

Jika hasil terus tidak terlihat setelah timeout, diperlukan pemeriksaan server untuk memastikan apakah aksi tersimpan. UI sengaja tidak menyediakan pengiriman ulang tanpa kepastian atau penghapusan intent pending. Ini tidak menjamin exactly-once lintas perangkat; backend belum menyediakan idempotency key.

## Batas konsistensi backend

Endpoint mulai/selesai review memakai **ID dokumen** dan memilih submission aktif di server, tanpa parameter ID submission yang diharapkan. Desktop memeriksa versi/status sebelum POST dan memeriksa ID/status respons sesudah POST. Namun perangkat lain masih dapat menyelesaikan review dan membuat submission baru di sela GET–POST. Pada kondisi tersebut server dapat mengubah versi baru; desktop mendeteksi respons berbeda, menampilkan `state_changed`, menyimpan tanda mismatch dan tidak mengirim ulang. Desktop tidak dapat membatalkan perubahan server tersebut.

Solusi penuh membutuhkan `expected_submission_id` atau operasi bersyarat versi pada backend, serta idempotency key untuk komentar/aksi. Backend tidak diubah pada langkah ini. UI belum mendukung edit/hapus komentar atau anotasi paragraf karena kontraknya tidak tersedia.

## Breaking Changes dan Migrasi

**Tidak ada breaking change pada format `.hightex`, skema draft lokal, binding cloud atau kontrak API server.** Store baru dibuat otomatis; file/dokumen lama tidak memerlukan migrasi. DTO menambah metadata komentar dan API IPC advisor tanpa menghapus method lama. Tidak ada dependensi baru.

Restart aplikasi/dev process diperlukan karena main process dan preload mendapat handler baru. Renderer baru membutuhkan preload dari versi yang sama. Kontrol komentar desktop hanya tersedia selama review aktif dan ditutup setelah selesai; hasil yang sudah selesai tetap dapat dibaca. Timeout ambigu dapat membuat aksi tetap terkunci sampai hasilnya dapat diverifikasi.

Viewer, utilitas `createElementFromUrl`, compiler, resolver, print styles dan pengaturan zoom tidak diubah dalam langkah ini. Dokumen lokal tetap menggunakan data per dokumen; kebijakan data akademik cloud dari langkah sebelumnya tetap berlaku. KP online, PDF snapshot dan autentikasi browser belum termasuk langkah ini.

## Validasi

- `bun test`: **128 test lolos, 0 gagal**, 18 file, 533 assertion. Termasuk 17 test baru advisor: pemilik/mentorship, ID endpoint, siklus review, Unicode, klik ganda/replay, timeout sebelum/sesudah commit, restart, akun berganti, akses dicabut dan respons untuk versi berbeda.
- `tsc --noEmit` lolos. Lint file fitur yang terkait lolos. Preload masih mempunyai 13 pelanggaran `no-explicit-any` yang sudah ada pada checkpoint; dengan hanya aturan tersebut dinonaktifkan untuk pemeriksaan preload, lint lolos. Pelanggaran lama tidak diperbaiki di luar scope fitur.
- `vite build` renderer/main/preload lolos; masih ada warning ukuran chunk.
- GUI Electron dengan komponen React sebenarnya, API fixture dan profil sementara lolos: daftar/riwayat advisor, mulai review, komentar Unicode/klik ganda, konfirmasi batal/selesai, hasil mahasiswa, serta pending lintas remount dan refresh tanpa POST ulang. Regresi pengajuan/cloud/settings/multi-role juga lolos. Warning lama DialogOverlay, DatePicker dan tooling masih muncul.
- Script GUI: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/submission-ui.cjs`.
- Server lokal: `bun run tests/integration/local-server.ts --advisor` lolos **secara baca-saja**. Advisor memiliki 1 mahasiswa aktif, antrean 0, riwayat 1 dokumen dengan 1 submission `reviewed`; pembukaan hasil dan pemulihan hubungan dokumen berhasil. Snapshot mahasiswa terverifikasi; token uji dicabut setelah pengujian. **Tidak ada komentar/status review yang diubah** pada server demo. Mutasi review diuji dengan fixture service dan GUI, bukan diklaim telah dijalankan pada server sebenarnya.

## Cara Review

1. Restart dev process, login sebagai advisor, buka **Cloud → Submissions**. Periksa antrean serta daftar **Mahasiswa bimbingan**. Gunakan **Lihat riwayat**, lalu pilih dokumen yang dikenal atau masukkan ID dokumen yang dibagikan mahasiswa. Pada demo saat pengujian, submission #1 sudah selesai sehingga antrean kosong.
2. Untuk mencoba siklus baru, mahasiswa mengajukan dokumen melalui alur langkah 4. Advisor membuka **Baca snapshot**, memeriksa isi, lalu memilih **Mulai review**. Identitas snapshot harus tetap milik mahasiswa.
3. Coba komentar kosong, 200 dan 201 karakter termasuk emoji. Klik ganda pada aksi; hanya satu request yang boleh terkirim. Kirim komentar yang valid; daftar komentar/status harus berasal dari server. Selesaikan review melalui konfirmasi, lalu buka hasil sebagai mahasiswa.
4. Setelah review selesai, kembali ke daftar bimbingan/restart aplikasi. Dokumen yang sudah dikenali harus tetap dapat dibuka melalui riwayat, walaupun antrean kosong. Versi selesai tidak boleh mempunyai form komentar.
5. Untuk skenario koneksi putus, gunakan fixture GUI/service agar tidak meninggalkan aksi ambigu pada data demo. Pending harus tetap terkunci setelah remount dan refresh tidak menambah POST. Periksa akun multi-role dan perubahan permission: dokumen sendiri tetap hanya mempunyai alur mahasiswa.

Fitur berhenti pada langkah 5 untuk review. Langkah berikutnya sesuai rencana: export PDF snapshot dan metadata PDF.
