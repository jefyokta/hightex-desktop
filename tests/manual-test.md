## Tests bellow are the tests that should i do manually

### Network Condition

- offline
  test whole function that calling network, ensure its catched perfectly

### Penulis per dokumen — langkah pertama

Jalankan aplikasi dengan `bun run dev`. Gunakan dua dokumen uji A dan B.

1. Buka editor A → sidebar **Setting** → **Penulis dokumen**. Isi nama, NIM, pembimbing, lalu gunakan tombol Simpan di header sidebar. Ulangi untuk B dengan identitas berbeda.
2. Buka bab **Daftar Riwayat Hidup** pada masing-masing dokumen. Ketik CV berbeda dan pilih foto berbeda. CV/foto disimpan otomatis. Jika ingin memakai CV/foto lama, gunakan **Ambil CV dan foto default** lalu tinjau konfirmasinya.
3. Periksa preview **Full Document** dan export PDF A/B. Cover, variabel nama/NIM/pembimbing, CV, foto, dan metadata penulis harus mengikuti dokumen masing-masing. Ganti profil default pada Settings; A/B tidak boleh ikut berubah.
4. Export A sebagai `.hightex`, lalu import pada profil/perangkat uji lain. Identitas penulis, CV, foto, konfigurasi KP dan keyword dua bahasa harus tetap sama. Paket tanpa profil harus menampilkan data penulis belum lengkap, tanpa memakai identitas akun/default yang membuka file.
5. Uji KP: isi pembimbing kampus pada Penulis dokumen, pembimbing instansi pada bagian KP. Kosongkan data instansi; preview tidak boleh menampilkan pembimbing kampus atau NIP bawaan sebagai pengganti pembimbing instansi.
6. Saat pengaturan A terbuka, ubah CV/fotonya lalu simpan pengaturan. Perubahan CV/foto harus tetap ada. Uji juga rename dokumen dari dashboard setelah mengubah profilnya di editor.
7. Tutup lalu buka aplikasi dan periksa A/B kembali. Dokumen lama tanpa profil memerlukan peninjauan identitas per dokumen. Profil default dan tabel variabel lama dipertahankan; jangan menghapus data aplikasi untuk menyelesaikan migrasi.

Pengujian otomatis ada di `document-profile.test.ts`, mencakup database asli melalui IndexedDB pengujian, migrasi v1 → v2, pemisahan variabel, penulisan bersamaan, dan round-trip archive. Tampilan dan export PDF aktual tetap perlu diperiksa melalui aplikasi.

### Snapshot submission hanya baca — langkah kedua

Restart aplikasi development dengan `bun run dev` agar handler IPC baru ikut dimuat.

1. Export dokumen A/B yang memiliki identitas, CV, foto, gambar, variabel, dan referensi berbeda. Buka **Cloud → Submissions → Buka .hightex untuk dibaca**. Fitur file lokal dapat dicoba tanpa login, termasuk saat offline.
2. Periksa **Data penulis**, setiap bagian, **Daftar Riwayat Hidup**, dan **Referensi dalam file**. Tidak ada kontrol mengedit dokumen. Paket tanpa profil harus menandai data belum tersedia, tanpa memakai profil akun yang membuka.
3. Kembali ke draft A/B dan pastikan konten serta data penulisnya tidak berubah. Buka file dengan ID dokumen, key referensi, dan ID gambar yang sama untuk memastikan data tidak saling tercampur.
4. Masuk sebagai advisor yang mempunyai submission aktif pada server pengujian. Antrean diambil dari server; klik **Baca snapshot**. Nama/identitas dalam viewer harus berasal dari paket mahasiswa, sementara akun login tetap advisor.
5. Masuk sebagai mahasiswa dan periksa riwayat dari endpoint yang sama. Akun multi-role mengikuti respons/permission server; belum ada pemilih konteks untuk memaksa riwayat mahasiswa ketika server memprioritaskan antrean advisor.
6. Coba file rusak, format tidak didukung, submission lama tanpa file, atau akun tanpa akses. Pesan gagal harus jelas. Respons `403` file submission tidak otomatis mengeluarkan akun.
7. Logout atau ganti akun selama unduhan; hasil permintaan lama tidak boleh muncul pada sesi baru. Putuskan internet ketika snapshot server terbuka; viewer server ditutup sampai akses online dapat diperiksa kembali.
8. Unduh `.hightex` dari viewer ke lokasi uji. Byte file harus sama dengan file asli/snapshot, bukan export ulang yang mengubah profil/metadata.

Viewer langkah kedua menampilkan isi paket per bagian; pagination, halaman depan yang dihasilkan compiler, dan layout PDF final belum menjadi bagian fitur ini. Referensi yang valid diformat dari data dalam paket; gambar yang hanya menunjuk URL eksternal ditandai tidak tersedia dan tidak diunduh otomatis.

Test otomatis tambahan: `submission-client.test.ts` dan `review-snapshot.test.tsx`. Test mencakup kontrak API yang diperiksa dari source backend, integritas file, sesi lama, render identitas/citation per snapshot, serta pembuktian bahwa tabel draft dan dokumen editor aktif tidak berubah.

### Sinkronisasi cloud — langkah ketiga

Restart aplikasi dengan `bun run dev`; mode development memakai server lokal `127.0.0.1:8000`. Gunakan akun demo yang tercantum pada konstanta `demoAccounts` di `tests/integration/local-server.ts`. File `demo-user` hanya konteks awal, bukan dependensi test. Jangan salin password/token ke hasil pengujian.

1. Buka **Dokumen cloud** dengan akun student. Fixture **Codex sync demo** versi B sudah dibuat melalui uji integrasi; versi A tersedia di riwayat. Belum ada submission dari pengujian ini.
2. Unduh versi terbaru. Jika belum tertaut, aplikasi membuat dokumen lokal baru tanpa mengganti dokumen lama yang kebetulan memiliki ID paket sama. Periksa data penulis/CV dari paket dan buka **Detail teknis** untuk melihat SHA server serta base draft.
3. Tutup editor dokumen sebelum transfer. Simpan dua kali tanpa perubahan; penyimpanan kedua harus melaporkan versi sudah tersedia. Ganti hanya gambar atau foto lalu simpan: hash harus berubah.
4. Gunakan dua instance/perangkat uji dengan akun sama. Keduanya menerima A; perangkat kedua mengirim B; perangkat pertama memuat ulang riwayat lalu mengirim edit dari A. Hasil wajib konflik. Unduhan salinan cloud dari pesan konflik harus membuat salinan B, dengan edit draft A tetap utuh.
5. Pada riwayat, **Salinan** selalu membuat ID lokal baru dan tidak mengubah binding/base. **Pulihkan** mengganti dokumen yang dipilih setelah konfirmasi dan backup; base draft dipertahankan sehingga konflik berikutnya tetap terdeteksi bila cloud sudah berubah.
6. Pull terbaru yang mengganti draft tertaut meminta konfirmasi. Batalkan: konten dan base harus tetap sama. Terima: backup disimpan pada `<userData>/cloud-backups/<scope>/<sha>.hightex`; file dapat dibuka melalui viewer/import lokal.
7. Pilih dokumen berbeda dari yang tertaut lalu simpan. Harus ada konfirmasi penggantian satu slot cloud akun dan backup paket server sebelum upload. Kegagalan backup harus menghentikan upload.
8. Coba offline, logout/berganti akun saat request berjalan, editor masih terbuka, kategori paket tidak dikenal, atau push KP. Respons lama tidak boleh mengikat dokumen ke akun baru; pesan harus menjelaskan penyebab operasi dihentikan.
9. Untuk file cloud lama dengan hash sebagian JSON, reader baru menolak hash yang tidak cocok dengan byte ZIP. Jangan menghapus draft atau database. Migrasi label hash backend perlu ditangani terpisah; penggantian slot juga dihentikan bila backup tidak dapat diverifikasi.

Otomatis: `bun test`. Integrasi read-only: `bun run tests/integration/local-server.ts`. Opsi `--sync` menulis fixture dan hanya boleh digunakan pada slot demo yang kosong; script sengaja berhenti bila sudah ada commit. Hasil lengkap, breaking changes dan keterbatasan atomicity backend ada di `docs/codex-impl-summary/STEP_3_SUMMARY.md`.
