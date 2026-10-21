# Ringkasan Perubahan — Langkah 4: Pengajuan Mahasiswa

Dasar perubahan: `e2c8d49` (`codex-step-3`). Belum di-commit. Pengujian server lokal: `http://127.0.0.1:8000/api/`, 21 Oktober 2026.

Pembaruan kebutuhan setelah langkah ini: penulis dan data akademik draft cloud kini otomatis mengikuti server dan tidak bisa diedit manual. Lihat [summary data akademik cloud](CLOUD_ACADEMIC_SUMMARY.md) untuk perilaku terbaru, validasi tambahan, dan breaking changes.

## Fitur yang Bisa Direview

Pada **Cloud → Submissions**, mahasiswa memilih dokumen lokal yang sudah tertaut ke cloud, lalu menekan **Simpan dan ajukan review**. Aplikasi membekukan isi tersimpan, mengunggah versi itu, mengajukannya dan memeriksa file snapshot dari server. Status berhasil hanya ditampilkan setelah hash snapshot cocok dengan versi yang disiapkan.

Form, dialog konfirmasi, tombol, pemilih dokumen, badge dan kartu riwayat memakai komponen serta gaya halaman lama. Compiler, resolver, preview editor, stylesheet preview dan utilitas `createElementFromUrl` tidak diubah pada langkah ini.

## Perubahan Utama

| Area                      | Perilaku                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persiapan                 | Editor harus ditutup agar penyimpanan selesai. Exporter lama membaca metadata, bab dan aset dalam satu transaksi, lalu menghasilkan artifact tetap                                                |
| Validasi                  | Judul, nama/NIM penulis dan isi bab wajib tersedia. Paket desktop harus JSON v2. KP ditolak oleh UI dan service cloud                                                                             |
| Target                    | Hanya dokumen dengan binding ke slot cloud akun yang aktif; tidak mengganti slot milik draft lain melalui pengajuan                                                                               |
| Sebelum upload            | Membaca riwayat dokumen dan memeriksa pemilik serta submission aktif. Gagal/konflik push menghentikan alur sebelum POST submission                                                                |
| Sebelum submit            | Memeriksa ID/hash versi cloud, mengunduh file dengan pemeriksaan hash, lalu memeriksa riwayat lagi                                                                                                |
| Pengajuan                 | `POST /submission` tanpa body. Tidak ada retry POST otomatis. Request submission dibatasi 30 detik                                                                                                |
| Hasil                     | Mengambil file submission melalui endpoint file, memeriksa hash byte dan ID server, lalu membandingkannya dengan hash artifact                                                                    |
| Pemulihan                 | Catatan percobaan disimpan per server/akun melalui Electron Store `submission-attempts`, termasuk sebelum POST dikirim                                                                            |
| Retry kegagalan pasti     | **Ajukan versi tersimpan** memakai versi cloud yang sudah disiapkan; tidak mengekspor atau push ulang draft terbaru. Bila cloud berubah, retry dihentikan                                         |
| Timeout/hasil ambigu      | **Periksa hasil pengajuan** hanya membaca riwayat/file. Submission baru yang muncul diverifikasi; percobaan lama tidak langsung dikirim ulang                                                     |
| Perubahan versi bersamaan | Bila snapshot berbeda, tampilkan hasil **berbeda**, bukan sukses; tombol membuka snapshot yang benar-benar dibuat server                                                                          |
| Riwayat                   | Dokumen cloud memakai `GET /submission/{document}`. Riwayat mahasiswa dari `GET /submission` tetap tampil untuk dokumen web yang belum mempunyai file cloud                                       |
| Akun multi-role           | Riwayat dokumen sendiri memakai ID slot akun; antrean advisor tetap terpisah. Pemeriksaan role UI melihat seluruh array, sementara service tetap memeriksa pemilik dan izin server                |
| Hasil review              | Status dan komentar dibaca lewat riwayat serta endpoint detail saat `reviewed`. Komentar ditampilkan sebagai teks React. Hasil review tetap dapat dibaca ketika file snapshot lama tidak tersedia |

Catatan percobaan berisi ID, judul, hash, riwayat awal dan status; tidak menyimpan token atau salinan draft. File yang sudah diunggah tetap berada di server. Membatalkan rencana yang belum dikirim tidak menghapus file cloud. Catatan `uncertain`/`unverified` tidak dapat dibatalkan dari tombol tersebut.

## Breaking Changes dan Migrasi

- **Tidak ada perubahan endpoint backend, format archive atau schema IndexedDB.** Data lokal dan binding cloud lama tetap dipakai. Tidak perlu migrasi manual.
- Preload/IPC mendapat metode tambahan untuk history, detail dan workflow. **Restart aplikasi/development** agar main, preload dan renderer memakai build yang sama.
- Pengajuan baru memerlukan binding cloud, judul, nama/NIM dan isi tersimpan yang valid. Dokumen lama tanpa profil masih dapat dibaca; lengkapi penulisnya sebelum mengajukan.
- Setelah hasil POST menjadi ambigu, tombol submit ulang dinonaktifkan. Ini batas perilaku yang disengaja: aplikasi tidak dapat membuktikan request sebelumnya batal hanya dari timeout atau riwayat yang masih kosong.

## Batas Kontrak Server

Endpoint submit belum menerima expected SHA atau idempotency key. Pemeriksaan sebelum submit **tidak atomik** dengan pembuatan snapshot. Perangkat lain masih bisa mengganti versi pada sela pemeriksaan; desktop mendeteksi perbedaan setelah membaca snapshot, tetapi tidak membatalkan submission server secara otomatis.

Jika POST timeout dan riwayat terus kosong, catatan tetap `uncertain`; UI hanya menyediakan pemeriksaan ulang. Pemulihan yang dapat menjamin retry tanpa duplikasi pada kondisi ini membutuhkan kepastian dari server atau kontrak idempotency. Jangan menghapus store untuk melewati status tersebut. Penguncian klik ganda desktop berlaku dalam main process aplikasi; ini bukan jaminan exactly-once lintas perangkat.

## Validasi

- **97 test lolos, 0 gagal**, 16 file dan 391 assertion. Typecheck, lint kode terkait dan build renderer/main/preload lolos; build masih memiliki warning ukuran chunk.
- Unit test mencakup pengajuan berhasil, artifact tetap, versi cloud berubah, konflik, dokumen tidak tertaut, data wajib, KP, klik ganda, `422`, timeout setelah commit, hasil yang terlambat, restart koordinator, pergantian akun saat push/POST, snapshot berbeda dan hash rusak.
- Test client memeriksa endpoint ID dokumen/submission, body POST kosong, status `409`/`422`, hubungan komentar dan sesi lama.
- Uji GUI Electron menggunakan komponen React, dialog dan exporter sebenarnya, API fixture serta profil sementara: form, konfirmasi, snapshot link, editor terbuka, profil kosong, KP, dokumen tidak tertaut, remount setelah timeout, komentar HTML sebagai teks, riwayat web tanpa cloud dan akun multi-role lolos.
- GUI test memunculkan warning ref pada `DialogOverlay` lama serta deprecation `fs.Stats` dari tooling. Komponen bersama tersebut tidak diubah untuk perbaikan di luar scope.
- Script GUI opt-in: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/submission-ui.cjs`.

## Pengujian Server Lokal

Script opt-in: `bun run tests/integration/local-server.ts --submit`. Mode ini hanya menerima fixture **Codex sync demo**, ID lokal `codex-sync-fixture`, yang sudah ada dari pengujian sebelumnya. File fixture yang sama di-push tanpa mengganti kontennya, lalu diajukan jika belum ada submission aktif. Akun demo tetap berupa konstanta, tanpa dependensi `demo-user`.

Hasil aktual:

- Satu submission demo **#1**, status **waiting_for_review**, berhasil dibuat melalui workflow baru. Hash snapshot cocok dengan artifact yang disiapkan.
- Unduhan student dan advisor berhasil diverifikasi. Profil penulis berasal dari paket fixture, bukan akun pembaca.
- Pengulangan script mendeteksi submission aktif, tidak membuat submission tambahan, dan kembali memverifikasi byte snapshot.
- Versi cloud fixture B beserta riwayat A tetap tersedia; tidak ada perubahan komentar/status review advisor. Token login uji dicabut setelah pengujian.
- Tahap hasil review `reviewed` dan komentar diuji menggunakan fixture/unit test; review demo belum diselesaikan di server. Uji GUI memakai API fixture, sedangkan request server sebenarnya diuji terpisah oleh script integrasi.

## Cara Review

1. Restart `bun run dev`, login demo mahasiswa dan buka **Cloud → Submissions**. Submission demo #1 harus tampil sebagai menunggu review. **Baca snapshot** harus menampilkan penulis paket.
2. Untuk pengajuan baru setelah tidak ada review aktif: tautkan draft melalui **Dokumen cloud**, isi judul/penulis/bab, lalu tutup editor. Pilih draft dan gunakan **Simpan dan ajukan review**. Periksa konfirmasi, status dan snapshot hasilnya.
3. Saat submission masih aktif, pengajuan berikutnya harus dinonaktifkan. Buka sebagai advisor untuk membaca snapshot; langkah ini belum menambah aksi mulai/selesai review advisor.
4. Coba dokumen belum tertaut, KP, profil belum lengkap dan editor yang masih terbuka. Alur harus berhenti sebelum mengajukan.
5. Setelah kegagalan submit yang pasti, retry harus memakai versi tersimpan. Setelah timeout ambigu, pindah halaman/restart lalu gunakan **Periksa hasil pengajuan**; tidak boleh ada POST ulang otomatis.
6. Bila akun mempunyai kedua role, periksa riwayat sendiri dan antrean mahasiswa sebagai dua konteks terpisah. Untuk submission yang telah selesai, periksa hasil review dan komentar.

Langkah 5 (aksi workflow advisor) menunggu review fitur ini. Export PDF snapshot dan dukungan KP online belum termasuk.
