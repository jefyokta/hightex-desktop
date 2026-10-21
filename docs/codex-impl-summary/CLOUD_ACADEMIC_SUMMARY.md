# Data Akademik Otomatis untuk Dokumen Cloud

Perubahan lanjutan setelah langkah 4, belum di-commit. Instruksi pengguna memperbarui aturan sebelumnya: **penulis dan data akademik draft cloud mengikuti server dan tidak bisa diedit**. Judul, isi bab, CV/foto, keyword, kategori dan tanggal tetap dapat diedit; dokumen lokal tetap memakai alur manual lama.

## Sumber Data

| Field dokumen | Sumber server |
| --- | --- |
| Nama/NIM penulis | `/me`: `name`, `identity_number` |
| Pembimbing utama/kedua | `/me.advisors`, dengan `advisor_role: primary/secondary` dari mentorship aktif |
| Ketua sidang | `/me.thesis_data.session_chair.name` |
| Penguji pertama/kedua | `/me.thesis_data.first_examiner.name`, `second_examiner.name` |
| Nama/NIP kaprodi | `/university-data.data.lead_program_study` |
| Nama/NIP dekan | `/university-data.data.dean` |

Nama dipakai sesuai format server, termasuk gelar; tidak ditambah gelar lagi. Urutan array pembimbing dan role pertama akun tidak dipakai untuk menentukan penugasan. Assignment kosong mengosongkan nilai manual lama. Assignment ambigu atau respons tidak sesuai kontrak ditolak.

## Perilaku Sekarang

- Saat membuka editor/pengaturan draft yang terikat ke cloud, data server dimuat dan disimpan sebagai cache per dokumen. Pengaturan penulis dan panitia/pejabat memakai kartu lama dengan field terkunci.
- Unduhan **terbaru** yang diterapkan sebagai draft cloud memakai data server terkini. Salinan archive/riwayat dan viewer submission tetap membaca identitas paketnya.
- Sebelum push/pengajuan, exporter membekukan data akademik server bersama isi tersimpan. Untuk dokumen yang belum tertaut, persiapan artifact tidak menulis identitas server ke draft lokal; cache diterapkan setelah upload berhasil.
- Main process memeriksa field penulis/akademik artifact terhadap server sebelum push. Versi tersimpan juga diperiksa sebelum POST submission. Data yang berubah menghentikan operasi; aplikasi tidak diam-diam mengubah byte atau hash percobaan pengajuan lama.
- Penyimpanan `updateDocument`/`updateProfile` mempertahankan field yang dikunci meskipun form lama mengirim data stale. CV, foto, judul dan tanggal tetap dapat disimpan.
- Lock dokumen yang terikat tetap dapat diketahui setelah logout. Saat offline atau akun pemilik tidak sesuai, nilai cache dipertahankan dan field tetap terkunci; akun pembaca tidak dijadikan penulis pengganti.
- Konteks data diperiksa terhadap akun, server dan ID dokumen milik akun melalui `/document`. Editor/setting/push yang baru ini tidak mengambil data akademik untuk snapshot mahasiswa yang dibaca advisor.
- Penanda `cloudAcademic` hanya metadata lokal pada record dokumen. Export tidak memasukkannya ke archive; paket yang dibuat menjadi salinan lokal tidak membawa lock akun asal.

Compiler, resolver, utilitas stylesheet dan viewer submission tidak diubah. Perubahan editor hanya memuat data draft sebelum komponen lama membacanya.

## Breaking Changes dan Migrasi

1. **Field manual penulis/pembimbing/penguji/kaprodi/dekan pada draft cloud digantikan nilai server** saat refresh otomatis. Untuk perbaikan data tersebut, ubah sumber server; field kosong tidak dapat diisi manual pada draft cloud. Dokumen lokal tanpa binding tetap bisa diedit seperti sebelumnya.
2. **Push dan submit memerlukan data akademik server yang dapat diverifikasi.** Bila `/university-data` tidak tersedia atau assignment berubah sejak artifact disiapkan, operasi ditolak. Percobaan pengajuan `uploaded` yang sudah usang perlu dibatalkan lalu disiapkan ulang; percobaan `uncertain` tetap mengikuti aturan pemeriksaan riwayat langkah 4.
3. **Main/preload mendapat IPC tambahan.** Restart aplikasi/development. Tidak ada perubahan schema IndexedDB, format archive v2 atau endpoint backend yang ditulis oleh desktop; tidak perlu menghapus/migrasikan database.
4. Draft yang terikat ke akun/server lain tetap terkunci dan tidak otomatis memakai data akun baru. Gunakan salinan lokal terpisah untuk akun baru.

## Validasi Aktual

- **111 test lolos, 0 gagal**, 17 file dan 439 assertion. Mencakup pemetaan role pembimbing, thesis student yang salah, pergantian akun, lock setelah logout, field kosong, save stale, CV/foto/tanggal editable, validasi sebelum upload/submit, isolasi draft dan archive tanpa marker lokal.
- Typecheck, lint kode inti terkait dan build renderer/main/preload lolos. Warning ukuran chunk dari build tetap ada.
- GUI Electron dengan profil sementara menguji pengisian data server pada form pengaturan lama, field identitas/kaprodi/dekan disabled, judul tetap editable, dan identitas dokumen lokal masih editable. Alur pengajuan, pemulihan timeout dan akun multi-role juga diperiksa.
- Uji server lokal read-only: `bun run tests/integration/local-server.ts --academic`. Respons `/me`, `/document` dan `/university-data` dipetakan ke salinan artifact dalam memori, lolos pemeriksaan main client, lalu dipastikan byte file cloud server tetap sama. Tidak ada push, submit atau perubahan review dari pengujian ini.
- Server lokal saat diperiksa mengembalikan kaprodi `test`/NIP `test` dan dekan `test2`/NIP `test2`. Desktop menampilkan nilai respons tersebut, bukan nama pejabat hardcoded lain.
- Uji GUI masih memunculkan warning lama pada `DialogOverlay`, nesting tombol date picker, serta deprecation tooling. Komponen bersama tersebut tidak diubah.

## Cara Review

1. Restart `bun run dev`, login pemilik dokumen, lalu unduh terbaru melalui **Dokumen cloud** atau buka draft yang sudah tertaut.
2. Buka pengaturan editor. Nama/NIM, pembimbing, panitia sidang, kaprodi dan dekan harus mengikuti server dan tidak dapat diedit. Nama pada `/me` sudah berisi gelar.
3. Ubah judul, tanggal, CV/foto dan isi bab; perubahan harus tersimpan. Bandingkan dengan dokumen lokal tanpa binding: data penulisnya tetap dapat diedit.
4. Ubah penugasan di server lalu buka kembali editor/pengaturan atau siapkan push baru. Nilai terbaru harus digunakan; perubahan penugasan di tengah upload/pengajuan harus menghentikan operasi bila terdeteksi.
5. Coba offline/logout dan akun lain. Field cloud tetap terkunci memakai cache; identitas akun baru tidak mengganti penulis lama.
6. Buka snapshot submission lama sebagai advisor. Identitas dan pejabat tetap mengikuti paket snapshot, bukan profil akun atau data server yang baru.

KP online tetap belum didukung. Batas atomik submit terhadap SHA server dari langkah 4 tetap berlaku. Workflow advisor langkah 5 belum ditambahkan pada perubahan ini.
