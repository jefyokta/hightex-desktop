# Daftar Pustaka

Daftar pustaka pada dokumen HighTex **dibuat secara otomatis** berdasarkan referensi yang digunakan atau dirujuk di dalam dokumen.

Artinya, daftar pustaka tidak perlu ditulis atau disusun secara manual. HighTex akan mengumpulkan sumber yang digunakan melalui **citation (`cite`)** yang terdapat di dalam dokumen, kemudian menghasilkan daftar pustaka berdasarkan sumber-sumber tersebut. membuat citation dapat dilihat pada halaman [citation](./citation.md)

## Cara Kerja

Daftar pustaka hanya akan berisi sumber yang benar-benar digunakan dalam dokumen.

Alurnya adalah:

1. Tambahkan atau masukkan data referensi ke dalam pengelola referensi HighTex.
2. Gunakan referensi tersebut di dalam dokumen melalui fitur **Cite**.
3. HighTex mencatat referensi yang digunakan.
4. Saat dokumen dirender, HighTex secara otomatis membuat bagian **Daftar Pustaka** berdasarkan citation yang terdapat di dokumen.

Contohnya, apabila sebuah dokumen menggunakan tiga sumber:

* `Sumber A`
* `Sumber B`
* `Sumber C`

dan ketiganya dirujuk menggunakan citation di dalam isi dokumen, maka ketiga sumber tersebut akan muncul pada daftar pustaka.

Sebaliknya, sumber yang hanya tersedia di pengelola referensi tetapi **tidak pernah digunakan atau dirujuk di dalam dokumen tidak akan otomatis dimasukkan** ke dalam daftar pustaka.

## Citation Menentukan Isi Daftar Pustaka

Daftar pustaka mengikuti referensi yang digunakan dalam dokumen, bukan seluruh referensi yang tersedia.

Misalnya, dokumen memiliki lima referensi:

```text
Referensi A
Referensi B
Referensi C
Referensi D
Referensi E
```

Tetapi di dalam isi dokumen hanya terdapat citation untuk `Referensi A` dan `Referensi C`.

Maka daftar pustaka yang dihasilkan adalah:

```text
Referensi A
Referensi C
```

`Referensi B`, `Referensi D`, dan `Referensi E` tidak akan muncul karena tidak digunakan sebagai citation di dalam dokumen.

## Jangan Menulis Daftar Pustaka Secara Manual

**Jangan menuliskan daftar pustaka secara manual di dalam isi dokumen.**

HighTex tidak menggunakan teks manual tersebut sebagai sumber untuk menghasilkan daftar pustaka otomatis.

Jika seluruh citation dan daftar pustaka ditulis secara manual, misalnya:

```text
Menurut penelitian A (2024), ...
```

kemudian pengguna juga mengetik sendiri pada bagian lain di dalam dokumen:

```text
A. Penulis. 2024. Judul Penelitian...
```

HighTex tidak akan menganggap teks tersebut sebagai citation dan referensi yang digunakan.

### Akibatnya

Jika **semua referensi dan daftar pustaka ditulis secara manual tanpa menggunakan fitur Cite**, maka **Daftar Pustaka otomatis akan kosong**.

Hal ini memang merupakan perilaku yang diharapkan, karena HighTex hanya dapat membuat daftar pustaka dari referensi yang diketahui melalui citation di dalam dokumen.

## Contoh Penggunaan yang Benar

Tuliskan sumber pada pengelola referensi, kemudian gunakan fitur **Cite** ketika ingin merujuk sumber tersebut di dalam dokumen.

Contoh isi dokumen:

```text
Penelitian mengenai sistem informasi menunjukkan bahwa
penggunaan sistem terintegrasi dapat meningkatkan efisiensi
pengelolaan data [citation].
```

Citation tersebut kemudian menjadi dasar bagi HighTex untuk memasukkan sumber terkait ke dalam daftar pustaka.

Hasil akhirnya akan menjadi daftar pustaka yang dibuat secara otomatis.

## Jika Daftar Pustaka Kosong

Jika bagian **Daftar Pustaka** kosong, periksa hal-hal berikut:

* Apakah dokumen memiliki citation?
* Apakah citation dibuat menggunakan fitur **Cite** HighTex?
* Apakah citation tersebut merujuk ke referensi yang valid?
* Apakah referensi sudah tersedia di pengelola referensi?

Jika tidak ada citation yang digunakan dalam dokumen, maka tidak ada sumber yang dapat digunakan HighTex untuk membuat daftar pustaka.

## Ringkasan

> **Daftar pustaka HighTex bersifat otomatis dan bergantung pada citation yang digunakan di dalam dokumen.**

Gunakan **Cite** untuk setiap sumber yang dirujuk. Jangan mengetik daftar pustaka secara manual.

**Citation → Referensi yang digunakan → Daftar Pustaka otomatis**

Jika semua citation dan daftar pustaka ditulis secara manual, HighTex tidak dapat mendeteksi sumber yang digunakan sehingga **daftar pustaka otomatis akan kosong**.
