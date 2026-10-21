# Deploy Mahir Excel ke VPS

Cara ini memakai Docker Compose: aplikasi (API + web), MySQL, dan Caddy yang mengurus HTTPS otomatis. Cocok untuk satu VPS Linux kecil (1 vCPU, 1-2 GB RAM).

## Biaya (jujur)

Perangkat lunaknya gratis, tetapi VPS **umumnya berbayar** (kisaran puluhan ribu rupiah per bulan untuk spesifikasi kecil) dan domain dibayar per tahun. Ada penyedia dengan paket gratis terbatas (mis. tingkat gratis beberapa cloud), tetapi syarat, kuota, dan ketersediaannya berubah-ubah, jadi periksa sendiri sebelum bergantung padanya. Tanpa domain, HTTPS otomatis tidak bisa dipakai; login memerlukan HTTPS di produksi.

## Persiapan

1. Sewa VPS Linux (Ubuntu 22.04/24.04), arahkan domain (record A) ke IP VPS.
2. Buka port 80 dan 443 di firewall.
3. Pasang Docker: <https://docs.docker.com/engine/install/ubuntu/>
4. Salin proyek ke VPS (git clone atau `scp`).

## Konfigurasi

```bash
cp .env.production.example .env.production
nano .env.production   # isi DOMAIN, WEB_ORIGIN, JWT_SECRET, DB_*_PASSWORD, ADMIN_*
```

`docker compose` membaca `${DOMAIN}`, `${DB_PASSWORD}`, dan `${DB_ROOT_PASSWORD}` dari berkas `.env`; agar sama dengan `.env.production`, jalankan perintah dengan `--env-file .env.production` seperti di bawah.

## Menjalankan

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# seed sekali saja: mengisi konten, membuat file worksheet, dan membuat akun admin
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm app node apps/api/dist/db/seed.js
```

Buka `https://DOMAIN-kamu`. Migrasi database berjalan otomatis setiap aplikasi start.

> Seed menimpa konten bawaan yang pernah kamu edit lewat /admin. Jalankan lagi hanya bila memang ingin memperbarui konten bawaan setelah update versi.

## Update versi

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Backup

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec mysql \
  sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" excellab' > backup-$(date +%F).sql
```

Simpan salinan di luar VPS. Volume `mysql-data` berisi seluruh data pengguna.

## Pemeriksaan setelah deploy

- `https://DOMAIN/api/health` mengembalikan `status: ok`.
- Daftar akun baru lalu masuk; beranda tanpa login hanya menampilkan tes penempatan.
- Masuk sebagai admin dan buka `/admin`.
- Email: tanpa SMTP, login kode dan lupa kata sandi otomatis nonaktif. Isi `SMTP_*` bila ingin mengaktifkannya.

## Pembayaran Premium lewat QRIS (Xendit)

Tanpa langkah ini, Premium tetap bisa diaktifkan manual oleh admin di /admin/pengguna.

1. Buat akun Xendit dan aktifkan metode **QR Codes (QRIS)**. Untuk uji coba, pakai mode Test dan kunci berawalan `xnd_development_`.
2. Di dashboard Xendit buat **API key** dengan izin *Money-in Write*, dan salin **Callback verification token** (Settings > Callbacks).
3. Isi di `.env.production`: `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, serta `PREMIUM_PRICE_IDR` dan `PREMIUM_MONTHS` (samakan dengan `PREMIUM_PRICE_LABEL`). Lalu `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`.
4. Alamat callback dikirim otomatis per kode QR: `https://DOMAIN-kamu/api/payments/xendit/callback`. Pastikan domain bisa dijangkau dari internet lewat HTTPS.
5. Uji di mode Test: buka /premium sambil login, klik bayar, lalu simulasikan pembayaran dengan `POST https://api.xendit.co/qr_codes/:external_id/payments/simulate` (external_id = kode pesanan di tabel `premium_orders.reference`). Premium aktif otomatis dan halaman /premium berubah sendiri.
6. Sebelum menerima uang sungguhan, ganti ke kunci live dan lakukan satu pembayaran kecil dari rekening sendiri.

Integrasi memakai API QR Codes v1 Xendit (`POST /qr_codes`, callback `qr.payment`). Callback ditolak bila `x-callback-token` tidak cocok; jumlah pembayaran harus sama dengan pesanan. Pembayaran yang telat (setelah kode QR kedaluwarsa di tampilan) tetap diaktifkan.

## Program Perintis (sertifikat gratis)

Halaman `/program` memberi sertifikat gratis kepada `PROGRAM_QUOTA` pengguna pertama (bawaan 100) yang menyelesaikan tes penempatan, satu ronde Sprint, dan `PROGRAM_MIN_EXERCISES` latihan (bawaan 5), semuanya saat masuk akun. Nomor Perintis diberikan berurutan saat klaim ditekan, dan basis data menjamin kuota tidak terlampaui. Matikan dengan `PROGRAM_ENABLED=false`; yang sudah klaim tetap punya sertifikatnya. Melihat siapa saja yang sudah klaim:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" excellab -e "SELECT pc.slot, u.email, u.display_name, pc.claimed_at FROM program_claims pc JOIN users u ON u.id = pc.user_id ORDER BY pc.slot"'
```

## Belum diuji

Berkas Docker/Compose/Caddy di sini belum dijalankan dari lingkungan pengembangan ini, jadi periksa log (`docker compose ... logs -f app`) pada deploy pertama.
