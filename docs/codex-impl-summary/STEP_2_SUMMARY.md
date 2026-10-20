# Ringkasan Perubahan — Langkah 2: Snapshot Submission Hanya Baca

Dasar perubahan: commit `cb21591` (`codex-step: profile refactor`). Perubahan langkah ini belum di-commit.

## Fitur yang Dapat Direview

Halaman **Submissions** sekarang dapat menampilkan antrean advisor atau riwayat mahasiswa dari server, lalu membuka isi snapshot submission. File `.hightex` lokal juga dapat dibaca melalui halaman yang sama tanpa login dan tanpa diimpor ke draft.

Identitas akun yang membuka file tetap terpisah dari penulis dokumen. Nama, NIM, pembimbing, CV, foto, variabel, gambar, dan referensi viewer berasal dari paket yang dibaca. Data yang tidak tersedia ditandai sebagai belum tercatat; profil advisor tidak dipakai sebagai pengganti.

## Perubahan

| Area | Hasil |
| --- | --- |
| Daftar submission | `GET /submission` ditampilkan sebagai antrean advisor atau riwayat mahasiswa sesuai bentuk respons server, bukan berdasarkan role pertama akun |
| Buka snapshot server | Mengunduh `GET /submission/{submission}/file`; memeriksa SHA-256 seluruh byte dan `X-Document-ID` sebelum menampilkan paket |
| Buka file lokal | Tombol buka `.hightex` tersedia tanpa login dan saat offline; file diberi konteks lokal, bukan dianggap sebagai submission server terverifikasi |
| Viewer | Pilihan identitas penulis, bab, CV/foto, dan referensi; konten hanya dapat dibaca |
| Penyimpanan | Reader terpisah dari editor, tidak menjalankan import atau `Document.warm()`, dan tidak menulis tabel draft |
| Cache | Hanya memori, maksimum tiga snapshot, dipisahkan berdasarkan server, akun, sesi, dokumen, submission, dan hash |
| Pergantian sesi | Respons lama tidak dipasang setelah sesi berubah; cache dibersihkan saat konteks akun berubah atau akses server offline/logout |
| Simpan paket | Menyimpan salinan byte asli, tanpa mengekspor ulang atau mengubah metadata paket |
| Tampilan | Menggunakan komponen Card, Button, Badge, Select, dan Paper yang sudah ada; teks baru tersedia dalam Bahasa Indonesia dan Inggris |

Reader mendukung manifest desktop `schema_version: 2` maupun `version: 2`, serta export web schema v1. ID lokal dalam archive boleh berbeda dari ID dokumen server; identitas target server diperiksa terhadap header respons.

Paket rusak, path archive tidak valid, format tidak didukung, dan ukuran berlebihan ditolak. Batas reader: file terkompresi 64 MiB, isi terurai 128 MiB, dan 2.000 entry ZIP. Node yang belum didukung diberi penanda sambil mempertahankan teksnya. Gambar eksternal tidak dimuat; CV melalui sanitizer yang sudah digunakan untuk profil dokumen.

## Perbaikan Sesi yang Menyertai

- IPC login mengembalikan hasil login sebenarnya.
- Request `/me` bersamaan digabung; broadcast memakai cache sehingga tidak memicu request berulang.
- Respons `/me` dari token lama tidak dapat memulihkan akun setelah logout atau menimpa akun baru.
- Role kosong tidak membuat pemetaan sesi gagal.
- Request JSON mengirim header Accept dan penyusunan URL memastikan pemisah endpoint tersedia.

## Kontrak Backend dan Batas Cakupan

Bentuk respons diverifikasi dari source backend lokal `hightex/app/Http/Controllers/Api/Submission.php` dan `ApiSubmissionTest.php`. Repository backend tidak diubah. Ini belum merupakan pengujian integrasi ke server yang berjalan.

- Akun dengan permission advisor menerima antrean sesuai prioritas backend saat ini. Pemilihan konteks mahasiswa/advisor untuk akun multi-role belum tersedia.
- Belum ada pengajuan baru, daftar mahasiswa bimbingan, komentar, mulai/selesai review, atau detail hasil review. Status yang terlihat berasal dari daftar server.
- Viewer menampilkan isi paket; cover hasil compiler, pagination, layout cetak final, dan PDF snapshot belum termasuk. Viewer tidak menyediakan export PDF.
- Paket web lama dapat tidak menyertakan NIM, CV, atau foto lengkap. Viewer tidak merekonstruksinya dari profil akun.
- Data KP yang ada dalam paket tetap dibaca sebagai data dokumen. Dukungan data akademik dan workflow KP online masih memerlukan backend.
- **Kontrak upload perlu dibereskan sebelum push → submit:** backend lokal memeriksa `manifest.version === 2`, sedangkan exporter desktop saat ini menulis `schema_version: 2`. Reader baru menerima keduanya, tetapi writer dan alur pengajuan belum diperbaiki pada langkah ini.

## Breaking Changes dan Migrasi

**Tidak ada perubahan schema database, format writer archive, atau migrasi data tambahan pada langkah ini.** Breaking changes profil dan database dari langkah pertama tetap berlaku; lihat [summary langkah 1](STEP_1_SUMMARY.md#breaking-changes).

Perubahan kompatibilitas dan operasional:

1. Summary langkah pertama dipindahkan dari root `STEP_1_SUMMARY.md` ke folder ini. Perbarui tautan yang menunjuk lokasi lama.
2. Halaman submission yang sebelumnya placeholder sekarang mengikuti respons dan hak akses server. Komponen placeholder internal advisor/student diganti dengan satu daftar bersama.
3. Restart proses development/aplikasi setelah memperbarui kode, karena ada IPC dan preload baru. Refresh renderer saja tidak memuat API baru.
4. File yang melampaui batas reader tidak dapat dibuka di viewer ini. File aslinya tidak diubah atau dihapus.

Tidak perlu menghapus database atau mengimpor ulang draft.

## Hasil Validasi

- **52 test lolos, 0 gagal**, mencakup 12 file dan 193 assertion.
- Test membuktikan dua snapshot dengan ID lokal, key variabel, gambar, dan referensi sama tetap memakai data masing-masing; identitas akun tidak menjadi fallback.
- Pembacaan dan render diuji tidak mengubah database draft maupun singleton dokumen editor aktif.
- Kontrak daftar, hash/header salah, akses ditolak, snapshot hilang, sesi berubah saat request, pembatasan archive, dan regresi sesi diuji dengan transport/fixture terisolasi.
- **Typecheck lolos:** `tsc --noEmit`.
- **Lint kode inti baru/terkait lolos** tanpa warning; bukan klaim lint seluruh repository bersih.
- **Build Vite renderer, Electron main, dan preload lolos.** Build masih memberi warning ukuran chunk di atas 500 kB.
- GUI aplikasi, server aktif, dan output PDF **belum diuji langsung**.

## Cara Review

1. Restart dengan `bun run dev`, lalu buka menu **Submissions**.
2. Tanpa login, buka dua file `.hightex` berpenulis berbeda secara bergantian. Periksa bab, identitas, CV/foto, referensi, dan variabelnya; draft yang sudah ada harus tetap utuh.
3. Buka paket lama tanpa profil. Data yang kosong harus ditandai, tanpa mengambil nama atau CV dari akun/default aplikasi.
4. Dengan akun uji dan server yang tersedia, refresh daftar lalu buka salah satu snapshot. Periksa label versi dan penulis dari paket.
5. Logout atau berganti akun saat request berlangsung; hasil akun lama tidak boleh muncul pada akun baru. Periksa juga kondisi offline, akses ditolak, dan file snapshot lama yang belum tersedia.
6. Simpan salinan paket dari viewer dan bandingkan dengan file asal; byte harus sama.

Panduan tambahan: [tests/manual-test.md](../../tests/manual-test.md). Langkah berikutnya menunggu review fitur ini.
