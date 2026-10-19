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

## Belum diuji

Berkas Docker/Compose/Caddy di sini belum dijalankan dari lingkungan pengembangan ini, jadi periksa log (`docker compose ... logs -f app`) pada deploy pertama.
