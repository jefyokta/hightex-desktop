# Perbaikan Viewer Submission

Dasar perubahan: `c4ed03d`. Perbaikan ini belum di-commit dan bukan implementasi workflow submission langkah 4.

## Hasil

Viewer submission memakai `FullDocument` dan `PrintableProvider` lama untuk menampilkan dokumen penuh: cover, halaman depan, bab, daftar isi, CV/foto dan referensi mengikuti preview dokumen biasa. Pemilih bagian dari viewer sebelumnya diganti toolbar preview penuh dengan zoom, refresh dan indikator layout.

Perubahan compiler, resolver, hook cetak, layout cetak dan preview editor dari percobaan sebelumnya sudah dibatalkan. File-file tersebut tidak diubah oleh perbaikan ini. Perubahan pengguna yang sudah ada tetap dipertahankan.

## Perubahan

- Route khusus `/submission/print/:id` berjalan di iframe. Data paket diberikan lewat handshake yang memeriksa frame, origin dan ID permintaan.
- Adapter viewer mengisi database **dalam memori iframe** dari snapshot terverifikasi. Komponen cetak lama membaca database ini melalui factory di realm iframe tersebut; factory dan database draft pada jendela utama tetap seperti sebelumnya.
- Profil penulis, CV/foto, bab, gambar, referensi, variabel, alias dan tanggal berasal dari paket. Dua paket dengan ID lokal sama tetap terpisah. Profil akun pembaca tidak menjadi pengganti data penulis.
- Stylesheet/font disiapkan sebelum pagination memakai utilitas lama `createElementFromUrl`, tanpa membuat loader `<link>` sendiri. Pada development, URL memakai `direct` agar fetch utilitas menerima CSS, bukan modul HMR JavaScript. Utilitas bersama dan layout cetak lama tidak diubah; koreksi ini tidak menambah breaking changes.
- Loading selesai ketika pesan `page:rendered` diterima. Sebelumnya overlay bisa tetap menutupi dokumen yang sudah selesai dirender.
- Zoom memakai transform pada elemen iframe; tidak memasang `document.zoom` atau `body.style.zoom`. Pagination tetap dihitung pada ukuran dokumen asli.
- Unduhan tetap menyimpan byte paket asli, bukan export ulang.
- `fake-indexeddb` yang sudah tersedia dipindah dari dev dependency ke runtime dependency untuk penyimpanan sementara viewer; versinya tetap.

## Breaking Changes dan Kompatibilitas

- **Perubahan tampilan:** pemilih bagian/halaman data penulis diganti preview penuh sesuai permintaan. Tidak ada perubahan endpoint backend, kontrak IPC, format archive atau schema database draft; tidak perlu migrasi data.
- **Kategori harus dikenali:** paket dengan kategori yang tidak tersedia menampilkan pesan gagal. Viewer tidak memilih template kategori lain secara otomatis.
- Dukungan node, tata letak dan nilai bawaan template mengikuti preview lama. Perbaikan ini tidak memperluas kemampuan compiler untuk node atau template baru.

## Validasi

- `bun test`: **79 lolos, 0 gagal**, 313 assertion. Lima tes tambahan memeriksa isolasi penyimpanan/penulis, referensi paket, profil yang tidak tersedia, kategori dan gambar eksternal.
- Typecheck, lint file terkait dan build renderer/main/preload diperiksa. Build memiliki warning ukuran chunk yang sudah ada.
- Uji Electron dengan profil sementara membandingkan preview biasa dan snapshot untuk fixture skripsi, proposal dan KP. Jumlah halaman fixture: **16, 8 dan 13**. Teks setiap halaman, ukuran halaman, font dan gambar cocok; screenshot viewport identik piksel. Database draft tetap sama setelah membuka snapshot A lalu B dengan ID yang sama.
- Pada development, komponen viewer aktual juga diuji: loading hilang, CV tampil, tidak ada CSS zoom pada body, dan perubahan slider tidak mengubah jumlah halaman.
- Setelah koreksi ke `createElementFromUrl`, typecheck, lint loader, build dan perbandingan Electron tiga kategori di development/produksi dijalankan ulang dan lolos. Uji komponen viewer aktual di development juga tetap lolos.
- Script opt-in: `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tests/integration/preview-equivalence.cjs`; tambahkan `--dev` untuk menguji mode Vite serta komponen viewer aktual. Script menggunakan data/profil sementara tanpa backend atau akun pengguna.

## Cara Review dan Batas

1. Buka **Cloud → Submissions → Buka .hightex untuk dibaca** dengan paket yang sama seperti draft lokal.
2. Bandingkan cover, seluruh bab, daftar isi, CV/foto dan referensi dengan preview penuh draft. Coba zoom, indikator layout dan refresh; loading harus selesai.
3. Buka paket mahasiswa lain dengan ID lokal sama. Identitas harus mengikuti paket kedua; kembali ke draft untuk memastikan isinya tetap.
4. Simpan salinan `.hightex`; byte harus sama dengan paket asal.

Uji di atas memakai fixture Electron. Snapshot submission nyata dari server sebagai advisor masih menunggu data submission yang tersedia. Export PDF snapshot, pengajuan mahasiswa dan aksi review advisor belum termasuk. KP diuji sebagai paket lokal; dukungan KP server tidak berubah.
