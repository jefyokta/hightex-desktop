# Rencana integrasi API desktop dan penyederhanaan data dokumen

Tanggal: 21 Oktober 2026. Status: rencana bertahap; progres implementasi dicatat di bawah.

## Progres implementasi

Checkpoint awal: `b2a498e` (`checkpoint`). Perubahan berikutnya dibuat sebagai satu fitur untuk direview sebelum lanjut ke workflow API.

Setiap langkah ditutup dengan summary di [docs/codex-impl-summary](docs/codex-impl-summary/README.md). Pisahkan breaking changes dari penambahan fitur; jelaskan dampak, kompatibilitas, dan tindakan migrasi. Lanjut ke langkah berikutnya setelah review pengguna.

**Langkah 1 — penulis per dokumen:** sudah diimplementasikan pada kode desktop. Identitas penulis/pembimbing dapat diedit pada sidebar pengaturan dokumen; CV dan foto diedit pada bab Daftar Riwayat Hidup. Preview/PDF membaca profil dokumen, dan profil beserta foto ikut dalam export/import v2. Dokumen lama tidak otomatis mengambil identitas akun/default; data default dapat diterapkan secara eksplisit.

Variabel memakai tabel baru dengan kunci gabungan dokumen dan nama. Upgrade database mempertahankan tabel variabel lama sebagai cadangan dan tidak mengisi profil dokumen lama secara otomatis. Konfigurasi KP serta keyword Inggris dipertahankan saat round-trip v2. Komponen form, card, tombol dan alur sidebar mengikuti desain yang sudah ada.

Panduan review: [tests/manual-test.md](tests/manual-test.md). Uji otomatis: [tests/document-profile.test.ts](tests/document-profile.test.ts).

Validasi langkah 1: 29 test lolos, `tsc --noEmit` lolos, build Vite renderer/main/preload lolos, dan lint kode inti yang berubah lolos tanpa warning. Tampilan editor serta PDF aktual belum diuji lewat GUI; gunakan panduan review manual. Implementasi sudah tercatat di commit `cb21591` dan pengguna menyetujui untuk lanjut.

**Belum termasuk pada langkah 1:** reader snapshot review yang terisolasi, UI review/submission/advisor, login browser, profil akun online, serta perbaikan protokol/hash dan konflik cloud. Tidak ada klaim bahwa workflow review atau dukungan KP online sudah berjalan. Arsitektur `DocumentRef` untuk beberapa snapshot adalah tahap berikutnya; langkah pertama ini menutup jalur profil global pada render draft dan file portabel.

**Langkah 2 — snapshot submission hanya baca:** menambahkan antrean/riwayat dari `GET /submission`, unduh snapshot melalui endpoint file submission dengan pemeriksaan SHA-256 dan ID dokumen, serta viewer paket terpisah dari editor. File `.hightex` lokal juga dapat dibuka untuk dibaca tanpa import/login. Profil, variabel, gambar, CV dan referensi dibaca dari paket; pembacaan tidak memanggil `Document.warm()` atau menulis database draft. Cache hanya di memori dan dibatasi oleh server, akun, sesi, dokumen, submission, serta hash.

Bentuk respons dikonfirmasi melalui source lokal backend `hightex/app/Http/Controllers/Api/Submission.php` dan tests `ApiSubmissionTest.php`, tanpa mengubah repository backend. Viewer mendukung manifest desktop dengan `schema_version: 2` atau `version: 2`, dan format export web v1. Ini adalah viewer isi dokumen; layout PDF final dan aksi komentar/transisi review belum termasuk.

Catatan untuk tahap pengajuan: source backend lokal memeriksa `manifest.version === 2` untuk archive desktop, sedangkan exporter desktop sekarang menulis `schema_version: 2`. Samakan kontrak sebelum mengaktifkan push → submit; jangan menganggap penerimaan archive desktop oleh endpoint submit sudah tervalidasi pada langkah kedua.

Validasi langkah 2: 52 test lolos, typecheck dan lint kode inti terkait lolos, serta build renderer/main/preload lolos dengan warning ukuran chunk. GUI dan integrasi server aktif belum diuji. Detail, batas cakupan, catatan kompatibilitas, dan cara review: [summary langkah 2](docs/codex-impl-summary/STEP_2_SUMMARY.md). Status: siap direview; belum lanjut ke fitur berikutnya.

Pembaruan: langkah 2 sudah di-commit sebagai `5766f6e` dan pengguna menyetujui untuk lanjut. Uji server lokal berhasil untuk login, bentuk daftar kosong student/advisor, file tidak tersedia dan pencabutan token uji; snapshot submission positif belum tersedia.

**Langkah 3 — sinkronisasi cloud:** implementasi siap review. Binding/base dipisahkan per server/akun/dokumen; refresh tidak mengubah base. Artifact byte stabil, hash seluruh file, manifest kompatibel backend, pull terverifikasi dengan import transaksional, backup sebelum penggantian, riwayat sebagai salinan dan restore eksplisit. Uji server lokal membuktikan push/pull, konflik base lama setelah refresh dan pengiriman byte sama tanpa perubahan. Fixture demo versi B ditinggalkan di cloud student untuk review. Detail dan breaking changes: [summary langkah 3](docs/codex-impl-summary/STEP_3_SUMMARY.md). Belum lanjut ke pengajuan submission.

## Checklist next steps

**Pembaruan kebutuhan dari pengguna — data akademik cloud:** `/university-data` menyediakan kaprodi/dekan. Draft cloud otomatis memakai penulis serta penugasan dari `/me.advisors` (mentorship aktif) dan `thesis_data`; field tersebut tidak bisa diedit manual. Judul, bab, CV/foto dan tanggal tetap editable. Ini menggantikan anjuran penerapan profil secara eksplisit untuk **draft cloud** pada rencana awal; dokumen lokal dan snapshot review tetap mempertahankan data masing-masing. Implementasi dan breaking changes: [summary data akademik cloud](docs/codex-impl-summary/CLOUD_ACADEMIC_SUMMARY.md).

**Perbaikan viewer didahulukan atas permintaan pengguna:** submission sekarang memakai preview penuh melalui komponen cetak lama di iframe dengan data snapshot dalam memori. Compiler, resolver dan preview editor tidak diubah. Detail dan kompatibilitas: [summary perbaikan viewer](docs/codex-impl-summary/SUBMISSION_PREVIEW_FIX_SUMMARY.md). Pengguna sudah melakukan checkpoint `e2c8d49` dan menyetujui lanjut ke langkah 4.

**Langkah 4 — pengajuan mahasiswa:** siap review. Artifact tetap di-push lalu diajukan, snapshot server diverifikasi terhadap hash artifact, catatan percobaan tersimpan per akun/server, dan pemulihan membedakan retry kegagalan pasti dari pengecekan timeout ambigu. Riwayat dokumen sendiri, akun multi-role dan hasil review tersedia. Submission demo #1 berhasil diverifikasi sebagai student/advisor. Detail dan batas retry tanpa idempotency backend: [summary langkah 4](docs/codex-impl-summary/STEP_4_SUMMARY.md).

**Langkah 5 — workflow advisor:** implementasi siap review setelah checkpoint `cbb1333`. Antrean, mahasiswa bimbingan, riwayat, mulai/komentar/selesai review tersedia. Catatan dokumen dan aksi pending tersimpan per akun/server. API belum mengirim ID dokumen pada daftar mahasiswa dan belum mendukung transisi bersyarat submission/idempotency; mitigasi dan batasnya dicatat pada [summary langkah 5](docs/codex-impl-summary/STEP_5_SUMMARY.md).

**Langkah 6–8:** dikerjakan sekaligus atas permintaan pengguna. PDF snapshot terisolasi, autentikasi browser/expiry/logout, serta profil akun online dan penerapan terpilih ke draft lokal tersedia. Summary: [6 — PDF](docs/codex-impl-summary/STEP_6_SUMMARY.md), [7 — autentikasi](docs/codex-impl-summary/STEP_7_SUMMARY.md), [8 — profil](docs/codex-impl-summary/STEP_8_SUMMARY.md). Validasi protokol installer lintas OS tetap bagian penerimaan langkah 10.

Urutan ini menjadi urutan pengiriman setelah langkah 2. Nomor langkah implementasi berbeda dari nomor tahap arsitektur di bagian bawah. Setiap langkah menghasilkan satu fitur yang bisa dicoba, mengikuti desain dan gaya kode yang sudah ada, lalu berhenti untuk review pengguna.

Lingkungan pengujian yang disediakan pengguna: server lokal berjalan di port **8000**; base URL API `http://127.0.0.1:8000/api/`. File `demo-user` hanya konteks awal untuk agen, bukan dependensi aplikasi atau pengujian. Sesuai arahan pengguna, akun demo student/advisor ditulis langsung sebagai konstanta di `tests/integration/local-server.ts`. Password demo tidak dicetak ke log/summary; token uji tetap diperoleh saat login dan tidak disimpan sebagai fixture. Ketersediaan endpoint dan permission tetap mengikuti hasil pengujian langsung.

- [ ] **Validasi integrasi langkah 2 di server lokal.** Login, file tidak tersedia dan pencabutan token uji sudah lolos. Snapshot demo #1 kini berhasil diunduh/diverifikasi sebagai mahasiswa dan advisor pada langkah 4. GUI otomatis memakai fixture terisolasi; alur GUI dengan akun server sebenarnya tetap perlu review pengguna.
- [x] **Langkah 3 — sinkronisasi cloud aman.** Implementasi siap review: manifest kompatibel, hash seluruh byte, scope binding/base, pull transaksional, backup, salinan riwayat dan restore eksplisit. Push/pull/konflik setelah refresh diuji server lokal; regresi isolasi sesi, data lokal dan aset diuji otomatis. Batas atomicity backend dan hash legacy dicatat pada summary langkah 3. Sudah dilanjutkan ke pengajuan mahasiswa pada langkah 4.
- [x] **Langkah 4 — pengajuan mahasiswa.** Implementasi siap review: bekukan artifact, push, POST submission, verifikasi snapshot, riwayat/status/hasil review dan catatan pemulihan per akun/server. Konflik, klik ganda, timeout dan retry versi tetap diuji; submission demo #1 diverifikasi student/advisor. Timeout tanpa hasil pasti hanya dapat diperiksa ulang, karena server belum memiliki idempotency/submit bersyarat SHA. Checkpoint `cbb1333` disetujui untuk lanjut ke langkah 5.
- [x] **Langkah 5 — workflow advisor.** Siap review: daftar bimbingan, riwayat dokumen terverifikasi, mulai review, komentar maksimal 200 karakter Unicode, selesai review dan hasil mahasiswa. Guard sesi/permission/versi, klik ganda dan pending persisten diuji. Riwayat server lokal diverifikasi baca-saja; mutasi diuji fixture service/GUI. Penemuan otomatis semua riwayat pada perangkat baru, idempotency dan transisi bersyarat versi masih membutuhkan backend. Detail, batas dan breaking changes: [summary langkah 5](docs/codex-impl-summary/STEP_5_SUMMARY.md). Diteruskan ke langkah 6–8 atas permintaan pengguna.
- [x] **Langkah 6 — preview dan PDF snapshot.** Export PDF tersedia pada viewer memakai byte snapshot dan database memori di jendela cetak terpisah. Judul/author/keyword/hash mengikuti snapshot; source submission memeriksa sesi, akses dan hash lagi. PDF TA/proposal/KP, dua penulis, legacy, pembatalan serta guard akses diuji. Preview tetap identik per piksel. [Summary langkah 6](docs/codex-impl-summary/STEP_6_SUMMARY.md).
- [x] **Langkah 7 — autentikasi desktop.** Login browser, state persisten/expiry/replay guard, host auth/deep link startup, login langsung, metadata expiry dan logout server/lokal tersedia. Alur HTTP browser sebenarnya, sesi lama, role kosong dan logout offline diuji. User.role dapat null dan hasil logout sekarang bertipe; uji installer/callback OS masih perlu penerimaan lintas platform. [Summary langkah 7](docs/codex-impl-summary/STEP_7_SUMMARY.md).
- [x] **Langkah 8 — profil akun online dan penerapan ke dokumen.** Settings menyediakan foto/CV lewat API, error per field, cache sesi, identitas server serta tautan pengaturan web. Penerapan eksplisit nama/NIM/CV/foto ke satu draft lokal memiliki pilihan field, perbandingan dan konfirmasi; null tidak menghapus isian manual. Cloud/editor terbuka ditolak dan snapshot tetap utuh. [Summary langkah 8](docs/codex-impl-summary/STEP_8_SUMMARY.md).
- [ ] **Langkah 9 — kelengkapan data dokumen dan KP lokal.** Lengkapi form pembimbing kampus/instansi, lokasi, pejabat/penguji sesuai jenis dokumen, serta tanggal. Hilangkan nilai identitas/tanggal bawaan yang seolah data sebenarnya; pertahankan data lama dan round-trip archive. Terapkan kebijakan dukungan KP pada service dan UI. **Bisa direview:** dokumen KP lengkap dapat diedit, dipreview, diekspor, diimpor, dan dicetak tanpa server; fitur online yang belum didukung menjelaskan batasnya.
- [ ] **Langkah 10 — penerimaan lintas fitur.** Jalankan skenario end-to-end akun demo, offline, pergantian akun/server, dua dokumen/versi, konflik, archive lama, serta output PDF TA/proposal/KP. Lengkapi matriks cakupan endpoint dan catat kebutuhan backend yang tersisa. **Bisa direview:** hasil uji aktual, daftar batas dukungan, dan seluruh summary implementasi konsisten dengan perilaku aplikasi.

KP online tetap ditunda sampai kontrak backend tersedia; tidak menjadi klaim hasil langkah 9 atau 10. Summary setiap langkah disimpan di `docs/codex-impl-summary/STEP_<nomor>_SUMMARY.md`, dengan perubahan, validasi aktual, keterbatasan, breaking changes, dan migrasi bila ada. Daftar ini belum menandakan fitur berikutnya sudah mulai diimplementasikan.

## 1. Keputusan arsitektur yang disarankan

Desktop tetap dapat dipakai penuh secara lokal. Setiap dokumen menyimpan konten, identitas penulis, data akademik, CV, dan aset yang diperlukan untuk menghasilkan dokumen tersebut. Server menyediakan akun, data akademik yang didukung, penyimpanan versi, dan workflow submission/review.

Hindari penggabungan profil lokal dan profil server setiap kali editor atau compiler membaca data. Mengambil data akun menjadi tindakan eksplisit: pengguna melihat perubahan, memilih menerapkannya, lalu hasilnya disimpan dalam dokumen. Login, logout, pergantian akun, atau refresh `/me` tidak langsung mengubah hasil cetak dokumen lama.

Satu dokumen lokal menjadi sumber data untuk editor, variabel, preview, PDF, export, dan snapshot submission. Profil akun dan profil dokumen adalah dua objek dengan tujuan berbeda.

Contoh wajib: advisor D membuka submission mahasiswa A, lalu submission mahasiswa B. Nama, NIM, foto, CV, pembimbing, variabel penulis dan metadata PDF harus mengikuti snapshot A atau B yang sedang dibuka. Nama D hanya muncul sebagai akun yang sedang mengakses serta penulis komentar yang dikonfirmasi server. Mengganti konteks role D tidak mengubah penulis dokumen mana pun.

| Data | Pemilik/sumber utama | Cara masuk ke dokumen |
| --- | --- | --- |
| Token, sesi, role akun | Server; token terenkripsi di main process | Tidak masuk archive |
| Nama, NIM, foto, CV akun | Server untuk akun; salinan lokal untuk dokumen | Ambil data akun, tinjau, lalu terapkan |
| Pembimbing TA dan penugasan sidang | Server bila tersedia | Salin ke data akademik dokumen yang sesuai |
| Pembimbing KP kampus/instansi, lokasi dan tanggal KP | Dokumen lokal; server belum mendukung data KP | Form data KP per dokumen |
| Konten, konfigurasi cetak, variabel dan aset | Dokumen lokal | Disimpan dan dikemas bersama dokumen |
| Binding cloud dan versi dasar sinkronisasi | State sinkronisasi lokal per server, akun, dan dokumen | Disimpan di luar archive portabel |
| Status submission, komentar, hak akses review | Server | Ditampilkan dari API; cache hanya untuk membaca |

Pengaturan profil lokal global tetap berguna sebagai default untuk dokumen baru. Setelah dokumen dibuat, perubahan default tidak memperbarui semua dokumen. Ganti `preferCloudProfile` dengan alur ambil data akun yang eksplisit setelah migrasi selesai.

## 2. Batas dukungan KP

Informasi dari pengguna: server belum mendukung data Kerja Praktek (KP). Jangan menganggap `advisors` dan `thesis_data` sebagai data pembimbing atau sidang KP.

| Kemampuan | TA/proposal | KP (`variant: intern`) |
| --- | --- | --- |
| Editor, preview, PDF, export/import lokal | Didukung | Didukung penuh |
| Ambil identitas penulis dari akun | Didukung setelah ditinjau | Didukung setelah ditinjau |
| Ambil pembimbing/penugasan akademik dari server | Hanya relasi yang sesuai jenis dokumen | Belum tersedia; isi manual |
| Foto dan CV akun | Didukung; salin ke dokumen secara eksplisit | Sama, bukan data akademik KP |
| Push/pull cloud | Untuk kategori yang dipastikan didukung server | Ditunda sampai dukungan kategori dan preservasi archive dikonfirmasi |
| Submission/review server | Mengikuti dokumen akun dan akses server | Ditunda sampai server mendukung workflow KP |

Tidak adanya data KP terstruktur belum membuktikan bahwa server tidak bisa menyimpan binary archive KP. Tetap verifikasi kemampuan itu secara terpisah. Default awal produk: KP lokal; tampilkan alasan singkat pada fitur cloud/review yang belum tersedia. Jangan mengubah kategori KP menjadi TA agar upload diterima.

Kebijakan kemampuan ditentukan satu modul berdasarkan jenis dokumen dan dukungan API yang telah diuji. Jangan menyebar pengecekan KP di setiap komponen, atau menyimpulkan dukungan KP hanya dari keberadaan kategori `/categories`.

## 3. Model data dan batas antarlayanan

Tambahkan model berikut secara bertahap, memakai struktur yang sudah ada bila masih sesuai:

- `AccountUser`: DTO `/me` lengkap, termasuk array role/degree, `advisor_role`, `thesis_data`, foto, CV, dan nilai nullable. Gunakan `name` yang telah diformat server; jangan menambah gelar lagi.
- `DocumentProfile`: identitas penulis, foto dan CV yang melekat pada dokumen. Opsional menyimpan asal akun serta waktu pengambilan sebagai informasi, bukan pengikat sesi.
- `DocumentAcademicData`: bentuk berbeda untuk TA, proposal, dan KP. KP memiliki pembimbing kampus serta pembimbing instansi yang terpisah. Pertahankan konfigurasi tanggal/pejabat yang sudah ada melalui adapter migrasi.
- `DocumentSyncState`: `serverOrigin`, `accountId`, `serverDocumentId`, `localDocumentId`, `baseSha256`, dan waktu sync berhasil. Pisahkan SHA versi server yang baru dilihat dari SHA dasar konten lokal.
- `Submission` dan `SubmissionComment`: kontrak respons dikonfirmasi terlebih dahulu; pisahkan `documentId` dari `submissionId` pada metode service.

Identitas penulis dokumen review berasal dari archive mahasiswa, bukan profil advisor yang sedang login. Membuka snapshot untuk review tidak membuat binding cloud milik advisor.

Pembagian tanggung jawab:

| Lapisan | Tanggung jawab |
| --- | --- |
| API client main process | Token, HTTP, JSON/binary/multipart, status dan error terstruktur |
| Service akun/profil/submission | Operasi endpoint dan pemetaan DTO |
| Koordinator sinkronisasi/submission | Export versi tetap, push/pull, binding, commit state setelah operasi berhasil |
| Penyimpanan dokumen | Data dokumen, profil, akademik, aset, migrasi |
| Resolver profil dokumen | Membaca data per dokumen untuk editor/compiler tanpa request jaringan |
| Renderer dan preload | Aksi bertipe, loading/error, form dan tampilan; token tetap di main process |

Hindari service generik besar dan sinkronisasi dua arah otomatis per field. Untuk tahap awal gunakan tindakan ambil data, simpan ke cloud, unduh, dan ajukan review secara eksplisit.

### 3.1. Pisahkan pelaku, penulis, pemilik server, dan konteks tampilan

Empat identitas berikut tidak boleh digabung menjadi satu `user`:

| Konsep | Sumber | Dipakai untuk |
| --- | --- | --- |
| Pelaku (`actor`) | Sesi akun saat ini | Request API dan identitas pemberi komentar dari server |
| Penulis (`author`) | Profil yang tertanam dalam dokumen/snapshot | Isi cover, NIM, CV, foto, variabel dan metadata PDF |
| Pemilik dokumen server (`owner`) | Relasi dokumen/submission dari server | Memastikan target workflow dan keterkaitan akun; tidak ditentukan dari nama pada archive |
| Konteks buka (`context`) | Operasi yang membuka dokumen | Menentukan draft, versi riwayat, atau snapshot review dan penyimpanan yang dipakai |

Role advisor memberi kemungkinan akses review, bukan kepemilikan dokumen mahasiswa. Role student juga tidak membuktikan bahwa file lokal milik akun tersebut. Metadata `author.accountId` dalam archive hanya informasi asal; metadata yang bisa diedit tidak menjadi bukti hak akses API.

Akun multi-role tetap satu `actor` dengan seluruh `roles[]`. Pilihan menu Dokumen saya / Review mahasiswa hanya mengubah tugas yang sedang dilakukan. Jangan memakai `roles[0]` untuk menentukan profil cetak, pemilik file, atau kemampuan semua dokumen.

### 3.2. Konteks dokumen harus eksplisit sampai ke compiler

Usulan kontrak internal berikut bukan kontrak API server:

```ts
type DocumentRef =
  | { kind: "draft"; localId: string }
  | { kind: "history"; cacheKey: string }
  | { kind: "submission"; cacheKey: string };

type ReviewSource = {
  serverOrigin: string;
  viewerAccountId: string;
  serverDocumentId: string;
  submissionId: string;
  sha256: string;
};

// Reader yang sama, sumber penyimpanan berbeda; tidak membaca /me.
resolveDocument(ref: DocumentRef): Promise<DocumentReadModel>;
```

`DocumentReadModel` membawa konten, profil penulis, data akademik, variabel, referensi, aset dan status kelengkapan dari versi yang dibuka. `actor` berada dalam session context terpisah. `RenderContext` yang dibuat dari read model diberikan ke preview penuh, preview bab, CV builder, PDF dan export; tidak ada pembaca profil global tersembunyi di tengah proses render.

`documentId` saja tidak cukup: draft terbaru dan dua submission dokumen yang sama dapat dibuka bersamaan. Setiap jendela/frame membawa `DocumentRef` sendiri. Request yang selesai terlambat diperiksa terhadap ref dan versi sesi yang memulainya; hasil render A tidak boleh masuk ke tampilan B.

### 3.3. Pisahkan penyimpanan draft dan snapshot review

- Draft memakai repository lokal yang dapat ditulis. Review memakai reader archive dan cache snapshot tersendiri yang hanya bisa dibaca, tanpa menjalankan importer draft.
- Kunci cache review mencakup server, akun yang mengakses, ID dokumen, ID submission dan SHA snapshot. Simpan byte asli serta hasil pembacaan; jangan mengubah byte snapshot ketika membuat tampilan atau memberi komentar.
- `warm()` pada reader review hanya menyiapkan data dalam memori. Jangan memanggil jalur `Document.warm()` lama yang membuat variabel/chapter di database draft.
- Jangan memasukkan citation, alias, foto, gambar atau variabel review ke tabel global editor. Namespace snapshot meliputi seluruh aset, sehingga dokumen A dan B dengan ID file atau key referensi sama tetap terpisah.
- Dua submission dari dokumen yang sama mempunyai entry berbeda. Membuka submission lama tidak menimpa draft mahasiswa terbaru maupun snapshot submission baru.
- Komentar dan status review disimpan melalui API; keduanya tidak mengedit archive submission. API sekarang hanya mendukung komentar submission secara umum, bukan menyimpan revisi isi yang dibuat advisor.
- Aksi Buat salinan untuk diedit menghasilkan ID lokal baru dan mempertahankan penulis beserta asal snapshot. Salinan tidak mempunyai binding cloud atau hak submit otomatis. Menyalin file tidak memindahkan kepemilikan server.
- Pada logout/pergantian akun, hentikan operasi review dan lepaskan konteks/cache akses akun sebelumnya. Jika diperlukan review offline, desain sebagai fitur tersendiri dengan kebijakan cache dan masa akses yang jelas; tahap awal review memerlukan sesi/akses online yang valid.

### 3.4. Aturan tindakan berdasarkan konteks

| Tindakan | Draft lokal | Snapshot submission | Salinan dari review |
| --- | --- | --- | --- |
| Baca/preview/PDF | Profil draft | Profil snapshot mahasiswa | Profil penulis yang disalin |
| Edit isi/profil dokumen | Ya | Tidak | Ya, sebagai dokumen lokal baru |
| Ambil profil `/me` | Hanya tindakan eksplisit untuk draft diri sendiri atau penetapan penulis yang ditinjau | Tidak tersedia | Tidak tersedia sebagai jalan pintas mengganti penulis |
| Push/submit | Memerlukan target akun dan akses server yang sesuai | Tidak | Tidak otomatis; harus melalui penetapan target yang sah |
| Komentar/ubah status review | Bukan lewat draft | Melalui API jika server mengizinkan | Bukan lewat salinan lokal |

Data `/me` selalu milik actor. Untuk dokumen orang lain, jangan memakai `/me` untuk melengkapi nama, pembimbing, CV atau foto penulis. Endpoint `/profile` juga selalu mengubah profil actor, bukan profil mahasiswa yang sedang direview. Pemilihan mahasiswa di sidebar tidak mengubah target endpoint akun ini.

Pembatasan ditetapkan pada koordinator operasi dan IPC yang relevan, bukan tombol saja. Main process memeriksa sesi aktif dan target operasi sebelum request. Pengecekan lokal menghindari salah konteks; backend tetap memutuskan autentikasi, permission dan mentorship.

### 3.5. Profil tidak lengkap dan data akademik yang berubah

Urutan sumber data render hanya: data versi dokumen tersebut → status field belum tersedia. Tidak ada fallback ke profil akun, template global, atau data mahasiswa yang baru diambil dari server.

- Archive review lama tanpa profil: tampilkan konten yang tersedia dan penanda Data penulis tidak tersimpan pada snapshot ini. Halaman yang membutuhkan data tersebut ditandai tidak lengkap; jangan menghasilkan identitas pengganti dari advisor. PDF yang diekspor menampilkan penanda kelengkapan, bukan identitas rekaan.
- Nama mahasiswa dari daftar mentorship dapat menjadi label navigasi, dengan sumber yang jelas. Label tersebut tidak dianggap profil historis lengkap dan tidak dipakai mengisi CV/foto snapshot.
- Profil snapshot dan pemilik menurut server yang berbeda ditampilkan sebagai ketidaksesuaian untuk diperiksa. Jangan memperbaikinya dengan menimpa salah satu sumber, atau memberikan hak akses berdasarkan isi archive.
- Perubahan pembimbing, gelar, CV, atau penugasan sidang di server hanya dapat diterapkan ke draft melalui tindakan penulis yang sesuai. Snapshot yang telah diajukan mempertahankan data saat diajukan.
- Untuk draft lama dengan penulis belum diketahui, minta pengguna menetapkan penulis atau meninjau kandidat profil. Jangan otomatis menyamakan pemilik laptop, akun login dan penulis semua file.
- Untuk KP, kekosongan data pembimbing kampus/instansi tetap menjadi field KP yang perlu diisi pada draft. Data TA dari `/me` tidak menjadi fallback.

### 3.6. Perubahan kode yang harus menutup seluruh jalur profil global

| Lokasi sekarang | Perubahan yang direncanakan |
| --- | --- |
| `electron/service/document-profile-service.ts` dan profile handler/preload | Hapus pembacaan profil tanpa konteks untuk render; profil default akun/lokal mempunyai API terpisah dari resolver dokumen |
| `src/hooks/use-printable.tsx` | Ganti `api.profile()` tanpa argumen dengan read model dari `DocumentRef`; tunggu data render lengkap sebelum menandai siap |
| `src/compiler/builder/cv-builder.ts` | Terima profil dan foto dari render context; hilangkan `window.profile.get()` dan `picture()` global |
| `src/components/editor/non-tiptap-editor/cv.tsx` | Editor CV mengubah CV draft aktif; tidak mengubah default global atau akun tanpa tindakan khusus |
| `src/components/printable/index.tsx` dan `single.tsx` | Preview penuh/bab dan metadata PDF memakai ref dan versi yang sama; tidak bergantung pada dokumen aktif jendela lain |
| `src/editor/document/index.ts` | Pisahkan pembacaan dokumen dari pembuatan/mutasi chapter dan variabel; pembacaan review tidak memiliki efek tulis |
| `src/editor/storage/hightex-db.ts` | Migrasikan key variabel menjadi gabungan scope dan nama; schema sekarang memakai `name` sebagai primary key sehingga scope `documentId` saja belum mencegah overwrite |
| Importer/exporter dan reader archive | Sertakan profil/aset penulis; reader review tidak memakai jalur import ke database draft dan tidak mengambil semua referensi global saat membentuk archive |
| Halaman submission/advisor dan service cloud | Bawa ID submission/dokumen, ref serta sesi yang eksplisit; jangan memakai profil/login atau slot cloud advisor sebagai target mahasiswa |

Audit juga akses `Document.instance`, `Document.current`, `window.parent` dan cache global yang membawa dokumen aktif. Pembaca data harus menerima ref atau instance eksplisit agar dua jendela review tidak saling mengganti profil maupun konten.

## 4. Tahap 0 — kunci kontrak dan batas server

- [ ] Jadikan `API_CLIENT.md` referensi kontrak; catat hasil verifikasi yang berbeda dari implementasi server aktual.
- [ ] Pastikan cloud saat ini diperlakukan sebagai satu dokumen aktif per akun: endpoint push/pull tidak menerima ID target. Jangan mendesainnya sebagai penyimpanan banyak proyek sebelum backend mendukungnya.
- [ ] Tentukan kategori TA/proposal yang benar-benar didukung dan aturan mengganti dokumen aktif. Status proposal tidak boleh diasumsikan mempunyai penugasan sidang TA.
- [ ] Verifikasi arti `X-HighTex-SHA256`: dokumentasi mencontohkan hash file, sedangkan exporter sekarang memakai gabungan JSON tanpa gambar. Gunakan hash byte archive sesuai kontrak yang disepakati; bila server memakai hash semantik, dokumentasikan secara terpisah dari hash file.
- [ ] Konfirmasi bentuk respons submission/list/detail/comment/review, bentuk foto, pagination bila ada, serta status selain yang sudah didokumentasikan. Gunakan fixture dari lingkungan pengujian, tanpa mengarang field respons.
- [ ] Uji server menerima archive v2 dengan profil dan aset tambahan serta mempertahankan file secara utuh. Jangan menaikkan schema version di luar versi yang didukung endpoint submission.
- [ ] Catat keterbatasan endpoint submit: body kosong memilih versi server terakhir. Tanpa pemeriksaan SHA secara atomik, desktop tidak bisa menjamin snapshot yang diajukan sama dengan hasil push ketika ada penulis dari perangkat lain.

Hasil tahap: fixture kontrak, keputusan hash, daftar kemampuan per jenis dokumen, dan daftar kebutuhan backend. Pekerjaan desktop yang tidak bergantung pada hasil verifikasi tetap dapat berjalan.

## 5. Tahap 1 — benahi fondasi API dan autentikasi

- [ ] Satukan perilaku HTTP dari `ServerService.request` dan `documentSyncRequest`: `Accept: application/json`, Bearer untuk endpoint terlindungi, normalisasi base URL, JSON, binary beserta header, respons kosong `204`, dan error terstruktur.
- [ ] Untuk `FormData`, hapus `Content-Type` manual agar runtime membuat boundary. Hapus perilaku `application/x-hightex` pada request multipart generik.
- [ ] Bedakan `401` sesi tidak valid, `403` verifikasi email/akses ditolak, `409` konflik/state workflow, dan `422` validasi field. Respons `403` review tidak otomatis menghapus sesi pengguna.
- [x] Hindari siklus error `/me` → event unauthorized → broadcast → `/me` berulang. Broadcast membaca hasil state yang sudah diselesaikan; gangguan jaringan tidak menghapus profil cache sebagai akun tidak valid.
- [x] Perbaiki handler IPC login agar mengembalikan Promise/hasil login. Pertahankan login langsung sebagai fallback selama transisi bila dibutuhkan.
- [x] Implementasikan login browser: `POST /auth/desktop` → ambil state dari `login_url` → simpan transaksi sementara → buka browser → cocokkan callback → `POST /auth/desktop/exchange` → simpan token dan user → broadcast sesi.
- [x] Daftarkan host `auth` pada router deep link; tangani callback saat aplikasi baru dibuka maupun sudah aktif di platform yang didukung. Tolak state salah/kedaluwarsa/terpakai; tangani pembatalan dan code kedaluwarsa. Tidak menyimpan password di desktop untuk alur browser.
- [x] Simpan `expires_at` sebagai metadata sesi; token tetap memakai `safeStorage`. Role kosong tidak menyebabkan crash; dukung pilihan konteks mahasiswa/advisor bila akun memiliki beberapa role. Server tetap penentu akses; `/me` belum mendokumentasikan daftar permission.
- [x] Logout mengambil token/server sesi, membatalkan request login lama dan membersihkan/broadcast sesi lokal, lalu mencoba `DELETE /logout` menggunakan token yang diambil. Logout lokal tetap selesai saat offline dan UI menjelaskan bila pencabutan server belum terkonfirmasi. Urutan ini mencegah hasil login lama mengaktifkan sesi kembali selama request logout.

Selesai bila: kedua alur login mengembalikan hasil yang benar, callback bekerja, logout server tersedia, dan error akses tidak menciptakan loop sesi.

## 6. Tahap 2 — data dokumen mandiri, KP, dan migrasi

- [ ] Tambahkan versi penyimpanan lokal untuk profil/aset dan data akademik per dokumen. Resolver menerima `documentId`; seluruh jalur editor, preview, PDF, dan CV memakai resolver yang sama.
- [ ] Buat form Data Dokumen untuk identitas, foto/CV, pembimbing, penguji/ketua bila sesuai, pejabat, dan tanggal. Form KP memisahkan pembimbing kampus, pembimbing instansi, lokasi, serta tanggal persetujuan/pengesahan.
- [ ] Hapus fallback KP yang memakai pembimbing TA sebagai pembimbing instansi. Hindari NIP/nama pejabat/tanggal hari ini yang di-hardcode seolah data sebenarnya. Tampilkan field belum terisi dan minta pengguna melengkapinya sesuai kebutuhan dokumen.
- [ ] Backup data lama sebelum migrasi. Pertahankan seluruh `config.intern`, tanggal, dan data pejabat. Jangan menyalin profil global ke semua dokumen lama: file dapat berasal dari mahasiswa lain atau pernah dibuka untuk review. Migrasi idempoten dan tidak menimpa data yang sudah diedit.
- [ ] Dokumen lama tanpa profil mendapatkan status penulis belum dikonfirmasi. Profil lokal lama hanya menjadi kandidat yang dapat diterapkan per draft setelah ditinjau; tidak pernah diterapkan ke snapshot review. Jangan mengklaim kandidat tersebut sebagai profil historis asli.
- [ ] Data akun tidak menggantikan dokumen saat login. Aksi Ambil data akun memperlihatkan perbedaan dan pilihan field; `null` server tidak diam-diam menghapus data manual. Untuk KP, hanya tawarkan identitas/foto/CV.
- [ ] Variabel profil menjadi scope dokumen dengan primary key gabungan scope dan nama. Jangan meratakan objek pembimbing menjadi `String(object)`; petakan key legacy yang dipakai template secara eksplisit. Field penulis yang kosong tidak fallback ke variabel profil global; simbol statis yang tidak mewakili identitas dapat tetap global. Default profil hanya untuk pembuatan dokumen baru yang penulisnya dipilih.
- [ ] Profile global/settings tetap sebagai template default. Hapus toggle `preferCloudProfile` setelah semua pembaca data memakai resolver baru.

Selesai bila: dua dokumen dengan penulis/pembimbing berbeda tetap menghasilkan output masing-masing setelah pergantian akun, restart, dan penggunaan offline; KP tidak memerlukan server.

## 7. Tahap 3 — archive utuh dan sinkronisasi yang aman

- [ ] Lengkapi export/import v2 agar mempertahankan profil, data akademik, konfigurasi, foto, CV, konten, variabel dan aset. Usulan entry tambahan: `files/profile.json` dan aset profil dengan referensi eksplisit; finalisasi setelah uji kompatibilitas server.
- [ ] Perbaiki kehilangan `config` pada import v2 serta metadata keyword Inggris yang sekarang mengambil keyword Indonesia pada manifest. Jangan mengganti kategori yang tidak dikenal ke kategori pertama secara diam-diam.
- [ ] Pertahankan pembacaan archive lama dan format web yang memang didukung kontrak. Archive lama tanpa profil memperoleh status perlu dilengkapi, tanpa mengambil profil akun reviewer.
- [ ] Hasil export untuk upload berupa byte yang tetap. Jika kontrak hash file dipakai, hash seluruh byte termasuk gambar; buat archive deterministik atau gunakan ulang artifact yang sama ketika konten belum berubah agar timestamp export tidak membuat upload palsu.
- [ ] Pindahkan binding/hash global `current` ke state per server, akun, dan dokumen. Menampilkan daftar commit hanya memperbarui informasi versi server, tidak mengubah `baseSha256` lokal.
- [ ] Setelah pull: baca `X-Document-ID` dan hash, verifikasi sesuai kontrak, validasi archive, minta konfirmasi overwrite bila perlu, backup lokal, import secara atomik, baru simpan binding dan base SHA. Batal/gagal import tidak mengubah base.
- [ ] Download archive lama menjadi salinan riwayat terpisah; tidak mengubah base dokumen aktif. Restore menjadi tindakan eksplisit dengan backup, tanpa menautkan snapshot lama ke versi aktif secara diam-diam.
- [ ] Setelah push berhasil, simpan SHA yang dikonfirmasi server untuk artifact yang dikirim. Edit lokal yang terjadi selama upload tetap dianggap perubahan baru.
- [ ] Pada `409`, pertahankan salinan lokal dan tawarkan unduh server sebagai salinan untuk dibandingkan. Force overwrite hanya sebagai tindakan eksplisit dengan penjelasan dampak dan backup; jangan retry force otomatis.
- [ ] Penggantian dokumen yang terhubung ke slot cloud akun harus eksplisit. Pergantian server/akun tidak memakai binding sebelumnya. Operasi tidak selesai dari akun lama tidak boleh memperbarui state akun baru.
- [ ] Terapkan kebijakan KP pada service dan UI; akses fitur tidak hanya dibatasi lewat menyembunyikan tombol.

Selesai bila: skenario lokal berbasis A, server sudah B, refresh riwayat, lalu push tetap mengirim base A dan menghasilkan konflik. Round-trip archive mempertahankan hasil cetak termasuk KP.

## 8. Tahap 4 — profil akun online

- [x] Implementasikan halaman profil akun dengan `GET /me` dan `POST /profile` melalui service/preload bertipe.
- [x] Upload foto PNG/JPG/JPEG/WEBP maksimal 2 MB, edit CV HTML, dan penghapusan CV lewat string kosong. Field tidak dikirim tidak berubah; tampilkan error `422` per field.
- [x] Setelah sukses, perbarui cache akun dan broadcast data terbaru. Profile dokumen tetap berubah hanya lewat aksi penerapan eksplisit.
- [x] Cache foto/CV akun dipisahkan per server dan akun; salinan foto yang sudah dipakai dokumen menjadi aset dokumen sendiri. Perlakukan HTML CV sebagai konten tidak tepercaya saat ditampilkan.
- [x] Tampilkan `name` dan `shortname` dari server. Data degree dipakai sebagai data terstruktur, tanpa menggandakan gelar. Mengedit nama/degree/shortname tidak termasuk API yang tersedia; arahkan ke pengaturan web bila dibutuhkan.

Selesai bila: foto/CV akun dapat diubah dan perubahan dapat diterapkan ke dokumen tertentu tanpa mengubah dokumen lain.

## 9. Tahap 5 — submission mahasiswa

- [ ] Ganti placeholder `StudentSubmission` dengan riwayat/status melalui `GET /submission`, dan riwayat dokumen melalui `GET /submission/{document}`.
- [ ] Sediakan Ajukan review pada dokumen lokal yang terhubung ke dokumen akun. Validasi login, dukungan jenis/kategori, data wajib, dan status submission aktif.
- [ ] Urutan pengajuan: simpan perubahan editor → bekukan artifact lokal → push artifact → hentikan jika gagal/konflik → `POST /submission` tanpa body → tampilkan submission yang dikonfirmasi server.
- [ ] Bedakan hasil push berhasil tetapi pengajuan gagal; retry pengajuan tidak otomatis mengekspor atau mengirim versi lain. Cegah klik ganda; setelah timeout, cek riwayat/status sebelum mengulang request pembuat submission.
- [ ] Tangani `409` masih ada submission aktif dan `422 document` archive/konten tidak valid. Status offline tidak dianggap pengajuan sukses dan tidak membuat submission lokal palsu.
- [ ] Tampilkan detail hasil review lewat `GET /submission/{submission}/detail` hanya saat `reviewed`; snapshot `GET /submission/{submission}/file` dapat dibuka sejak `waiting_for_review`, sesuai akses.
- [ ] Verifikasi hash file snapshot dan identitas dokumen dari header. Download snapshot tidak mengganti dokumen kerja atau base sinkronisasi; tampilkan snapshot sebagai versi yang diajukan.
- [ ] Tampilkan keterbatasan konsistensi versi sampai backend menyediakan pengajuan bersyarat SHA. Memeriksa commit sebelum submit hanya mitigasi, bukan jaminan atomik.

Selesai bila: versi yang ditampilkan sebagai submission berasal dari snapshot server dan push berikutnya tidak mengubahnya; kegagalan pengajuan dapat dipulihkan tanpa submission ganda.

## 10. Tahap 6 — advisor, mahasiswa bimbingan, dan review

- [x] Implementasikan `GET /advisor/students` untuk mentorship aktif dan `GET /submission` untuk antrean review. Detail pemilihan mahasiswa mengikuti data akses yang benar-benar disediakan API.
- [x] Gunakan `GET /submission/{document}` untuk riwayat dokumen yang dapat diakses. Advisor tidak memakai endpoint pull dokumen akun sendiri untuk mengambil dokumen mahasiswa.
- [ ] Download snapshot lewat endpoint file submission dan buka dengan reader/cache review terpisah sesuai bagian 3. Snapshot tetap hanya bisa dibaca, memakai profil mahasiswa dalam archive, dan tidak masuk repository draft. Sediakan aksi membuat salinan lokal secara eksplisit jika dibutuhkan.
- [x] Implementasikan `POST /submission/{document}/on-review` dan `POST /submission/{document}/review`. Gunakan ID dokumen pada kedua endpoint, bukan ID submission.
- [x] Implementasikan `POST /submission/{submission}/comment`; komentar string maksimal 200 karakter. Jangan mengasumsikan API mendukung anotasi per paragraf, pengeditan komentar, atau penghapusan komentar.
- [x] Refresh state dari server setelah perubahan; tangani mentorship dicabut, submission sudah berubah status, dan `403/404` snapshot lama/tidak tersedia. Respons ditolak tidak dianggap status berhasil.
- [x] Gabungkan atau hapus halaman `review.tsx` placeholder agar hanya ada satu alur review yang terhubung route dan navigasi.

Status implementasi: alur utama tersedia pada langkah 5; tombol salinan lokal eksplisit belum termasuk. Batas penemuan riwayat dan atomicity server dijelaskan pada summary langkah 5.

Selesai bila: advisor dapat memilih mahasiswa, membuka snapshot, memulai review, memberi komentar, menyelesaikan review, dan mahasiswa melihat hasilnya.

## 11. Cakupan endpoint

| Endpoint | Tahap |
| --- | --- |
| `POST /login` | 1: fallback login langsung dan perbaikan IPC |
| `POST /auth/desktop`, `POST /auth/desktop/exchange` | 1: login browser |
| `DELETE /logout`, `GET /me` | 1: sesi; 4: profil |
| `POST /profile` | 4: foto dan CV akun |
| `GET /categories`, `GET /document` | 0 dan 3: kategori serta dokumen aktif akun |
| `GET /v2/documents/pull`, `POST /v2/documents/push`, `GET /v2/documents/commits` | 3: sinkronisasi dan riwayat |
| `GET /submission`, `POST /submission`, `GET /submission/{document}` | 5 dan 6: riwayat, pengajuan, antrean |
| `POST /submission/{document}/on-review`, `POST /submission/{document}/review` | 6: transisi review |
| `POST /submission/{submission}/comment` | 6: komentar |
| `GET /submission/{submission}/detail`, `GET /submission/{submission}/file` | 5 dan 6: hasil dan snapshot |
| `GET /advisor/students` | 6: mentorship aktif |
| `POST /issues` | 1: pertahankan integrasi; validasi judul akhir maksimal 100 termasuk suffix versi |

## 12. Kebutuhan backend yang dipisahkan dari pekerjaan desktop

Desktop dapat menyelesaikan fitur lokal KP tanpa menunggu perubahan server. Dukungan berikut membutuhkan kontrak backend tambahan atau verifikasi khusus:

1. **KP terstruktur:** pembimbing kampus/instansi, identitas instansi, lokasi, tanggal dan penugasan terkait. Jangan menumpangkan data tersebut pada `thesis_data`.
2. **KP cloud/review:** kategori yang didukung, dokumen target, permission, mentorship KP, status pengajuan, dan preservasi archive. Dukungan menyimpan file saja tidak sama dengan dukungan workflow KP.
3. **Pengajuan versi tertentu:** endpoint submit memeriksa expected SHA/dokumen secara atomik lalu membuat snapshot, dengan konflik bila versi berubah. Pertimbangkan idempotency key untuk retry setelah timeout.
4. **Banyak dokumen per akun:** ID dokumen target eksplisit pada push/pull/commits/submission bila TA, proposal, dan KP perlu berjalan bersamaan. API sekarang belum mendokumentasikannya.
5. **Kemampuan akun/server:** kontrak capabilities/permission bila perlu agar desktop tidak menebak dukungan dari role/kategori. Sampai ada, gunakan kebijakan konservatif berdasarkan kontrak teruji dan tetap tangani penolakan server.
6. **Integritas dan atomicity sinkronisasi:** server menghitung hash byte upload, memigrasikan label hash legacy secara terverifikasi, dan mengunci pemeriksaan base serta penulisan file/commit agar dua push serentak tidak saling menimpa. Target ID dokumen pada push perlu diperiksa bersyarat. Client sudah memakai hash seluruh byte dan menolak download yang hash-nya tidak cocok; pengujian konflik berurutan tidak membuktikan atomicity server.

Bagian ini adalah usulan kontrak, bukan endpoint yang dianggap sudah tersedia. Release harus menyatakan batas dukungan yang masih ada, terutama pengajuan versi atomik dan KP online.

## 13. Validasi dan urutan pengiriman

Urutan pengiriman mengikuti **Checklist next steps** di awal dokumen. Model penulis per dokumen dan reader snapshot sudah menjadi langkah 1–2; pekerjaan lanjutan dikirim per fitur yang bisa direview. Perbaikan archive/sinkronisasi menjadi prasyarat pengajuan. Kelengkapan form KP dikerjakan pada langkah tersendiri, sedangkan dukungan KP online menunggu kontrak backend.

Syarat sebelum mengaktifkan setiap jalur review: render memakai sumber snapshot yang eksplisit dan data penulis snapshot; review tidak menulis repository draft; tidak ada fallback profil global. Viewer isi pada langkah 2 memenuhi batas pemisahan tersebut, tetapi belum memenuhi target preview/PDF final. Jalur PDF snapshot kini diaktifkan pada langkah 6 melalui halaman cetak dengan store memori terpisah; compiler/resolver yang ada tidak diubah. Menambahkan halaman antrean dan tombol review saja belum menyelesaikan seluruh target review.

Matriks penerimaan pemisahan akun dan penulis:

| Skenario | Hasil yang wajib |
| --- | --- |
| Advisor D mereview mahasiswa A | Cover, foto, CV, pembimbing dan metadata PDF berasal dari snapshot A; komentar ditulis sebagai D |
| D membuka A dan B pada dua jendela | Isi, profil, variabel, gambar dan referensi terpisah; pergantian fokus tidak mengubah hasil |
| D ber-role student dan advisor lalu berganti menu | Dokumen diri D tetap milik D; snapshot A tetap berpenulis A; hak API dievaluasi terhadap target operasi |
| Submission S1 dan S2 dari dokumen A dibuka bersamaan | Setiap tampilan mengikuti SHA/isi/profil versinya sendiri; draft A terbaru tidak tertimpa |
| Snapshot A tidak menyertakan profil/CV | Field tidak tersedia ditandai; profil atau CV D tidak pernah dipakai |
| D mengubah foto/CV akunnya saat A terbuka | Hanya akun D yang berubah; snapshot A dan PDF-nya tetap memakai data A |
| File A diimpor ketika akun D login, termasuk saat migrasi | Tidak otomatis ditetapkan sebagai dokumen D dan tidak otomatis terhubung ke cloud D |
| D logout atau masuk akun lain saat download/render berlangsung | Hasil operasi akun lama tidak dipasang ke konteks akun baru; salinan draft lain tetap utuh |
| A mengubah pembimbing sesudah S1 diajukan | S1 mempertahankan pembimbing lama; perubahan hanya diterapkan pada draft/versi berikutnya |
| Dokumen KP tanpa data server dibuka oleh advisor | Data KP dalam paket tetap digunakan; data pembimbing TA advisor tidak mengisi field yang kosong |

Pengujian utama:

- Kontrak HTTP dengan mock: JSON/multipart/binary/204; `401`, `403`, `409`, dan error field `422`.
- Login: hasil IPC, role kosong/multi-role, callback state salah, kedaluwarsa/replay, startup dari deep link, logout offline dan akun berpindah saat request berjalan.
- Migrasi: idempoten, data lama terjaga, konfigurasi KP tidak hilang, default profil tidak mengubah dokumen yang sudah dibuat.
- Archive: export → import → preview/PDF mempertahankan profil, foto, CV, KP, konfigurasi dan keyword dua bahasa; archive lama tetap terbaca.
- Sinkronisasi: refresh tidak mengubah base, pembatalan/gagal import tidak mengubah state, restore archive terpisah, gambar terhitung dalam hash yang disepakati, binding terpisah per akun/server, konflik tidak menghapus lokal.
- Workflow: push gagal tidak mengajukan; push sukses/submit gagal dapat dipulihkan; klik ganda/timeout tidak menggandakan submission; snapshot tetap setelah push berikutnya; ID endpoint review benar; komentar >200 ditolak dengan pesan jelas.
- Uji integrasi server pada akun mahasiswa/advisor terverifikasi di lingkungan pengujian. Gunakan Postman CLI yang tersedia untuk koleksi kontrak bila sesuai; token tidak dimasukkan ke repo.
- Jalankan typecheck, lint pada perubahan terkait, dan test yang relevan. Uji manual offline, dua akun, dua perangkat, dokumen KP, serta output PDF untuk setiap jenis dokumen.

Definisi selesai: seluruh endpoint terdokumentasi mempunyai alur desktop yang dapat dipakai sesuai kemampuan server; dokumen lokal portabel dan konsisten; KP lokal lengkap; keterbatasan KP online dan pengajuan versi atomik tercatat sebagai kebutuhan backend, tanpa menyatakan fitur itu telah didukung.
