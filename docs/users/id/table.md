# Table

HighTex menyediakan dua jenis tabel: **Standalone Table** dan **Figure Table**.

## Standalone Table

Standalone Table adalah tabel berbentuk grid yang digunakan untuk **layouting** atau mengatur susunan konten.

Karakteristik:

* Tidak memiliki border.
* Tidak memiliki header.
* Tidak memiliki caption.
* Tidak perlu dirujuk di dalam dokumen.
* Digunakan hanya untuk kebutuhan layouting.

## Figure Table

Figure Table digunakan untuk tabel yang merupakan bagian dari isi dokumen dan perlu dirujuk.

Karakteristik:

* Wajib memiliki header.
* Memiliki caption.
* Wajib dirujuk apabila digunakan sebagai referensi di dalam dokumen.
* Memiliki penomoran tabel secara otomatis.

### Shortcut

Gunakan shortcut berikut untuk membuat Figure Table:

`!tab.{col}.{row}.{caption}`

Contoh:

`!tab.3.4.Data_Mahasiswa`

Shortcut tersebut akan membuat tabel dengan **3 kolom**, **4 baris**, dan caption **"Data Mahasiswa"**.
