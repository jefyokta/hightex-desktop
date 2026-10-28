# Membuka dokumen dari website

Gunakan deeplink berikut untuk tombol **Buka di HighTex**:

```js
const documentUrl = "https://example.com/doc.hightex?token=abc&version=2";
const link = document.querySelector("#open-hightex");
link.href = `hightex://document?url=${encodeURIComponent(documentUrl)}`;
```

```html
<a id="open-hightex">Buka di HighTex</a>
```

Parameter `url` harus di-encode agar query string URL unduhan tetap utuh.
`hightex://document?url=example.com/doc.hightex` juga didukung dan memakai HTTPS.
URL HTTP dan HTTPS didukung. Endpoint harus mengembalikan arsip HighTex secara
langsung; unduhan tidak menggunakan cookie atau sesi login browser. Gunakan URL
publik atau signed URL bila dokumen memerlukan akses khusus.

Desktop mengunduh dan memvalidasi arsip sebelum menyimpannya di
`userData/imported-documents/<uuid>.hightex`, kemudian menggunakan importer lokal
dan membuka window editor. Arsip disimpan sebagai file kerja agar perubahan
berikutnya dapat disimpan. Dokumen dengan ID yang sudah ada meminta konfirmasi
sebelum ditimpa; pembatalan mempertahankan dokumen lokal. Arsip unduhan tetap
tersimpan meskipun pengguna membatalkan impor.

Batas unduhan mengikuti `DEFAULT_IMPORT_LIMITS.maxArchiveBytes` dari importer
(saat ini 64 MiB), dengan timeout 60 detik. Kegagalan unduh atau validasi
ditampilkan lewat dialog desktop; kegagalan impor ditampilkan lewat toast.

Router mengembalikan 202 setelah file dikirim untuk impor, 400 untuk URL tidak
valid, 404 untuk path tidak dikenal, 502 untuk unduhan gagal, 422 untuk arsip
tidak valid, dan 500 untuk kegagalan penyimpanan atau pembukaan window.

Verifikasi manual pada aplikasi yang sudah terpasang:

1. Klik link dari browser saat aplikasi belum berjalan; dokumen harus terimpor
   dan window editor terbuka.
2. Ulangi saat aplikasi berjalan, diminimalkan, dan (macOS) window utama ditutup.
3. Uji signed URL yang mengandung `&`, `+`, dan `=` setelah di-encode.
4. Buka dokumen yang sama, lalu batalkan konfirmasi; isi lokal harus tetap utuh.
5. Uji URL 404, unduhan HTML, dan file rusak; tampilkan error tanpa impor.

Registrasi OS untuk skema `hightex` sudah disediakan konfigurasi Electron Builder.
