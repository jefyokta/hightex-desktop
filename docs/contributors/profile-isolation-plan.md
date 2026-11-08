# Isolasi profil workspace

Tanggal: 8 November 2026. Prioritas: profil → form → UI branch comparison.

## Keputusan

- Origin internal memakai `hightex://profile.<profileId>`, tanpa `.local`. Status lokal/cloud menjadi atribut profil.
- Satu profil cloud memiliki satu server dan satu identitas akun. Profil lokal tidak memiliki akun cloud. Akun pertama yang login mengikat profil; logout dan expiry tidak melepas ikatan tersebut.
- Profil workspace berbeda dari profil penulis. Data penulis dalam dokumen dan arsip `.hightex` tetap dipertahankan.
- Instalasi baru langsung membuat profil lokal dan melewati migrasi. Update yang masih memiliki penyimpanan legacy membuka halaman migrasi; penanda selesai mencegah migrasi ulang setelah berhasil.
- Migrasi mengelompokkan berdasarkan binding server/akun; dokumen tanpa binding masuk Lokal dan branch mengikuti induknya.
- Akses SQLite untuk data snapshot, komentar, dan dosen memakai model `Snapshot`, `Comment`, dan `LocalLecturer` dengan koneksi tujuan yang eksplisit.

## Penyimpanan dan lifecycle

Registry berada di `<userData lama>/workspaces.json`. Registry menyimpan ID stabil, nama, server, account ID, profil aktif, serta status migrasi; tidak menyimpan token.

Bootstrap memilih `<root>/workspaces/<profileId>` sebagai `userData` sebelum mengimpor modul layanan. Dengan begitu electron-store, SQLite, foto default, token terenkripsi, snapshot, file impor sementara, serta backup memakai direktori profil. Ini diperlukan karena sebagian layanan membuka penyimpanan saat modul diimpor.

`sessionData` Chromium tetap di root instalasi. IndexedDB `HighTexDB` dan localStorage dipisahkan oleh origin profil. Database dokumen tidak perlu menambahkan filter profil pada setiap query. Dev mode juga memakai origin profil, dengan aset diproksikan ke Vite; pembacaan data legacy pada dev mode menggunakan origin Vite lama.

Hanya satu profil aktif per proses. Pergantian profil dilakukan dari jendela utama dan ditolak bila editor, preview, sharing, atau jendela lain masih terbuka. Pengguna menutup editor melalui close guard yang sudah ada terlebih dahulu. Setelah profil aktif tersimpan, aplikasi direlaunch sehingga singleton layanan, cache memori, dan request lama tidak dipindahkan ke profil baru. Lock single instance diambil pada root instalasi sebelum `userData` berubah.

IPC memeriksa origin pemanggil terhadap profil aktif. Selama migrasi, kanal transfer target juga memeriksa jendela yang telah ditetapkan oleh migrator. Setiap jendela editor/PDF/form memakai resolver URL aplikasi sehingga mengikuti origin profil aktif.

Profil dapat dibuat dan dipilih pada halaman Profil. Sidebar menyediakan pemilih profil. Profil lokal mengarahkan pengguna ke pengelolaan profil untuk menambahkan koneksi cloud.

## Migrasi update

1. Deteksi penyimpanan legacy dari metadata instalasi, konfigurasi, SQLite, kredensial/binding lama, atau IndexedDB origin lama. Tidak ada migrasi pada instalasi baru.
2. Baca seluruh tabel Dexie dalam satu transaksi baca dan ambil localStorage. Blob dikemas sebagai bytes beserta MIME; Date dipertahankan.
3. Tampilkan rencana pengelompokan sebelum migrasi. Binding ambigu tetap masuk Lokal dengan binding/penguncian aslinya setelah pengguna memilih tujuan tersebut. Hubungan induk yang hilang/berputar memerlukan keputusan eksplisit; hubungan rusak dilepas pada salinan hasil migrasi agar dokumen tetap dapat dibuka.
4. Simpan backup `workspace-migration-v1/source.bin`, salinan file konfigurasi/state terkait, serta backup konsisten SQLite. Penyimpanan sumber dan file aslinya tidak dihapus.
5. Salin dokumen dan seluruh data terkait ke origin target yang belum aktif. Gambar dan sitasi yang dirujuk lintas dokumen ikut disalin. Referensi/variabel global dan direktori dosen lama yang memang bersama disalin per profil; input form mengikuti dokumennya. File impor internal disalin ke direktori profil dan referensi path-nya diperbarui; path file ekspor di luar direktori impor internal tetap mengikuti pilihan pengguna.
6. Salin sesi terenkripsi hanya ke profil yang cocok dengan server/account sesi lama. Pending login browser tidak dipindahkan. Default penulis/foto lama tetap pada Lokal. Cache kategori tanpa asal host hanya disalin ke Lokal dan host sesi legacy yang cocok.
7. Salin database SQLite ke target, lalu gunakan model untuk menyaring snapshot/komentar menurut dokumen dan memperbarui lokasi file snapshot. Direktori dosen dipertahankan. Jalankan integrity check database target.
8. Muat halaman transfer pada setiap origin target. Restore IndexedDB dalam transaksi, restore localStorage, lalu baca kembali dan bandingkan SHA-256 isi lengkap dengan sumber terpilih, termasuk bytes aset.
9. Catat progres per profil dalam jurnal. Registry baru ditandai selesai setelah seluruh target terverifikasi; kemudian aplikasi direlaunch pada profil Lokal.

Migrasi tidak melakukan push, pull, submit, atau relink cloud. Server document ID, base hash, dan asal akademik dipertahankan pada tujuan yang sesuai. ID profil tidak ditambahkan ke arsip portabel.

Jika proses gagal, status migrasi tetap belum selesai dan target belum menjadi pustaka aktif. Startup berikutnya membaca sumber legacy yang masih utuh; target staging dapat diisi ulang tanpa membuat dokumen duplikat. Backup dan jurnal disimpan di root instalasi untuk pemulihan. Penghapusan sumber legacy tidak termasuk implementasi awal.

## Verifikasi

- `tests/workspaces.test.ts`: origin/URL, fresh install versus update, registry/ikatan akun, grouping host/akun, parent/branch, konflik, serta pemilihan aset dan input form.
- `tests/integration/workspace-profiles.cjs`: Electron dengan profil sementara; transfer antar-origin, Blob/Date, SQLite melalui model, sesi terenkripsi sesuai akun, sumber utuh, IPC, serta guard pergantian.
- `tests/integration/workspace-profiles.cjs --startup`: smoke test main/preload/renderer hasil build, origin baru pada instalasi bersih, direktori data profil, dan halaman pengelolaan profil.

Perintah integrasi memakai Electron dengan `ELECTRON_RUN_AS_NODE` dihapus dari environment dan tidak memakai data/akun pengguna. Jalankan build sebelum smoke test startup.

Hasil 8 November 2026: 409 tes unit, TypeScript, lint file terkait, dan build Vite renderer/main/preload lolos. Integrasi Electron dan smoke test startup hasil build juga lolos. Skenario integrasi menyuntikkan hash verifikasi yang salah, memastikan target tidak diaktifkan, lalu mengulang migrasi tanpa duplikasi; binding/base hash, file impor internal, serta sumber legacy diperiksa tetap utuh. Pengujian ini memakai akun/host fixture, bukan login ke server cloud aktif.

## Pekerjaan berikutnya

- Input form bersama per workspace menggantikan penyimpanan per dokumen, dengan kebijakan migrasi input yang berbeda.
- UI branch comparison mengikuti tampilan editor.
- Dukungan beberapa profil aktif serentak dan transfer antarprofil langsung lewat UI merupakan pengembangan terpisah. Export/import `.hightex` tetap menjadi jalur salinan eksplisit.
