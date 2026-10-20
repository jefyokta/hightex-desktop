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
