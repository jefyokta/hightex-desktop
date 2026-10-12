# HighTex Desktop

<p align="center">
  <img src="./electron-vite.png" alt="Logo HighTex Desktop" width="180">
</p>

<h1 align="center">HighTex Desktop</h1>

<p align="center">
  Editor tugas akhir berbasis desktop untuk HighTex.
</p>

<p align="center">
  <a href="https://github.com/jefyokta/hightex-desktop/releases/latest">
    <img src="https://img.shields.io/github/v/release/jefyokta/hightex-desktop?label=version" alt="Versi terbaru">
  </a>
</p>

<p align="center">
  <a href="https://github.com/jefyokta/hightex-desktop/releases">
    <img src="https://img.shields.io/github/downloads/jefyokta/hightex-desktop/total?label=total%20downloads" alt="Total unduhan">
  </a>
  <a href="https://github.com/jefyokta/hightex-desktop/releases/latest">
    <img src="https://img.shields.io/github/downloads/jefyokta/hightex-desktop/latest/total?label=latest%20release" alt="Unduhan rilis terbaru">
  </a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>Bahasa Indonesia</strong>
</p>

HighTex Desktop adalah versi desktop dari HighTex, aplikasi penulisan tugas akhir yang awalnya saya kembangkan sebagai proyek tugas akhir perkuliahan.

Tujuannya sederhana: membantu mahasiswa fokus menulis tugas akhir tanpa harus berkutat dengan masalah pemformatan dokumen.

---

## Mengapa HighTex?

> HighTex merupakan singkatan dari **High-Level of LaTeX**.

HighTex bermula dari proyek tugas akhir saya di Program Studi Sistem Informasi, UIN Sultan Syarif Kasim Riau.

Program studi kami mewajibkan tugas akhir mengikuti standar pemformatan akademik yang ketat. Mahasiswa juga dianjurkan menggunakan LaTeX untuk menghasilkan dokumen yang konsisten dan profesional.

LaTeX memang sangat andal, tetapi banyak mahasiswa baru mengenalnya ketika mulai menulis tugas akhir. Akibatnya, banyak waktu tersita untuk mempelajari perintah, memperbaiki masalah pemformatan, dan mencari solusi atas kesalahan kompilasi, alih-alih berfokus pada penelitian itu sendiri.

HighTex adalah upaya saya untuk membuat penulisan tugas akhir lebih mudah diakses. Tujuannya bukan menggantikan standar akademik, melainkan memudahkan mahasiswa dalam mengikutinya melalui pengalaman menulis yang lebih ramah pengguna.

Proyek ini awalnya dikembangkan sebagai aplikasi web, kemudian berkembang menjadi aplikasi desktop.

### Mengapa namanya HighTex jika tidak memiliki compiler LaTeX?

Nama tersebut sudah ada sebelum rancangan aplikasi seperti sekarang.

Proposal tugas akhir saya awalnya bertujuan mempermudah penulisan menggunakan LaTeX. Ide pertamanya adalah mengonversi HTML menjadi kode LaTeX, kemudian menggunakan compiler LaTeX untuk menghasilkan PDF. Dari situlah nama *High-Level of LaTeX* berasal.

Dosen pembimbing saya menolak pendekatan tersebut karena compiler LaTeX tidak diperlukan selama format dokumen tetap dapat dipertahankan.

Akibatnya, proses kompilasi digantikan dengan pembuatan PDF melalui browser. Saya tetap mempertahankan namanya, meskipun LaTeX tidak lagi menjadi bagian dari proses utama aplikasi.

### Apa yang berubah akibat keputusan tersebut?

Karena HighTex tidak lagi menghasilkan atau memproses kode LaTeX, beberapa alat yang sebelumnya digunakan mahasiswa tidak lagi relevan.

- **SmartTA** memeriksa dokumen dengan menganalisis kode sumber LaTeX. Karena HighTex tidak lagi menghasilkan kode LaTeX, SmartTA tidak lagi digunakan dan telah digantikan oleh **HighTex Validator**.

---

## Mengapa Aplikasi Desktop?

### Belum ada kepastian jadwal deployment

Rencana awalnya adalah melakukan deployment versi web, tetapi hingga kini belum ada kepastian mengenai jadwal rilis resminya.

Teman-teman terus bertanya kapan mereka bisa menggunakannya, sementara saya tidak memiliki jawaban pasti. Sebagai solusi sementara, saya melakukan deployment tidak resmi berdasarkan permintaan. Aplikasi hanya diaktifkan ketika ada yang ingin menggunakannya, sambil menunggu deployment resmi.

Daripada terus menunggu tanpa kepastian, saya memutuskan untuk membangun versi yang bisa langsung digunakan mahasiswa.

### Sumber daya server

Aplikasi web membawa biaya dan tanggung jawab infrastruktur. Harus ada pihak yang menyediakan penyimpanan, memelihara cadangan data, memantau penggunaan, dan membayar biaya server.

Saya pernah mencoba menjalankan aplikasi ini sendiri di server kecil, tetapi kapasitasnya tidak mencukupi. Pembuatan dokumen membutuhkan sumber daya yang cukup besar, dan saya tidak ingin terus mengeluarkan biaya untuk proyek non-profit.

Dengan aplikasi desktop, dokumen dapat disimpan secara lokal di komputer pengguna. Hal ini mengurangi berbagai keterbatasan infrastruktur yang sebelumnya memengaruhi keputusan pengembangan.

### Mengutamakan penggunaan offline

Menulis tugas akhir seharusnya tidak bergantung pada ketersediaan internet.

Mahasiswa seharusnya tetap bisa bekerja, baik di rumah, di kampus, maupun di tempat lain yang tidak memiliki koneksi internet yang andal.

### Lebih bebas bereksperimen

Ada banyak fitur yang ingin saya kembangkan selama bertahun-tahun, tetapi terus tertunda karena sulit dibenarkan jika harus dijalankan di server:

- Berapa banyak ruang penyimpanan yang dibutuhkan?
- Berapa biaya operasionalnya?
- Apakah fitur tersebut akan memengaruhi pengguna lain?
- Apakah aman jika fitur tersebut tersedia di server publik?

Pertanyaan seperti ini sering menentukan fitur apa yang bisa dan tidak bisa dikembangkan. Di aplikasi desktop, sebagian besar kendala tersebut berkurang sehingga fitur dapat dirancang berdasarkan kebutuhan pengguna, bukan semata-mata biaya server.

---

## HighTex vs. HighTex Desktop

HighTex Desktop merupakan pengembangan dari HighTex versi web dengan fitur tambahan, sambil mempertahankan pengalaman penyuntingan inti yang sama. Namun, beberapa fitur yang tersedia di versi web belum diimplementasikan di versi desktop (saat ini, HighTex v0.9.x). Sebaliknya, aplikasi desktop juga menghadirkan kemampuan yang tidak tersedia di versi web.

### Fitur yang Belum Tersedia di HighTex Desktop

#### Validasi Dokumen Bertanda Tangan

Pemindaian dan validasi dokumen sudah tersedia di HighTex Desktop. Namun, validasi bertanda tangan yang memberikan bukti tepercaya bahwa sebuah dokumen telah lolos validasi belum diimplementasikan.

#### Impor DOCX

Fitur impor DOCX awalnya dibuat untuk membantu pengguna lama memindahkan dokumen mereka dari Microsoft Word ke HighTex. Sementara itu, pengguna baru mungkin langsung mulai menggunakan HighTex sehingga tidak memiliki dokumen DOCX lama yang perlu diimpor.

Proses membaca dan mengonversi DOCX cukup kompleks serta membutuhkan upaya besar untuk memastikan hasilnya akurat. Oleh karena itu, kami memutuskan untuk tidak menyertakan fitur ini dalam versi desktop untuk saat ini.

#### Integrasi Data Institusi

Integrasi data institusi tidak tersedia di versi desktop karena arsitektur *hybrid*-nya mengutamakan kemampuan penggunaan offline. Integrasi data institusi, seperti nama dosen dan informasi akademik lainnya, akan menimbulkan ketergantungan pada layanan online.

Ini merupakan salah satu keterbatasan terbesar versi desktop. Integrasi data institusi adalah salah satu hal utama yang membedakan HighTex dari alat penulisan konvensional seperti LaTeX atau Microsoft Word. Tanpa kemampuan ini, pengguna desktop tidak dapat menikmati sepenuhnya salah satu keunggulan utama HighTex.

#### Versioning Dokumen

Versioning dokumen, termasuk pembuatan snapshot dan penggabungan versi, belum tersedia di versi desktop. Fitur ini dirancang agar pengguna dapat menyimpan kondisi dokumen sebelumnya dan menggabungkan perubahan dari beberapa versi.

#### Pengajuan Dokumen kepada Dosen Pembimbing

Pengajuan dokumen secara langsung kepada dosen pembimbing untuk proses bimbingan belum tersedia di versi desktop. Alur kerja ini bergantung pada layanan online dan integrasi dengan sistem bimbingan akademik.

#### Fitur Lain yang Bergantung pada Layanan Online

Fitur lain yang membutuhkan layanan online mungkin juga belum tersedia di versi desktop. Ketersediaannya bergantung pada apakah fitur tersebut dapat diimplementasikan tanpa mengorbankan kemampuan aplikasi untuk digunakan secara offline.

### Fitur yang Tersedia di HighTex Desktop

#### Berbagi Dokumen melalui Jaringan Lokal

HighTex Desktop memungkinkan pengguna berbagi dokumen melalui jaringan lokal untuk keperluan presentasi dan diskusi. Dengan demikian, pengguna dapat mempresentasikan dokumen kepada orang lain yang terhubung ke jaringan yang sama tanpa bergantung pada versi web.

#### Pengaturan Profil dan Dokumen secara Manual

Pengguna dapat mengatur profil dan konfigurasi dokumen secara manual tanpa bergantung pada data institusi yang tersedia secara online. Hal ini memberikan fleksibilitas lebih bagi pengguna yang ingin bekerja secara mandiri tanpa bergantung pada layanan online.

#### Penggunaan Offline

HighTex Desktop mendukung penyuntingan dokumen dan pengaturan lokal tanpa memerlukan koneksi internet secara terus-menerus. Hal ini menjadikannya pilihan yang sesuai bagi pengguna yang membutuhkan lingkungan penulisan yang lebih mandiri, termasuk ketika koneksi internet tidak tersedia.

#### Dokumen Tanpa Batas Jumlah

Pada beberapa versi web, pengguna hanya dapat memiliki satu dokumen karena keterbatasan sumber daya server. HighTex Desktop menghilangkan batasan tersebut sehingga pengguna dapat membuat dokumen sebanyak yang dibutuhkan.

#### Ekstensi Editor yang Lebih Lengkap

HighTex Desktop masih aktif dikembangkan, sementara pengembangan versi web telah dihentikan. Karena itu, berbagai ekstensi dan peningkatan editor terus ditambahkan ke versi desktop untuk memberikan pengalaman menulis yang lebih baik.

---

## Mengapa Electron?

Jawaban jujurnya adalah kepraktisan.

Terus terang, Electron bukan pilihan pertama saya jika waktu, sumber daya, dan kapasitas pemeliharaan tidak terbatas. Aplikasi yang dibangun menggunakan teknologi serupa sering dikritik karena mengonsumsi lebih banyak memori dan sumber daya sistem dibandingkan aplikasi desktop konvensional. Siapa pun yang pernah menggunakan Discord atau WhatsApp Desktop mungkin sudah merasakannya. Saya memahami kritik tersebut.

Namun, HighTex terutama dikembangkan oleh satu orang, dan setiap keputusan teknis harus mempertimbangkan keseimbangan antara solusi ideal dan apa yang realistis untuk diwujudkan.

### Fondasi yang sudah ada

HighTex sudah dikembangkan jauh sebelum versi desktop dibuat. Banyak pekerjaan telah dilakukan pada editor, sistem dokumen, dan antarmuka pengguna.

Membangun ulang semuanya secara terpisah untuk setiap sistem operasi berarti menghabiskan waktu bertahun-tahun untuk mengerjakan kembali sesuatu yang sebenarnya sudah tersedia.

### Konsistensi lintas platform

Mendukung beberapa sistem operasi bukanlah hal yang mudah. Implementasi yang terpisah menambah kompleksitas, meningkatkan kemungkinan munculnya bug, dan memperbesar risiko perbedaan perilaku fitur di setiap platform.

Satu basis kode bersama membantu menjaga konsistensi perilaku aplikasi sekaligus membuat pemeliharaan lebih mudah dikelola.

### Kecepatan pengembangan

Setiap jam yang dihabiskan untuk membangun ulang infrastruktur adalah satu jam yang tidak digunakan untuk meningkatkan pengalaman menulis. Prioritas saya adalah mengembangkan HighTex itu sendiri, bukan memelihara beberapa implementasi aplikasi yang sama untuk platform berbeda.

### Saya ingin menyelesaikan proyek ini

Seperti banyak proyek pribadi dan akademik lainnya, HighTex bisa saja terjebak dalam siklus penulisan ulang dan penyempurnaan arsitektur tanpa akhir. Pada titik tertentu, perangkat lunak harus bisa digunakan.

Electron mungkin bukan solusi yang paling elegan, tetapi teknologi inilah yang memungkinkan HighTex Desktop hadir dan digunakan sekarang, alih-alih terus menjadi proyek yang tidak kunjung selesai. Untuk proyek ini, merilis aplikasi yang bisa digunakan lebih penting daripada mengejar kesempurnaan.

---

## Status Saat Ini

HighTex Desktop masih dalam pengembangan aktif. Fitur, arsitektur, dan alur kerja dapat terus berubah seiring berkembangnya proyek.