# Rencana revisi isolasi profil workspace

Status: usulan desain untuk ditinjau sebelum implementasi.

Dokumen ini memperbarui arah pada [rencana isolasi profil](./profile-isolation-plan.md) berdasarkan catatan di [`revisi-profile.md`](../../revisi-profile.md). Implementasi belum dimulai. Setelah desain disetujui, checklist di [`todo.md`](../../todo.md) perlu disesuaikan dengan urutan di bawah.

## Jawaban untuk catatan revisi

| Catatan | Jawabanku | Dampak ke desain |
| --- | --- | --- |
| 1. Nama tidak boleh nama host; harus nama profil. | Setuju. Nama adalah label buatan pengguna seperti `Skripsi` atau `Riset`; host, jenis Cloud/Lokal, dan akun hanya metadata terpisah. | ID profil tetap stabil dan tidak diturunkan dari nama. Endpoint tidak menentukan judul kartu profil. |
| 2. Bagaimana kalau editor masih terbuka saat profil diganti dari main window? | Jangan mengganti profil atau relaunch hanya berdasarkan klik. Main process harus meminta semua window menyelesaikan close guard dan penyimpanan, lalu menunggu persetujuan tiap window. | Jika ada dokumen kotor, penutupan dibatalkan, atau window tidak merespons, switch batal dan profil aktif tidak berubah. Pembukaan window baru ditahan selama proses switch. |
| 3. UI profil kenapa tidak di halaman Profile saja? | Setuju; semua pengelolaan workspace dipusatkan di `/profile`. | Hapus pemilih profil dari sidebar. Sidebar menyisakan tautan Profile dan nama workspace aktif sebagai label. Halaman Profile memisahkan pengaturan workspace dari profil penulis dokumen. |
| 4. Profil Cloud harus meminta login saat token expired. | Setuju untuk aksi yang mengakses server. Offline sendiri tidak berarti token expired dan tidak boleh memaksa login. | Data lokal tetap bisa dipakai. Jika offline, aksi server memberi pesan butuh koneksi; jika online dan token kedaluwarsa/ditolak, minta login. Binding akun dan dokumen tetap ada. |
| 5. UI migrasi jelek. | Setuju; migrasi perlu wizard yang menunjukkan apa yang ditemukan dan keputusan yang diminta. | Ganti daftar ringkas dengan tahap ringkasan, tujuan/konflik, progres/verifikasi, lalu hasil atau retry. Tampilkan nama profil tujuan, jumlah data yang diketahui, alasan konflik, dan status backup. |
| 6. Kenapa profil non-Cloud masih ada link ke Cloud? | Tidak perlu ada akses Cloud dari workspace Lokal. | Sembunyikan navigasi dan tautan Cloud; rute Cloud langsung menampilkan alasan dan tautan ke halaman Profile untuk membuat/memilih workspace Cloud. Login tidak dapat dimulai dari Lokal. |
| 7. Ini breaking change; apa yang perlu diperhatikan? | Benar. Pergantian origin dan direktori data memengaruhi storage browser, SQLite, sesi, cache, deep link, CLI, import, dan alur downgrade. | Pertahankan backup/sumber, migrasikan hanya saat update yang memiliki data legacy, verifikasi target sebelum aktivasi, dan uji tautan lama serta alur buka file. Dokumentasikan batas downgrade; jangan mengklaim rollback penuh tanpa reverse migration teruji. |
| 8. Server Cloud hanya `https://hightex.jefyokta.dev`, kecuali dev mode yang bisa diganti lewat env. | Setuju. Build rilis harus memakai host itu secara tetap; dev mode memakai `LOCAL_SERVER` yang memang sudah tersedia. | Hilangkan input URL dari UI dan validasi lagi di backend/registry. Profil lama yang memakai host lain tidak boleh mengirim sesi ke server rilis secara otomatis; kebijakan pemulihan datanya harus ditetapkan sebelum migrasi diimplementasikan. |
| Catatan terakhir (nomor 8 kedua): berikan desain dulu, jangan langsung implementasi. | Dipatuhi. Dokumen ini adalah usulan desain untuk ditinjau. | Belum ada implementasi berdasarkan revisi ini. Setelah arah disepakati, baru checklist dan kode dikerjakan bertahap. |
| Catatan lanjutan: identitas profil di aplikasi dan dokumen membingungkan; sebaiknya otomatis mengikuti host. | Setuju, dengan workspace sebagai cakupan identitas default. Cloud workspace mengikuti akun pada host tersebut; workspace Lokal punya identitas penulis Lokal. | Ganti istilah UI agar jelas. Dokumen baru mengikuti identitas workspace; dokumen lama yang punya identitas khusus tidak ditimpa diam-diam. Sediakan pratinjau untuk menerapkan identitas workspace ke dokumen lama. |

## Tujuan

- Setiap workspace menyimpan dokumen, cache, SQLite, dan sesi secara terpisah.
- Profil lokal tetap berguna tanpa akun Cloud dan tidak menawarkan alur Cloud yang tidak dapat dipakai.
- Profil Cloud memakai server yang disetujui aplikasi dan meminta login kembali saat sesi habis.
- Nama profil adalah label pilihan pengguna, bukan nama host atau ID akun.
- Pergantian workspace tidak meninggalkan editor atau proses lama berjalan pada konteks data yang salah.
- Update lama menjaga data sumber, dapat dipulihkan, dan menjelaskan keputusan migrasinya.

## Keputusan desain yang disarankan

### 1. Model workspace

Gunakan data profil yang memisahkan identitas, label, jenis, dan binding akun:

```ts
interface WorkspaceProfile {
  id: string;                 // stabil dan tidak berasal dari nama profil
  name: string;               // label pilihan pengguna
  type: "local" | "cloud";
  accountId: string | null;   // hanya untuk profil Cloud yang telah terikat
}
```

Alamat server tidak menjadi input bebas pada profil. Aplikasi menentukan endpoint Cloud berdasarkan lingkungan:

- Build rilis: `https://hightex.jefyokta.dev`.
- Dev mode: nilai `LOCAL_SERVER`, dengan nilai lokal sebagai fallback.

Validasi dilakukan pada backend saat membaca registry dan saat membuat profil. Nilai registry lama yang tidak sesuai aturan tidak boleh diam-diam dipakai untuk mengirim token atau dokumen ke server lain.

Profil lokal tidak memiliki sesi, binding akun, atau operasi Cloud. Profil Cloud dapat dibuat sebelum login, tetapi fitur Cloud meminta login. Login pertama mengikat `accountId`; logout atau token kedaluwarsa tidak melepas binding itu. Satu akun tidak boleh mengikat profil Cloud lain pada server yang sama.

Nama awal yang disarankan adalah `Lokal` untuk profil lokal dan `Profil Cloud` untuk profil Cloud. Pengguna dapat menggantinya. Jenis dan status akun tampil sebagai badge/keterangan terpisah; alamat server tidak dipakai sebagai judul profil. Hindari menampilkan ID akun mentah jika nama akun tersedia.

### 2. Identitas penulis mengikuti workspace

Pisahkan istilah dan fungsinya di produk:

| Cakupan | Istilah UI | Fungsi |
| --- | --- | --- |
| Penyimpanan aplikasi | **Workspace** | Memisahkan dokumen, SQLite, sesi, dan data lokal. Dapat berupa Lokal atau Cloud. |
| Akun pada host Cloud | **Identitas akun Cloud** | Nama/NIM, CV, dan foto dari akun pada server yang mengikat workspace Cloud. |
| Nilai bawaan untuk dokumen | **Identitas penulis workspace** | Identitas yang otomatis dipakai dokumen dalam workspace itu. Di Cloud bersumber dari akun/host terkait; di Lokal dikelola pengguna. |
| Nilai khusus satu dokumen | **Identitas penulis dokumen** | Nilai yang disimpan atau dioverride untuk satu dokumen dan ikut diekspor bersama dokumen. |

Jangan tampilkan konsep workspace dan identitas penulis dengan nama umum `Profile` yang sama. Ubah label halaman aplikasi menjadi `Workspace` atau `Workspace & identitas`, dan beri nama eksplisit pada bagian identitas penulis.

Aturan penerapan yang disarankan:

- Dokumen baru otomatis memakai identitas penulis workspace aktif. Karena tiap Cloud workspace terikat pada satu host/akun, identitas Cloud tidak tercampur dengan host atau akun lain. Workspace Lokal memakai identitas penulis Lokal.
- Untuk dokumen yang mengikuti workspace, perubahan identitas default tercermin saat dokumen ditampilkan, diekspor, dicetak, atau disinkronkan. Simpan pilihan `mengikuti workspace` secara eksplisit agar sistem tahu mana nilai bawaan dan mana override dokumen.
- Pengguna dapat memilih `Khusus dokumen`; setelah itu perubahan identitas workspace tidak menimpa dokumen tersebut. Tampilan editor memberi penanda apakah identitas mengikuti workspace atau khusus dokumen.
- Nama, NIM, CV, dan foto dapat mengikuti akun Cloud. Pembimbing, pembimbing kedua, dan komite tetap khusus dokumen karena dapat berbeda antarproposal.
- Dokumen lama dengan identitas kosong atau yang masih sama dengan identitas bawaan lama dapat ditandai mengikuti workspace. Identitas yang berbeda dipertahankan sebagai khusus dokumen.
- Untuk benar-benar menyamakan dokumen lama, sediakan aksi eksplisit `Terapkan identitas workspace ke dokumen...` dengan pratinjau jumlah dan contoh perubahan. Jangan menimpa dokumen terkunci Cloud atau dokumen dengan identitas akademik server tanpa keputusan dan validasi tersendiri.
- Impor `.hightex` mempertahankan identitas sumber sebagai khusus dokumen secara default; pengguna dapat memilih untuk menggantinya dengan identitas workspace tujuan. Dengan begitu perpindahan dokumen antarworkspace tidak diam-diam mengganti penulis.

Mode mengikuti workspace perlu diresolusikan menjadi identitas lengkap saat membuat arsip portabel, PDF, dan payload Cloud, supaya hasil ekspor tetap konsisten walau dibuka di aplikasi lain atau offline.

### 3. Halaman Workspace dan batas fitur Lokal/Cloud

Jadikan halaman `/profile` satu-satunya tempat untuk membuat, memilih, mengganti nama, dan mengganti workspace. Hapus pemilih ringkas dari sidebar. Sidebar tetap memiliki tautan Profil dan dapat menampilkan nama workspace aktif sebagai keterangan non-interaktif.

Halaman Profil berisi:

1. Kartu workspace aktif: nama, badge Lokal/Cloud, status login, dan aksi ganti nama.
2. Daftar workspace: nama, jenis, status akun, dan aksi `Pilih`.
3. Aksi buat workspace dengan pilihan Lokal atau Cloud. Pemilihan Cloud tidak meminta URL server.
4. Bagian profil penulis/dokumen yang tetap terpisah secara visual dari workspace.

Pada workspace lokal, sembunyikan kelompok navigasi Cloud serta tautan ke halaman akun Cloud. Jika pengguna membuka rute Cloud secara langsung, tampilkan pesan bahwa fitur memerlukan workspace Cloud dan tautan ke pengelolaan Profil. Jangan memulai login dari workspace lokal.

Pada workspace Cloud, status koneksi dan sesi ditampilkan terpisah: `Online`, `Offline`, `Masuk`, atau `Perlu login`. Jangan meminta login hanya karena aplikasi dibuka atau koneksi internet sedang mati. Dokumen dan fitur lokal yang tersimpan di profil tetap dapat dipakai offline.

Login diperlukan hanya saat pengguna menjalankan aksi yang membutuhkan server. Jika tidak ada internet, jelaskan bahwa aksi itu perlu koneksi dan pertahankan sesi/token lokal. Jika online tetapi token sudah kedaluwarsa atau server menjawab `401`, minta login untuk melanjutkan aksi Cloud. Jangan hapus data lokal atau binding akun saat sesi habis. Setelah login, lanjutkan operasi yang tadi gagal bila aman untuk diulang; operasi tulis yang hasilnya tidak pasti harus meminta pengguna memeriksa statusnya dahulu.

Transfer dokumen antarprofil juga dapat dilakukan tanpa internet karena isinya disalin secara lokal. Untuk tahap awal, gunakan alur ekspor/impor `.hightex` yang sudah tersedia. Impor ke profil lain membuat salinan lokal dan tidak otomatis menghubungkannya ke akun/server tujuan; relink Cloud harus menjadi tindakan eksplisit setelah login. Transfer langsung seluruh workspace antarprofil menjadi pengembangan terpisah karena perlu menyalin IndexedDB, file, SQLite, dan metadata binding dengan aman.

### 4. Pergantian workspace yang aman

Pergantian workspace harus menjadi operasi yang dikendalikan proses utama, bukan hanya pengecekan jumlah window saat klik:

1. Proses utama mengunci permintaan pergantian dan menahan pembukaan editor baru, impor file, dan deep link sampai operasi selesai.
2. Proses utama meminta semua window aplikasi menyiapkan penutupan.
3. Setiap renderer menyelesaikan simpan otomatis/penyimpanan tertunda dan menjalankan close guard yang sama dengan penutupan normal. Renderer dapat membatalkan jika dokumen belum aman ditutup.
4. Jika ada pembatalan, window tidak merespons, atau penyimpanan gagal, workspace aktif tidak berubah dan pengguna mendapat alasan yang jelas.
5. Hanya setelah semua window menyatakan siap, tutup window anak, simpan `activeId` secara atomik, lalu relaunch proses.

Daftar window harus mencakup editor, preview/print, sharing, dan window lain yang memakai layanan workspace. Tes alur meliputi editor bersih, editor kotor, beberapa window, pengguna membatalkan close guard, window yang tidak merespons, serta deep link yang datang selama pergantian.

### 5. Wizard migrasi dan aturan data lama

Migrasi tetap hanya muncul pada update yang mempunyai penyimpanan legacy. Instalasi baru membuat profil Lokal dan tidak menjalankan wizard.

Rancangan wizard:

1. **Ringkasan:** jelaskan alasan migrasi, lokasi sumber, data yang ditemukan, dan bahwa sumber akan dipertahankan.
2. **Tujuan data:** kelompokkan dokumen dan branch berdasarkan binding lama. Tampilkan nama profil tujuan, jumlah dokumen/branch/aset/form jika hitungannya tersedia, serta alasan pengelompokan.
3. **Perlu ditinjau:** tampilkan binding ambigu, relasi induk rusak, atau host lama yang tidak lagi diizinkan. Jangan menyelesaikan konflik secara diam-diam.
4. **Proses:** tampilkan progres per tujuan dan status verifikasi.
5. **Selesai/gagal:** tampilkan profil yang berhasil, aksi coba ulang, dan lokasi backup/pemulihan.

Aturan data:

- Dokumen tanpa binding Cloud masuk ke Lokal; branch mengikuti workspace induknya.
- Binding ke server rilis yang didukung dikelompokkan berdasarkan pasangan server/akun.
- Host legacy lain tidak boleh otomatis menjadi endpoint Cloud rilis. Rekomendasi awal: pertahankan dokumen dan metadata binding di tujuan Lokal untuk peninjauan, jangan salin token, dan jangan melakukan sync otomatis. Sediakan ekspor/pemulihan agar data tidak hilang. Perilaku untuk host legacy ini perlu menjadi keputusan eksplisit sebelum implementasi migrasi.
- Backup sumber, jurnal, dan SQLite konsisten dipertahankan. SQLite dibaca/ditulis melalui model yang sudah ada.
- Aktifkan profil hasil hanya setelah semua target lolos verifikasi. Jika gagal, sumber tetap utuh dan retry tidak membuat dokumen duplikat.

### 6. Kompatibilitas dan dampak breaking change

Perubahan `hightex://app` menjadi `hightex://profile.<profileId>` memisahkan origin dan storage browser. Perubahan direktori `userData` juga memindahkan electron-store, SQLite, sesi, cache, dan file terkait. Karena itu:

- Jalur update harus mendeteksi data versi lama dan menjalankan migrasi sebelum membuka pustaka baru.
- Sediakan alias/redirect kompatibilitas untuk tautan internal lama `hightex://app/...` ke rute yang sama pada workspace aktif setelah migrasi. Selama migrasi, origin lama tetap menjadi sumber baca.
- Deep link dokumen/auth, impor `.hightex`, binding cloud, ID dokumen, base hash, profil penulis, snapshot, komentar, dan file impor harus diperiksa satu per satu agar tidak berubah makna.
- Jangan menghapus sumber legacy setelah sukses pada rilis pertama. Catat cara pemulihan dan simpan backup di lokasi yang tidak ikut berpindah saat `userData` diganti.
- Downgrade ke versi aplikasi lama setelah pengguna membuat perubahan di penyimpanan workspace baru tidak otomatis aman: aplikasi lama tidak mengenal direktori baru. Data sumber lama tetap menjadi titik pemulihan, tetapi perubahan setelah upgrade memerlukan ekspor/recovery. Perilaku downgrade perlu disebutkan dalam catatan rilis; jangan mengklaim rollback penuh tanpa jalur reverse-migration yang sudah diverifikasi.
- Periksa startup CLI, open-file, second-instance, update, dan deep link karena semuanya dapat membuka window atau layanan ketika pergantian/migrasi sedang berlangsung.

## Urutan implementasi setelah desain disetujui

### Fase 1 — Kontrak data dan endpoint

- Ubah kontrak tipe menjadi `local`/`cloud` eksplisit dan pertahankan ID stabil.
- Pisahkan nama profil dari server dan akun.
- Tetapkan model identitas penulis workspace versus override dokumen, termasuk cara meresolusikannya untuk editor, PDF, arsip `.hightex`, dan Cloud sync.
- Tetapkan satu resolver endpoint untuk rilis/dev dan validasi registry serta IPC.
- Definisikan penanganan registry lama dan host Cloud legacy sebelum mengaktifkan migrasi.

### Fase 2 — Akses fitur dan sesi Cloud

- Sembunyikan navigasi/rute Cloud di workspace lokal.
- Pastikan profil lokal tidak dapat memulai login atau menggunakan sesi.
- Tampilkan status sesi Cloud; bedakan expired/401 dari offline; pertahankan binding setelah logout.

### Fase 3 — Manajemen Profil

- Satukan manajemen workspace di `/profile`; hapus selector dari sidebar.
- Tampilkan nama, jenis, status akun, serta aksi buat/pilih/rename.
- Tampilkan sumber identitas penulis dan penanda dokumen yang mengikuti workspace atau memakai identitas khusus.
- Pertahankan profil penulis dokumen sebagai area terpisah.

### Fase 4 — Lifecycle pergantian window

- Tambahkan protokol prepare/ack/cancel antara main process dan semua renderer.
- Kunci operasi pembuka window selama switch.
- Ubah profil aktif dan relaunch hanya setelah seluruh window aman ditutup.

### Fase 5 — Wizard migrasi dan kompatibilitas

- Susun wizard ringkasan, assignment, konflik, progres, verifikasi, dan retry.
- Saat update, tandai dokumen lama yang aman mengikuti identitas workspace; pertahankan identitas berbeda sebagai override dan sediakan pratinjau penerapan massal.
- Tambahkan alias tautan lama dan jalur recovery untuk sumber/target.
- Terapkan kebijakan host legacy setelah keputusan produk dikunci.

### Fase 6 — Validasi rilis

- Cek instalasi bersih: profil Lokal terbentuk, migrasi tidak muncul.
- Cek update dari versi lama dengan dokumen lokal, beberapa binding Cloud, branch, form, aset, SQLite, snapshot, dan sesi.
- Cek server rilis tetap tetap dan `LOCAL_SERVER` hanya berlaku di dev mode.
- Cek pergantian profil dengan editor/preview terbuka, dokumen kotor, pembatalan, dan deep link.
- Cek expiry, logout, offline, akun yang berbeda, serta workspace lokal tanpa tautan Cloud. Pastikan offline tidak memaksa login, aksi server memberi pesan yang sesuai, dan sesi baru diminta setelah expiry/401.
- Cek ekspor/impor dokumen antarprofil tanpa internet dan pastikan hasil impor tidak tersambung otomatis ke akun Cloud tujuan.
- Cek identitas yang mengikuti workspace versus override dokumen pada pembuatan, edit, branch, import/export `.hightex`, PDF, dan Cloud sync; pastikan perubahan akun tidak menimpa pembimbing/komite khusus dokumen.
- Cek migrasi gagal, retry, backup, alias origin lama, serta batasan downgrade yang didokumentasikan.

## Kriteria selesai

- Nama profil selalu berupa label workspace; host/akun hanya metadata.
- Profil Lokal tidak menampilkan atau menjalankan alur Cloud.
- Profil Cloud memakai endpoint yang benar dan meminta login kembali ketika sesi kedaluwarsa.
- Istilah Workspace, Identitas akun Cloud, Identitas penulis workspace, dan Identitas penulis dokumen dibedakan; dokumen baru mengikuti identitas workspace dan override lama tetap aman.
- Profil tidak pernah berganti selama ada window/data yang belum aman ditutup.
- UI profil dan migrasi menyampaikan status, konflik, dan tindakan berikutnya dengan jelas.
- Instalasi baru melewati migrasi; update menjaga sumber serta dapat dipulihkan.
- Perubahan origin, deep link, CLI, update, SQLite, dan batas downgrade tercakup dalam validasi rilis.
