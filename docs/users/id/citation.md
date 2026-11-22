# Merujuk dengan Citation

Citation digunakan untuk merujuk sumber atau referensi yang tersimpan di HighTex. Citation yang digunakan di dalam dokumen akan menjadi dasar untuk menghasilkan **Daftar Pustaka secara otomatis**.

Terdapat dua cara untuk menambahkan citation ke dalam editor.

## Shortcut

Gunakan shortcut dengan mengetik **`@`** atau **`#`** di dalam editor.

HighTex menampilkan referensi lokal. Jika integrasi Zotero diaktifkan, pencarian
juga mengambil hasil dari Zotero Desktop. Ketik judul, penulis, tahun, DOI, atau
key referensi; beberapa kata dapat digabung, misalnya `garcia editor 2026`.
Pilih hasil dengan klik atau tombol panah dan Enter. Tekan Escape untuk menutup.
Popup `@`/`#` juga memiliki input pencarian. Klik input itu untuk mencari tanpa
menambahkan kata pencarian ke isi dokumen.

Contoh:

```text
Penelitian sebelumnya menunjukkan bahwa @
```

Setelah mengetik `@`, daftar citation akan muncul dan dapat dipilih.

Shortcut **`#`** juga dapat digunakan dengan cara yang sama.

## Manual

Citation juga dapat dimasukkan melalui **Sidebar**.

Letakkan kursor di posisi yang diinginkan, buka tab **Citation**, lalu tekan
**Tambah sitasi**. Modal menyediakan input pencarian referensi lokal dan Zotero.
Hasil Zotero yang dipilih disimpan ke pustaka lokal sebelum dimasukkan ke dokumen.
Jika Zotero tidak tersedia, referensi lokal tetap bisa dicari dan digunakan.

Cara salin-tempel tetap tersedia:

1. Buka **Sidebar**.
2. Masuk ke tab **Citation**.
3. Cari citation yang ingin digunakan.
4. Tekan tombol **Copy** pada citation tersebut.
5. Pindahkan kursor ke posisi yang diinginkan di editor.
6. **Paste** citation tersebut.

Citation yang sudah dimasukkan ke dalam dokumen akan dikenali oleh HighTex dan digunakan untuk menghasilkan **Daftar Pustaka otomatis**.

Modal **Impor dari Zotero** juga menyediakan pencarian, termasuk referensi di luar
daftar yang pertama kali dimuat. Pilih hasilnya, lalu impor.

Referensi lokal yang masih dipakai dalam dokumen tidak dapat dihapus. HighTex
menampilkan dokumen dan bab yang menggunakannya, termasuk sitasi berkelompok dan
sitasi di dalam tabel.

> **Penting:** Jangan hanya menuliskan referensi secara manual di dalam dokumen. Agar sumber masuk ke Daftar Pustaka otomatis, sumber tersebut harus digunakan melalui citation HighTex.
