# Ringkasan Perubahan — Langkah 3: Sinkronisasi Cloud

Dasar implementasi: `5766f6e` (`codex-step: submission and review`). Perubahan langkah ini belum di-commit. Server pengujian lokal: `http://127.0.0.1:8000/api/`, 21 Oktober 2026.

## Fitur yang Bisa Direview

Menu **Dokumen cloud** mempertahankan tampilan sebelumnya, dengan alur push, pull, konflik, unduhan riwayat, dan pemulihan versi yang memisahkan data lokal dari informasi server.

Contoh regresi yang sudah diperbaiki: draft berbasis versi A, server sudah versi B, lalu pengguna memuat ulang riwayat. Sebelumnya refresh menyimpan SHA B sebagai base global sehingga push berikutnya berpotensi menimpa B. Sekarang refresh hanya menampilkan B; push draft tetap membawa base A dan menerima konflik `409`.

## Perubahan Utama

| Area                   | Perilaku sekarang                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Binding/base           | Disimpan per URL server, akun, dan ID dokumen lokal, dengan ID dokumen server terpisah                                                                                                                 |
| Daftar riwayat         | Tidak menyimpan atau menghapus base draft                                                                                                                                                              |
| Push                   | Metadata, konten, variabel dan aset dibaca dalam satu transaksi; main process menghitung SHA-256 seluruh byte yang dikirim                                                                             |
| Export                 | Urutan entry dan waktu ZIP dibuat tetap; metadata export tidak lagi memuat waktu saat tombol ditekan. Gambar dan foto ikut menentukan hash                                                             |
| Manifest               | Writer menulis `schema_version: 2` dan `version: 2`, sesuai kebutuhan reader desktop dan backend lokal                                                                                                 |
| Konfirmasi push        | Base baru disimpan setelah respons SHA sesuai artifact dan commit server mengonfirmasi ID/versi; hasil sesi lama ditolak                                                                               |
| Pull                   | Memeriksa hash byte, header ID server dan SHA riwayat yang diminta; download sendiri tidak mengubah base                                                                                               |
| Import cloud           | Validasi dan persiapan sebelum menulis; penggantian tabel draft dalam satu transaksi; tidak memanggil import/warm singleton editor                                                                     |
| Penerimaan pull        | Base diterapkan setelah import lokal berhasil; bila penerimaan gagal, upaya rollback mempertahankan edit lokal yang lebih baru                                                                         |
| Konflik                | Tidak retry force; tombol menawarkan unduhan cloud sebagai salinan untuk dibandingkan                                                                                                                  |
| Riwayat                | **Salinan** membuat dokumen dengan ID lokal baru tanpa binding atau perubahan base; **Pulihkan** mengganti draft terpilih setelah konfirmasi dan backup, tanpa mengubah base yang sudah dimiliki draft |
| Penggantian slot cloud | Draft yang belum tertaut perlu konfirmasi eksplisit; file cloud lama diverifikasi dan dibackup sebelum upload                                                                                          |
| Backup draft lokal     | Penggantian draft yang sudah ada dibackup dahulu; perubahan yang terjadi selama proses membatalkan penggantian                                                                                         |
| Akses KP               | Push KP ditolak pada UI dan service; pull paket yang tersedia tetap bisa mempertahankan data KP sebagai data lokal                                                                                     |

Backup berbentuk paket `.hightex` pada `<userData>/cloud-backups/<hash-scope-server-akun>/<sha-file>.hightex`. Tidak ada penghapusan backup otomatis pada langkah ini.

Import cloud membuat ID aset dan referensi terpisah agar key yang sama tidak menimpa dokumen lain. Referensi yang tidak tersedia tidak mengambil isi pustaka global dengan key serupa. Gambar lama yang masih dipakai draft lain dipertahankan. Gambar inline dimasukkan sebagai aset; PNG/JPEG dikonversi ke WebP melalui utilitas aplikasi yang sudah ada. Kategori yang tidak dikenali atau konten yang belum didukung editor ditolak sebelum menulis; paket tersebut masih dapat diperiksa melalui viewer hanya baca.

## Perbaikan Pendukung

- API preload/IPC cloud memakai argumen bertipe dengan ID sesi, menggantikan argumen posisi dan alias global lama.
- Aksi transfer dicegah berjalan ganda pada halaman; push bersamaan juga ditolak service. Hasil request dari halaman/sesi yang sudah berubah tidak dipasang ke konteks baru.
- Editor dokumen harus ditutup sebelum push atau mengganti draft melalui pull/restore, untuk menghindari penulisan bersamaan dari editor.
- Detail teknis menampilkan SHA server dan base SHA draft terpilih secara terpisah.
- Batas catatan commit disesuaikan dengan backend: 255 karakter.
- Pembacaan kategori menerima cache JSON maupun objek respons API, tanpa fallback diam-diam ke kategori pertama pada import cloud.
- Mode development menggunakan alamat loopback `127.0.0.1:8000`.
- Export menyertakan semua bab tersimpan; writer baru digunakan setiap kali agar bab/gambar yang dihapus tidak tertinggal pada pemakaian exporter yang sama. Aset yang direferensikan tetap dikemas meskipun berasal dari penyimpanan gambar bersama lama.

## Breaking Changes dan Migrasi

1. **Hash cloud sekarang SHA-256 seluruh byte ZIP.** Client lama menghitung hash sebagian JSON. Paket cloud dengan label hash lama yang tidak sama dengan byte file ditolak oleh reader cloud baru; tidak otomatis diterapkan ke draft. Ini perlu pemulihan/migrasi hash backend yang terverifikasi. Jangan menghapus database lokal untuk mengatasinya. Penggantian slot yang file lamanya gagal diverifikasi juga dihentikan agar tidak melewati langkah backup terverifikasi.
2. **Base/alias global lama tidak diadopsi otomatis.** Scope akun/server asalnya tidak dapat dipastikan. Nilai lama tetap disimpan sebagai cadangan, sedangkan binding baru memakai Electron Store `document-sync-v2`. Untuk file dengan hash yang valid, unduh cloud sebagai dokumen lokal terpisah untuk membentuk binding baru; draft lama tetap tersedia. Memilih draft lain untuk mengganti slot cloud memerlukan konfirmasi dan backup.
3. **API internal `window.hightex.cloud` berubah.** Main, preload dan renderer harus memakai build yang sama. Restart aplikasi/development; refresh renderer saja tidak cukup. Endpoint backend tidak diubah.
4. **Perilaku riwayat dan transfer berubah.** Unduhan riwayat menjadi salinan baru; overwrite tersedia melalui **Pulihkan** dengan konfirmasi. Tutup editor sebelum transfer dokumen terkait. Catatan yang sebelumnya bisa diisi sampai 500 karakter dibatasi 255 sesuai server.
5. **Push KP sekarang dibatasi secara eksplisit.** Dukungan workflow/kategori KP server belum dikonfirmasi; penggunaan lokal tetap tersedia.
6. **Byte export berubah sekali karena writer baru.** Timestamp dinamis di `meta/export.json` dihapus, waktu ZIP ditetapkan, dan `version: 2` ditambahkan. File baru tetap schema v2; reader lama yang mengabaikan field tambahan tetap dapat membacanya. Tidak ada migrasi IndexedDB tambahan pada langkah ini.

## Validasi Otomatis

- **74 test lolos, 0 gagal**, 14 file test dan 285 assertion.
- Mencakup refresh tidak mengubah base, konflik A/B, hash/header salah, backup gagal, pembatasan KP, scope akun/server/dokumen, serta respons push setelah logout.
- Test IndexedDB mencakup transaksi gagal, rollback penerimaan, perubahan lokal bersamaan termasuk gambar dengan ukuran sama, pemisahan key aset/referensi, aset bersama lama, penulis paket lama, kategori web v1 dan data KP.
- Test exporter membuktikan byte stabil untuk data yang sama, hash mencakup gambar/foto, manifest kompatibel, dan writer tidak membawa entry yang sudah dihapus.
- Typecheck dan lint kode inti terkait lolos. Build renderer, Electron main, dan preload lolos dengan warning ukuran chunk di atas 500 kB.

## Pengujian Server Lokal

Script opt-in: `bun run tests/integration/local-server.ts`. Akun demo student/advisor ditulis langsung pada konstanta `demoAccounts`, sesuai arahan pengguna. Script tidak membaca atau mem-parse `demo-user`; file tersebut hanya konteks awal untuk agen. Mode default membaca daftar/file yang tersedia lalu mencabut token uji. Password demo tidak dicetak; token diperoleh saat login dan tidak disimpan sebagai fixture. Perbaikan ini tidak menambah breaking changes.

Mode `--sync` membuat fixture hanya jika slot cloud student masih kosong; script berhenti bila sudah ada commit. Mode ini **menulis data demo**, sehingga tidak dijalankan otomatis oleh `bun test`.

Hasil aktual:

- Login student/advisor berhasil; daftar submission sesuai bentuk respons masing-masing, keduanya kosong. File submission yang tidak tersedia menghasilkan `404`. Pencabutan token uji menghasilkan `200`.
- Slot cloud student awalnya kosong. Push A berhasil, pull menghasilkan byte identik dengan hash terverifikasi, dan profil paket terbaca.
- Client kedua dengan penyimpanan base terpisah menerima A lalu push B. Client pertama refresh riwayat, tetap mempunyai base A, lalu push perubahan C memperoleh `409`.
- Unduh riwayat A tidak mengubah base. Pull B terverifikasi, lalu pengiriman artifact B yang sama menghasilkan `changed: false`.
- Server demo kini berisi **Codex sync demo versi B**, dengan versi A dalam riwayat. Tidak ada submission dibuat. Repository backend tidak diubah.

## Batas yang Masih Ada

- **Belum diuji lewat GUI aplikasi atau PDF aktual.** Konversi gambar PNG/JPEG memerlukan pemeriksaan melalui renderer; unit test aset inline memakai WebP.
- Snapshot submission nyata belum tersedia pada akun demo, sehingga uji positif viewer server sebagai advisor masih menunggu fixture/workflow submission. Uji cloud bukan pengganti uji file submission.
- Backend saat ini mempercayai hash yang dikirim client dan pemeriksaan base belum memakai lock/CAS atomik. Pengujian dua client di atas berurutan; tidak menjamin dua request push yang benar-benar serentak aman. Verifikasi hash server dan penguncian perubahan file/commit memerlukan perubahan backend tersendiri.
- API masih memakai satu slot dokumen akun, tanpa target ID bersyarat pada push. Desktop memeriksa slot sebelum/sesudah request dan mengirim base, tetapi jaminan atomik atas ID target memerlukan kontrak server.
- Saat upload sudah diterima lalu konfirmasi commit gagal/berubah, desktop tidak menganggap base lokal berhasil diperbarui. Muat ulang dan periksa server sebelum retry.
- Import dapat memetakan ulang ID lokal/aset/referensi untuk isolasi. Export ulang hasil import tidak dijanjikan identik byte dengan paket server; export berulang atas state lokal yang sama bersifat stabil.
- Tidak mencakup pengajuan submission, komentar/transisi review, login browser, profil online, maupun compiler/PDF snapshot.

## Cara Review

1. Restart `bun run dev` agar main/preload baru dimuat. Login demo student yang tercantum pada `demoAccounts` di script integrasi, lalu buka **Dokumen cloud**.
2. Unduh fixture versi B. Pada daftar dokumen lokal, periksa konten, penulis dan CV dari paket. Draft lain tidak boleh berubah. Buka **Detail teknis** untuk membandingkan SHA server dan base draft.
3. Tutup editor, simpan versi, lalu simpan lagi tanpa perubahan. Pengiriman kedua harus melaporkan versi sudah tersedia. Ganti hanya foto/gambar; pengiriman berikutnya harus dianggap perubahan.
4. Pada dua instance/perangkat uji yang memakai akun sama: keduanya ambil A; perangkat kedua simpan B; perangkat pertama refresh lalu push edit A. Harus muncul konflik. **Unduh salinan cloud** tidak boleh menimpa edit lokal perangkat pertama.
5. Coba **Salinan** dan **Pulihkan** dari riwayat. Salinan memakai ID baru; pemulihan meminta konfirmasi, menyimpan backup, dan mempertahankan base draft.
6. Pilih dokumen lain untuk mengganti slot cloud. Periksa konfirmasi dan file backup. Coba juga batal pull, offline, editor masih terbuka, pergantian akun, kategori tidak dikenal, dan KP.

Panduan tambahan: [tests/manual-test.md](../../tests/manual-test.md). Langkah 4 menunggu review fitur ini.
