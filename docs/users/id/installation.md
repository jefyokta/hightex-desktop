# Download Page

Untuk mengunduh HighTex, kunjungi:



[Download HighTex](https://hightex.jefyokta.dev/download)

# macOS
## Opsi paling mudah + hightex-cli

```bash
curl -fsSL https://hightex.jefyokta.dev/macos/install.sh | bash

```
## Manual

Jika kamu mengunduh file `.dmg` secara langsung dan menginstalnya, macOS mungkin akan memblokir HighTex saat pertama kali dibuka dan menampilkan pesan yang meminta aplikasi untuk dihapus. Pada kondisi ini, biasanya tidak tersedia opsi **Open Anyway** pada dialog tersebut.

**Jangan hapus `HighTex.app`.**

Untuk mengizinkan aplikasi:

1. Coba buka **HighTex** terlebih dahulu hingga macOS menampilkan peringatan keamanan.
2. Buka **System Settings**.
3. Pilih **Privacy & Security**.
4. Scroll ke bagian **Security**.
5. Di sana akan muncul catatan bahwa **HighTex telah diblokir karena berasal dari developer yang tidak dapat diverifikasi**.
6. Tekan **Open Anyway**.
7. Konfirmasi untuk membuka HighTex.

## Advanced

Jika cara di atas tidak berhasil, kamu dapat menghapus quarantine attribute dari HighTex menggunakan Terminal.

Jalankan:

```bash
xattr -cr /Applications/HighTex.app
```

Jika HighTex tidak berada di folder `/Applications/`, sesuaikan path dengan lokasi aplikasi, kemudian jalankan kembali perintah tersebut.

## Install via Homebrew

Cara yang lebih sederhana adalah menginstal HighTex menggunakan Homebrew:

```bash
brew tap jefyokta/hightex
brew trust jefyokta/hightex
brew install --cask jefyokta/hightex/hightex
```
