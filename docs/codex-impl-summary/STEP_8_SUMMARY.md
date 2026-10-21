# Langkah 8 — Profil Akun Online dan Penerapan Terpilih

Tanggal: 21 Oktober 2026. Status: **siap review**. Dikerjakan bersama langkah 6–7 atas permintaan pengguna; belum di-commit.

## Perubahan

**Settings → Profil akun online** sekarang memuat akun dari `GET /me`, menampilkan nama server tanpa menambahkan gelar lagi, identitas, role dan shortname bila tersedia. Pengaturan nama/gelar yang tidak didukung API desktop dapat dibuka di browser melalui tombol pengaturan web untuk server aktif.

Foto dan CV disimpan melalui `POST /profile` memakai multipart yang membiarkan runtime membuat boundary. Gambar dibatasi ke PNG/JPG/JPEG/WEBP maksimal 2 MB. Hanya field yang berubah dikirim; upload foto tidak menghapus CV dan perubahan CV tidak mengganti foto. Mengosongkan editor mengirim CV kosong. Error `422` ditampilkan per field dan isian yang belum berhasil disimpan dipertahankan. Hasil POST yang hilang/5xx ditandai belum diketahui, tanpa retry otomatis; muat ulang untuk melihat keadaan server.

Setelah berhasil, cache akun dan broadcast diperbarui. Cache foto/CV service terikat sesi server/akun/token, dan respons akun lama ditolak setelah sesi berubah. Foto diunduh dari storage server yang sama, tanpa bearer ke URL pihak ketiga; object URL UI dilepas saat diganti/unmount. HTML CV disanitasi sebelum ditampilkan; paste editor memakai teks dan drop HTML dicegah.

## Penerapan ke Dokumen

Perubahan profil online tidak otomatis mengubah dokumen. Pengguna memilih satu draft lokal, mencentang nama/NIM/CV/foto yang akan diterapkan, melihat perbandingan nilai lama–baru, lalu mengonfirmasi. Penerapan memakai data akun yang sudah disimpan, sehingga perubahan form harus disimpan/dibatalkan dahulu.

Field server `null`/foto tidak tersedia tidak menghapus data manual. Nama/NIM/CV/foto yang tidak dicentang tetap dipertahankan. Foto yang diterapkan dikonversi menjadi aset WebP milik dokumen. Nama advisor, pembimbing/penguji dan data akademik lain tidak disalin oleh aksi ini.

Dokumen yang tertaut cloud, cache akademik cloud dan editor yang masih terbuka ditolak. Service binding memeriksa penguncian; perubahan draft sejak pembacaan terakhir diperiksa lagi dalam transaksi sebelum menulis. Hanya dokumen target yang berubah. Data akademik cloud tetap diisi otomatis dan terkunci sesuai kebutuhan sebelumnya. Template profil lokal lama tetap tersedia sebagai pengaturan terpisah.

## Breaking Changes dan Migrasi

Tidak ada perubahan skema draft, format `.hightex` atau kontrak API server. API/preload akun online bersifat tambahan; restart aplikasi/dev process diperlukan. Tidak ada migrasi atau penyalinan otomatis ke dokumen lama. Snapshot review tidak ikut diperbarui. CV `null` pada akun tidak menjadi instruksi untuk mengosongkan CV dokumen.

API belum menyediakan penghapusan foto akun; UI hanya menyediakan penggantian foto atau pembatalan pilihan foto yang belum di-upload. Nama, NIM, gelar dan shortname tidak diedit melalui `POST /profile`.

## Validasi

- Test service mencakup multipart field yang dipilih, CV kosong, byte foto, batas MIME/ukuran, error per field, scope akun/sesi, URL foto pada server sendiri, pengaturan web dan hasil POST yang belum pasti.
- Test penerapan memakai IndexedDB: satu dokumen target, field terpilih, `null` mempertahankan CV manual, cloud/editor terbuka ditolak, draft berubah dan sesi berubah tidak menulis data.
- GUI Electron dengan komponen asli dan fixture: CV server disanitasi, error field mempertahankan isian, simpan berhasil, penerapan nama ke satu dokumen, penolakan cloud, serta modal login browser/cancel/direct diuji. Uji regresi submission/advisor dan cloud academic memakai harness sebelumnya.
- Server lokal `bun run tests/integration/local-server.ts --account` **lolos**: `/me`, menyimpan CV yang sama, foto lama tetap, gambar invalid ditolak `422` dengan error field. Foto demo tidak diganti; token uji dicabut. Upload foto valid diuji melalui service fixture, bukan diklaim telah mengganti foto akun demo.
- Suite gabungan **154 test lolos**, 22 file, 638 assertion. Typecheck, lint file fitur terkait dan build renderer/main/preload lolos; warning tooling/UI/chunk lama tetap ada.
- Script GUI: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/account-auth-ui.cjs`.

## Cara Review

1. Restart aplikasi, login, buka **Settings → Profil akun online**. Periksa nama/identitas/role dan CV. Gunakan pengaturan web untuk nama/gelar.
2. Pilih foto yang valid dan ubah CV, lalu **Simpan profil akun**. Muat ulang untuk memastikan server menyimpan hasilnya. Coba gambar lebih dari 2 MB/format lain dan periksa error.
3. Pilih satu dokumen lokal, centang field yang ingin diganti, periksa perbandingan dan konfirmasi. Dokumen lain, pembimbing, data akademik dan snapshot harus tetap mempunyai data masing-masing.
4. Coba dokumen cloud/editor terbuka dan data akun yang kosong. Penerapan harus ditolak atau mempertahankan field manual yang tidak tersedia, sesuai keterangannya.

Langkah berikutnya setelah review 6–8: kelengkapan KP lokal (9), kemudian penerimaan lintas fitur/platform (10). KP online tetap menunggu kontrak backend.
