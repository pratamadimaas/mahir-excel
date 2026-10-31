# Mahir Excel

**Belajar Excel. Langsung Praktik. Gratis.**

Mahir Excel adalah platform belajar Microsoft Excel berbahasa Indonesia yang gratis. Pengguna belajar lewat pelajaran singkat, mengerjakan latihan di playground spreadsheet sederhana, menguji shortcut, dan mengunduh worksheet `.xlsx`.

**Akses:** lima pelajaran contoh (tanpa latihan) terbuka untuk siapa saja sebagai etalase. Selain itu seluruh materi (pelajaran, latihan, shortcut, worksheet, tantangan, progres) hanya untuk pengguna yang **sudah masuk**; daftar gratis dengan email. Pengunjung tanpa akun hanya dapat membuka beranda, halaman info, dan **tes penempatan**. Skor tes penempatan disimpan di server (tanpa nama, IP, atau data perangkat bila tanpa akun) dan terlihat di dasbor admin.

> Mahir Excel tidak berafiliasi dengan Microsoft. Playground adalah simulasi terbatas, **bukan** pengganti Excel.

## Fitur

- **Akademi**: 8 modul, 30 pelajaran lengkap (tujuan, penjelasan, sintaks, contoh, kesalahan umum, kuis, latihan), termasuk proyek akhir di tiap modul.
- **Playground spreadsheet**: grid dengan name box, formula bar, navigasi keyboard, sorotan sel yang dirujuk, petunjuk bertahap, umpan balik rinci, reset, solusi, **isi otomatis** (fill handle, Ctrl+D/Ctrl+R, tombol) serta alat **urutkan dan filter** pada latihan tertentu.
- **Mesin rumus sendiri** (`packages/spreadsheet-engine`): parser + evaluator tanpa `eval()`, **33 fungsi** (termasuk VLOOKUP, XLOOKUP, INDEX/MATCH, teks, tanggal, ROUND), dengan batas sumber daya dan deteksi referensi melingkar.
- **54 latihan** dengan validasi rumus yang menguji hasil pada varian data (jawaban yang kebetulan cocok tidak lolos).
- **Ulang terjadwal** (interval 1/3/7/14/30 hari), **tes penempatan**, **bagikan progres** lewat tautan publik, dan **sertifikat PDF** penyelesaian modul (bukan sertifikasi resmi Microsoft; dapat diverifikasi lewat kode).
- **Beranda pengunjung yang panjang** (`apps/web/src/features/home/Landing.tsx`): lab kesalahan interaktif (4 kasus nyata yang bisa diperbaiki), latihan mencoba rumus tanpa akun, kurikulum dengan angka asli dari `/api/public/overview`, contoh umpan balik, daftar alat, batasan, perbandingan Gratis dan Premium, dan FAQ. Semua contoh dijalankan oleh mesin rumus dan dicek tes (`landing.test.tsx`), jadi klaimnya tidak bisa basi diam-diam.
- **Sprint 60 detik** (`/sprint`, tanpa akun): adu cepat menjawab soal Excel yang dibuat server tanpa batas (hasil rumus, nama galat, shortcut Windows), kunci jawaban dihitung oleh mesin rumus sungguhan. Skor +10 dengan bonus rentetan, salah -5. Papan peringkat publik (hari ini, 7 hari, sepanjang masa) dengan satu baris per nama dan moderasi admin (`/admin/sprint`). Anti-curang dasar: soal dan waktu dikendalikan server, jeda minimum 400 ms per jawaban, satu jawaban per soal, batas laju. Lama ronde diatur `SPRINT_SECONDS`.
- **Login dengan Google** (opsional, perlu `GOOGLE_CLIENT_ID`): akun dibuat otomatis, email Google harus terverifikasi, admin tetap wajib kata sandi. Token diverifikasi di server (tanda tangan RS256, audience, issuer, masa berlaku).
- **Premium** (QRIS lewat Xendit, atau aktivasi manual oleh admin): solusi langsung di latihan, pemeriksaan berkas yang diunggah, kunci jawaban worksheet, template lanjutan, dan sertifikat PDF. Sisanya gratis. Atur `PREMIUM_PRICE_LABEL`, `PREMIUM_PRICE_IDR`, `PREMIUM_MONTHS`, `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, dan `PREMIUM_CONTACT_URL`. Lihat docs/DEPLOY.md.
- **Bagikan hasil tes penempatan** ke WhatsApp atau salin teks (hanya skor dan level, tanpa nama).
- **Dua bahasa**: antarmuka Indonesia dan English (cangkang, beranda, dan masuk/daftar); isi pelajaran hanya Bahasa Indonesia.
- **53 shortcut** (Windows/Mac) dengan pencarian, filter, favorit lokal, dan mode kuis.
- **10 worksheet `.xlsx`** (dibuat dengan ExcelJS) beserta file kunci jawaban terpisah.
- **Progres**: poin, streak, tantangan harian, tinjau jawaban salah, tersimpan di MySQL per akun (progres lama di localStorage dapat diimpor).
- **Login**: email + kata sandi, atau **kode 6 angka lewat email** (tanpa kata sandi; akun dibuat otomatis), plus **lupa kata sandi** lewat email.
- **Admin**: kelola modul, pelajaran, latihan, shortcut, metadata worksheet (terbit/sembunyikan, pratinjau); dasbor kunjungan 14 hari (pengunjung unik harian, halaman dibuka, pendaftar baru, percobaan latihan, halaman populer) dan hasil tes penempatan (jumlah, rata-rata skor, sebaran modul awal, hasil terbaru); daftar pengguna terdaftar dengan pencarian; ekspor CSV pengguna dan statistik; daftar latihan yang paling sering gagal.
- **Hero 3D opsional** (Three.js lewat `@react-three/fiber`): dimuat malas, ada fallback CSS tanpa WebGL, menghormati `prefers-reduced-motion`.

## Teknologi

| Bagian    | Teknologi                                                              |
| --------- | ---------------------------------------------------------------------- |
| Frontend  | React 19, TypeScript (strict), Vite, Bootstrap 5, React Router, Lucide |
| 3D        | three, @react-three/fiber (hanya untuk hero beranda)                   |
| Backend   | Node.js, Express 5, TypeScript, Zod, mysql2 (query berparameter)       |
| Database  | MySQL 8 (migrasi SQL + seed)                                           |
| Worksheet | ExcelJS                                                                |
| Tes       | Vitest, Supertest, Testing Library, Playwright (e2e)                   |
| Lainnya   | pdfkit (sertifikat), nodemailer (email), GitHub Actions (CI)           |
| Tooling   | ESLint 10, Prettier, tsup                                              |

Struktur monorepo (npm workspaces):

```
apps/web                 aplikasi React (Vite)
apps/api                 REST API Express + generator worksheet
packages/spreadsheet-engine   parser dan evaluator rumus (tanpa dependensi)
packages/shared          tipe, konten kurikulum, validasi jawaban, util progres
database/migrations      skema MySQL
docs/                    dokumentasi API, mesin rumus, catatan konten
```

## Prasyarat

- Node.js **20.19+** (diuji di 22.14) dan npm.
- MySQL 8. Cara termudah: **Docker** (disediakan `docker-compose.yml`). MySQL lain juga boleh, sesuaikan `.env`.

## Instalasi

```bash
npm install
cp .env.example .env     # lalu isi JWT_SECRET (minimal 32 karakter acak)
```

Buat rahasia acak untuk `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Database

```bash
npm run db:up        # menjalankan MySQL 8.4 di port 3307 (membuat database excellab dan excellab_test)
npm run db:migrate   # menjalankan database/migrations/*.sql
npm run db:seed      # mengisi konten + membuat 20 file .xlsx + admin (bila ADMIN_EMAIL/ADMIN_PASSWORD diisi)
```

- `npm run db:reset` menghapus semua tabel lalu migrasi + seed ulang (tidak berjalan di `NODE_ENV=production`).
- Seed bersifat idempoten berdasarkan `slug`, tetapi **menimpa edit manual** pada konten bawaan. Konten buatan admin dengan slug baru tidak terpengaruh.
- Akun admin dibuat **hanya** bila `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (minimal 8 karakter; pakai yang panjang dan unik) diisi di `.env`. Bila kata sandi memuat `#`, beri tanda kutip: `ADMIN_PASSWORD="abc#123"` (di `.env`, `#` memulai komentar). Akun admin tidak dapat login lewat kode email; admin wajib memakai kata sandi. Tidak ada kata sandi admin yang di-hardcode. Di produksi, isi sekali lalu hapus dari lingkungan.
- Skrip init Docker (`database/init`) hanya berjalan saat volume baru dibuat. Jika volume sudah ada tanpa database tes, buat manual: `CREATE DATABASE excellab_test; GRANT ALL ON excellab_test.* TO 'excellab'@'%';`.
- Tanpa Docker: buat database `excellab` (dan `excellab_test` untuk tes) dan pengguna di MySQL 8 Anda, lalu sesuaikan `DB_*` di `.env`.

## Menjalankan

```bash
npm run dev     # API di http://localhost:4000 dan web di http://localhost:5173
```

Vite mem-proxy `/api` ke API, jadi cookie sesi bersifat _same-origin_ saat pengembangan.

## Perintah

| Perintah                      | Fungsi                                   |
| ----------------------------- | ---------------------------------------- |
| `npm run dev`                 | API + web (mode pengembangan)            |
| `npm run build`               | build produksi API (tsup) dan web (Vite) |
| `npm run typecheck`           | cek tipe semua paket                     |
| `npm run lint`                | ESLint                                   |
| `npm run format`              | Prettier                                 |
| `npm test`                    | semua tes (butuh MySQL untuk tes API)    |
| `npm run test:e2e`            | tes end-to-end Playwright (butuh MySQL)  |
| `npm run worksheets:generate` | membuat ulang file worksheet `.xlsx`     |

Tes API memakai database terpisah `excellab_test` yang di-reset otomatis pada awal setiap berkas tes. Jalankan `npm run db:up` terlebih dahulu.

Tes e2e (`npm run test:e2e`) menjalankan API di port 4100 dan web di port 5190 dengan database tes, lalu mengunduh browser Chromium Playwright bila belum ada (`npx playwright install chromium`). Workflow CI ada di `.github/workflows/ci.yml` (lint, typecheck, tes, build, e2e); belum pernah dijalankan di GitHub Actions dari lingkungan ini.

## Build dan deploy produksi

```bash
npm run build
NODE_ENV=production COOKIE_SECURE=true node apps/api/dist/server.js
```

Model sederhana yang disarankan:

1. **Frontend**: layani `apps/web/dist` sebagai situs statis (hosting statis apa pun) dengan fallback SPA ke `index.html`. Atau biarkan API melayaninya: set `SERVE_WEB=true`.
2. **API**: jalankan `apps/api/dist/server.js` di Node.js, di belakang reverse proxy HTTPS. Set `WEB_ORIGIN` ke origin frontend.
3. **MySQL**: MySQL 8 terkelola atau instans yang diamankan (jaringan privat, kata sandi kuat, backup).
4. **Same-site**: frontend dan API sebaiknya berada pada situs yang sama (mis. `app.contoh.id` dan `api.contoh.id`, atau satu domain dengan proxy `/api`). Cookie sesi memakai `SameSite=Lax`; jika dipisah lintas situs, sesi tidak akan terkirim. Jika API berada di origin berbeda, set `VITE_API_URL` saat build web.
5. **Wajib di produksi**: `NODE_ENV=production`, `COOKIE_SECURE=true` (API menolak start tanpa ini), `JWT_SECRET` unik, HTTPS.
6. **Worksheet**: file `.xlsx` ada di `apps/api/storage/worksheets` (atau `WORKSHEET_DIR`). Jalankan `npm run db:seed` (atau `worksheets:generate`) di server, dan pastikan folder itu persisten.

Perangkat lunaknya gratis, tetapi **infrastruktur (hosting, database terkelola, domain) bisa berbayar** dan tidak ada jaminan gratis selamanya. Pilih sesuai anggaran.

## Variabel lingkungan

Lihat `.env.example`. Ringkas: `GOOGLE_CLIENT_ID`, `PREMIUM_PRICE_LABEL`, `PREMIUM_PRICE_IDR`, `PREMIUM_MONTHS`, `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`, `PREMIUM_CONTACT_URL`, `PROGRAM_ENABLED`, `PROGRAM_QUOTA`, `PROGRAM_MIN_EXERCISES`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (email), `API_PORT`, `WEB_ORIGIN` (boleh dipisah koma), `DB_*`, `JWT_SECRET`, `COOKIE_SECURE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `WORKSHEET_DIR`, `SERVE_WEB`, `VITE_CONTACT_URL` (tautan kontak di footer; disembunyikan bila kosong), `VITE_API_URL` (opsional).

## Email (login kode dan lupa kata sandi)

- **Pengembangan** (tanpa `SMTP_HOST`): email tidak dikirim sungguhan; kode 6 angka **dicetak di terminal API** (`[email:dev] ... Kode: 123456`).
- **Produksi**: isi `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`) dengan penyedia SMTP milikmu (layanan SMTP bisa berbayar atau punya kuota gratis terbatas). Tanpa SMTP di produksi, login kode dan lupa kata sandi dimatikan otomatis dan UI menyembunyikannya.
- Kode berlaku 10 menit, sekali pakai, maksimal 5 percobaan, jeda 60 detik per email, disimpan sebagai HMAC. Respons permintaan selalu sama sehingga tidak membocorkan apakah email terdaftar.

## Statistik kunjungan dan privasi

Dasbor admin memakai hitungan agregat tanpa cookie pelacak: per halaman per hari dan pengunjung unik per hari dari hash (garam harian acak + IP + User-Agent) yang dihapus setelah 2 hari. Satu-satunya data yang disimpan dari pengunjung tanpa akun adalah jawaban dan skor tes penempatan (tanpa identitas). Sinyal Do Not Track / Global Privacy Control dihormati. IP tidak disimpan. Halaman Privasi menjelaskan ini kepada pengguna; ubah teksnya bila kamu mengubah apa yang dicatat.

## Progres dan akun

Semua progres baru tersimpan di MySQL per akun: poin dihitung server dan hanya diberikan sekali per latihan (kunci utama), serta tersinkron antar perangkat. Progres lama di `localStorage` (dari sebelum login diwajibkan) dapat diimpor lewat `POST /api/progress/sync`.

Saat sinkronisasi, server memvalidasi slug, menghitung poin dari definisi latihan (nilai poin dari klien diabaikan), dan idempoten. Catatan: server **mempercayai klaim "latihan selesai"** dari progres lokal (tidak menjalankan ulang jawaban). Ini sengaja untuk MVP karena tidak ada papan peringkat; perlu dipertimbangkan ulang bila fitur kompetitif ditambahkan.

## Cara menambah konten

Konten bawaan ada di `packages/shared/src/content` dan diisi ke database oleh `npm run db:seed`. Konten juga dapat dikelola lewat **/admin** (formulir dengan kolom JSON untuk struktur kompleks).

- **Pelajaran**: tambahkan objek ke `lessons-1.ts`/`lessons-2.ts` (atau pakai /admin → Pelajaran). Modul harus sudah ada (`modules.ts`).
- **Latihan**: tambahkan spesifikasi di `exercises.ts` (dataset `cells`, sel yang boleh diubah `editable`, `validation.targets` dengan jawaban acuan, `variants` untuk menguji rumus pada data lain, petunjuk, penjelasan). Tes `content.test.ts` otomatis memastikan jawaban acuan lolos, jawaban kosong ditolak, dan angka yang diketik langsung ditolak. Petunjuk **terakhir** tidak dikirim ke browser (hanya terbuka lewat "Lihat solusi"), jadi letakkan bocoran jawaban di sana.
- **Shortcut**: tambahkan di `shortcuts.ts`. Isi `verification` dengan jujur.
- **Worksheet**: tambahkan metadata di `worksheets.ts` dan rencana isi sheet di `apps/api/src/worksheets/builders.ts` (kunci = slug), lalu `npm run worksheets:generate && npm run db:seed`. Menambah lewat /admin hanya mengubah metadata dan nama file; file harus ada di folder worksheet.
- **Fungsi rumus baru**: lihat `docs/FORMULA-ENGINE.md`.

## Batasan yang diketahui

- Playground hanya mendukung 33 fungsi dan tidak identik dengan Excel; lihat `docs/FORMULA-ENGINE.md`.
- Tidak ada format sel, PivotTable, grafik, atau array dinamis di playground. Pelajaran terkait menjelaskan langkah di Excel asli. Tarik fill handle dengan pointer baru diuji manual terbatas; tes otomatis hanya mencakup tombol dan keyboard.
- Antarmuka English hanya mencakup cangkang, beranda, dan masuk/daftar; isi pelajaran dan latihan hanya Bahasa Indonesia.
- Sertifikat PDF belum ditinjau secara visual di berbagai pembaca PDF.
- Daftar shortcut belum diverifikasi satu per satu di setiap versi/OS/tata letak keyboard (lihat `docs/CONTENT-NOTES.md`).
- Login kode dan lupa kata sandi butuh SMTP di produksi (tidak ada pengirim email bawaan). Pengiriman email sungguhan lewat SMTP belum diuji dari lingkungan ini (hanya mode konsol dan memori).
- Pengunjung unik 7 hari adalah penjumlahan pengunjung harian (bukan unik 7 hari), dan pengunjung dengan Do Not Track tidak terhitung, sehingga angka cenderung lebih rendah dari kenyataan.
- Favorit shortcut hanya lokal (tidak disinkronkan ke akun).
- Sprint tidak bisa sepenuhnya kebal curang: soal ditampilkan sebagai data, jadi bot yang menghitung jawabannya sendiri tetap mungkin. Yang ada hanyalah pembatas (jeda minimum, batas laju, pembersihan nama) dan moderasi manual; papan peringkat ini tidak resmi.
- Premium belum memakai payment gateway: pembayaran dilakukan di luar aplikasi dan admin mengaktifkannya di /admin/pengguna. Harga contoh di `.env.example` hanyalah placeholder; tetapkan sendiri.
- Login Google belum diuji dengan Client ID dan Google sungguhan dari lingkungan ini (hanya dengan token palsu dan pengujian verifikasi tanda tangan); coba sekali di lingkunganmu setelah mengisi `GOOGLE_CLIENT_ID`.
- Karena materi dikunci di balik login, mesin pencari tidak dapat mengindeks isi pelajaran; hanya beranda dan halaman info yang publik.
- Statistik admin hanya mencakup pengguna terdaftar; tidak ada pelacakan analitik pihak ketiga.
- Bundel Three.js (~275 KB gzip) hanya diunduh di layar lebar pada perangkat yang memenuhi syarat; tidak memengaruhi halaman lain.
- Pengujian visual/aksesibilitas dilakukan manual pada lebar 360, 768, dan 1366 piksel; belum ada audit WCAG otomatis atau uji layar baca.

## Keamanan singkat

Query berparameter, validasi Zod pada semua input, cookie sesi HttpOnly + SameSite=Lax (Secure di produksi), CSRF double-submit untuk permintaan yang mengubah data, bcrypt untuk kata sandi, pembatasan laju (login, registrasi, API umum), helmet, CORS terbatas ke `WEB_ORIGIN`, otorisasi admin di backend, nama file unduhan divalidasi dan dibatasi ke folder worksheet, mesin rumus tanpa `eval()`/`Function()` dengan batas panjang, kedalaman, rentang, dan langkah. Rincian API di `docs/API.md`.
