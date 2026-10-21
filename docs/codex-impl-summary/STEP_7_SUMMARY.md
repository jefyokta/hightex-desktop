# Langkah 7 — Autentikasi Desktop

Tanggal: 21 Oktober 2026. Status: **siap review**. Dikerjakan berurutan bersama langkah 6–8; belum di-commit.

## Perubahan

Modal login lama sekarang menyediakan **Masuk melalui browser**, status menunggu/verifikasi, pembatalan, dan login email/password sebagai fallback. Tombol dikunci selama operasi. Password dikosongkan ketika modal ditutup dan tidak disimpan oleh alur browser.

Service memanggil `POST /auth/desktop`, memvalidasi origin URL login terhadap server aktif, mengambil state 64 karakter dan menyimpan transaksi lokal selama maksimal lima menit. Callback `hightex://auth/callback` harus cocok dengan state/server, mempunyai satu parameter code/state yang valid, dan belum kedaluwarsa. Transaksi dikonsumsi sebelum `POST /auth/desktop/exchange`; code tidak diulang otomatis setelah kegagalan/timeout. Cancel, logout atau login yang lebih baru membatalkan hasil request lama.

Host `auth` sekarang terdaftar pada controller protokol. Listener macOS `open-url` dipasang saat bootstrap dan menunggu aplikasi siap. Windows/Linux menangani argumen startup serta `second-instance`; callback awal dapat diantrekan, kemudian aplikasi dibawa ke depan. Registrasi protokol runtime melengkapi konfigurasi protocol installer yang sudah ada.

Token tetap disimpan melalui `safeStorage`. Login browser menyimpan `expires_at` dari server; login langsung menyimpan deadline berdasarkan `exp` 30 hari yang diminta karena respons login lama tidak menyertakan expiry. Timer expiry dibatasi agar durasi 30 hari tidak melampaui batas timer Node. Expiry/perubahan server menghapus sesi baru yang terikat server tersebut dan memberitahu jendela aplikasi. Token lama yang belum memiliki metadata tetap kompatibel; login ulang diperlukan agar mempunyai metadata expiry/binding server baru.

Logout mengambil token/server saat ini, langsung membersihkan sesi lokal dan membatalkan operasi login, lalu mencoba `DELETE /logout` dengan token yang diambil tersebut. Kegagalan jaringan tidak mengembalikan sesi lokal. UI menampilkan informasi bila pencabutan token belum terkonfirmasi. Kegagalan jaringan atau `403` saat refresh `/me` mempertahankan cache akun/token; `401` membatalkan transaksi login dan membersihkan sesi. Broadcast tidak mengambil `/me` kembali; respons refresh lama pada renderer juga tidak dapat menimpa broadcast sesi yang lebih baru.

Role kosong menghasilkan `role: null`, bukan otomatis student. Daftar `roles` tetap dipakai untuk konteks fitur; permission akhir mengikuti server. Pelaporan issue mempertahankan alur lama dan membatasi judul lengkap beserta suffix desktop ke 100 karakter serta deskripsi ke 65535, sesuai API. Pengujian tidak mengirim issue.

## Breaking Changes dan Migrasi

- `User.role` sekarang dapat `null`; pemakai yang mengasumsikan role selalu tersedia harus memeriksa nilainya atau memakai array `roles`.
- IPC `session:logout`/`window.session.logout()` sekarang mengembalikan `{ revoked: boolean }`; pemanggil yang mengabaikan hasil tetap bisa berjalan. UI aplikasi sudah disesuaikan. Method login lama tetap mengembalikan `User | false`; method `signIn` baru mengembalikan hasil/error bertipe.
- Tidak ada migrasi dokumen atau format archive. Metadata sesi/transaksi baru ditambahkan otomatis. Restart main/preload diperlukan. Sesi lama tanpa metadata tidak ditebak expiry atau asal servernya; login ulang mengaktifkan metadata baru.

## Validasi

- Test client: transaksi bertahan setelah restart service, state/host/parameter salah ditolak, expired/cancel/server berubah, replay, respons hilang, empty roles, login bersamaan, logout saat exchange berjalan, serta logout offline.
- Test penyimpanan sesi: deadline 30 hari menggunakan timer yang aman; expiry dan perubahan server membersihkan token/user.
- Server lokal `bun run tests/integration/auth-server.ts` **lolos**: login web dengan cookie/CSRF, start → authorize → callback → exchange → `/me`, replay ditolak, logout berhasil dan token lama mendapat `401`. Token hanya berada di memori pengujian dan dicabut; cookie sesi uji juga ditutup.
- GUI fixture memakai modal sebenarnya: mulai login browser, menunggu, cancel, login langsung dan penutupan modal lolos. Unit suite gabungan **154 lolos**, typecheck dan build lolos. Lint kode baru/fitur lolos; preload masih mempunyai 13 pelanggaran `no-explicit-any` lama dan splash 1 pelanggaran lama; pemeriksaan dengan aturan itu dinonaktifkan pada kedua file tersebut lolos. Main, Settings dan handler yang disentuh lolos lint penuh.
- Uji HTTP tidak membuktikan pemasangan protokol OS. Alur callback melalui installer macOS/Windows/Linux perlu dicoba pada build terpasang; tidak diklaim sudah diuji pada ketiga OS.

## Cara Review

1. Restart aplikasi, logout bila perlu, lalu pilih **Masuk melalui browser**. Selesaikan login di browser; callback harus mengaktifkan akun dan membawa aplikasi ke depan.
2. Ulangi dengan menutup aplikasi setelah transaksi dimulai, lalu selesaikan login di browser dalam lima menit. Pada aplikasi terpasang, callback harus membuka aplikasi dan memakai transaksi yang tersimpan.
3. Batalkan login browser, coba login langsung, lalu logout saat offline. Logout lokal harus selesai dan informasi pencabutan yang belum terkonfirmasi harus terlihat.
4. Periksa akun multi-role/role kosong dan pergantian akun saat request berjalan. Dokumen/submission yang terbuka tetap mempunyai penulisnya sendiri.
