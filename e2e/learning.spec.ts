import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN } from '../playwright.config';

const uniqueEmail = (): string => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Mendaftar akun baru lewat formulir; materi belajar hanya terbuka untuk pengguna yang masuk. */
async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto('/daftar');
  await page.locator('#reg-name').fill('Penguji E2E');
  await page.locator('#reg-email').fill(email);
  await page.locator('#reg-pw').fill('sandi-e2e-12345');
  await page.getByRole('button', { name: 'Daftar' }).click();
  await expect(page.getByRole('heading', { name: 'Kemajuan belajarmu' })).toBeVisible();
  return email;
}

async function solveTotalPengeluaran(page: Page): Promise<void> {
  await page.goto('/latihan/total-pengeluaran');
  await expect(page.getByRole('heading', { level: 1, name: 'Total pengeluaran bulanan' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Isi sel B7' }).fill('=SUM(B2:B6)');
  await expect(page.getByRole('gridcell', { name: /^B7: 1\.020\.000/ })).toBeVisible();
  await page.getByRole('button', { name: /Periksa jawaban/ }).click();
  await expect(page.getByTestId('feedback')).toContainText('Benar!');
}

test.describe('pengunjung tanpa akun', () => {
  test('hanya tes penempatan yang terbuka; materi lain mengarah ke halaman masuk', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Excel bisa dipelajari/ })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await expect(nav.getByRole('link', { name: 'Tes penempatan' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Belajar' })).toHaveCount(0);
    for (const path of ['/belajar', '/latihan/total-pengeluaran', '/shortcut', '/worksheet', '/kemajuan']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/masuk$/);
    }
    // API juga menolak, bukan hanya UI.
    expect((await page.request.get('/api/modules')).status()).toBe(401);
    expect((await page.request.get('/api/exercises/total-pengeluaran')).status()).toBe(401);
  });
});

test.describe('pelajaran contoh dan Premium', () => {
  test('pengunjung membaca pelajaran contoh dari beranda; pelajaran lain meminta masuk', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coba pelajaran contoh' })).toBeVisible();
    await page.getByRole('link', { name: /SUM: Menjumlahkan Angka/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'SUM: Menjumlahkan Angka' })).toBeVisible();
    await expect(page.getByText('Ini pelajaran contoh.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tandai pelajaran selesai' })).toHaveCount(0);
    await page.goto('/belajar/index-match');
    await expect(page.getByText('Pelajaran ini untuk anggota')).toBeVisible();
    expect((await page.request.get('/api/lessons/index-match')).status()).toBe(401);
    expect((await page.request.get('/api/lessons/fungsi-sum')).status()).toBe(200);
  });

  test('pengguna gratis melihat halaman Premium dengan emailnya; unduhan sertifikat dan kunci jawaban ditolak API', async ({ page }) => {
    const email = await signUp(page);
    await page.goto('/premium');
    await expect(page.getByRole('heading', { name: /Dukung Mahir Excel/ })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    expect((await page.request.get('/api/progress/certificate?scope=semua')).status()).toBe(402);
    expect((await page.request.get('/api/worksheets/anggaran-bulanan/download?answer=1')).status()).toBe(402);
    expect((await page.request.get('/api/worksheets/anggaran-bulanan/download')).status()).toBe(200);
  });
});

test.describe('pengguna masuk', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test('mulai belajar, kerjakan latihan, progres tersimpan di akun', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Excel bisa dipelajari/ })).toBeVisible();
    await page.getByRole('link', { name: 'Mulai belajar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Belajar Excel dari dasar' })).toBeVisible();
    await page
      .getByRole('link', { name: /SUM: Menjumlahkan Angka/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'SUM: Menjumlahkan Angka' })).toBeVisible();
    await page.getByRole('link', { name: 'Total pengeluaran bulanan' }).click();

    await page.getByRole('textbox', { name: 'Isi sel B7' }).fill('=SUM(B2:B5)');
    await page.getByRole('button', { name: /Periksa jawaban/ }).click();
    await expect(page.getByTestId('feedback')).toContainText('Belum tepat');
    await page.getByRole('textbox', { name: 'Isi sel B7' }).fill('=SUM(B2:B6)');
    await page.getByRole('button', { name: /Periksa jawaban/ }).click();
    await expect(page.getByTestId('feedback')).toContainText('+10 poin');

    await page.reload();
    await expect(page.getByRole('link', { name: /Kemajuan: 10 poin/ })).toBeVisible();
  });

  test('alat urutkan dan isi otomatis bekerja di playground', async ({ page }) => {
    await page.goto('/latihan/urutkan-penjualan');
    await page.getByLabel('Kolom', { exact: true }).selectOption({ label: 'Penjualan' });
    await page.getByRole('button', { name: /Turun/ }).click();
    await expect(page.getByRole('gridcell', { name: /^A2: Sari/ })).toBeVisible();
    await page.getByRole('button', { name: /Periksa jawaban/ }).click();
    await expect(page.getByTestId('feedback')).toContainText('Benar!');

    await page.goto('/latihan/salin-rumus-ke-bawah');
    await page.getByRole('gridcell', { name: /^C2, kosong/ }).click();
    await page.getByRole('textbox', { name: 'Isi sel C2' }).fill('=B2*$E$1');
    await page.getByRole('button', { name: /Isi ke bawah/ }).click();
    await expect(page.getByRole('gridcell', { name: /^C6: 1100/ })).toBeVisible();
    await page.getByRole('button', { name: /Periksa jawaban/ }).click();
    await expect(page.getByTestId('feedback')).toContainText('Benar!');
  });

  test('shortcut: pencarian dan kuis', async ({ page }) => {
    await page.goto('/shortcut');
    await page.getByLabel('Cari aksi atau tombol').fill('filter');
    await expect(page.getByText(/Menampilkan \d+ dari \d+ shortcut/)).toBeVisible();
    await expect(page.getByText('Aktifkan atau matikan filter')).toBeVisible();
    await page.getByRole('tab', { name: 'Mode kuis' }).click();
    await page.getByRole('radio').first().click();
    await expect(page.getByRole('button', { name: /Soal berikutnya|Lihat skor/ })).toBeVisible();
  });

  test('unduh worksheet .xlsx yang valid', async ({ page }) => {
    await page.goto('/worksheet/anggaran-bulanan');
    await expect(page.getByRole('heading', { level: 1, name: 'Anggaran Pribadi Bulanan' })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Unduh worksheet' }).click()]);
    expect(download.suggestedFilename()).toBe('anggaran-bulanan.xlsx');
    const file = await download.path();
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 2).toString()).toBe('PK'); // .xlsx adalah arsip zip
    expect(bytes.length).toBeGreaterThan(1000);

    // Kunci jawaban khusus Premium: pengguna gratis diarahkan ke halaman Premium, bukan mengunduh.
    await expect(page.getByRole('link', { name: /Kunci jawaban \(Premium\)/ })).toHaveAttribute('href', '/premium');
  });
});

test.describe('tes penempatan (tanpa akun)', () => {
  test('memberi saran modul dan skornya tersimpan di server', async ({ page }) => {
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/placement') && r.request().method() === 'POST');
    await page.goto('/tes-penempatan');
    await page.locator('#p1-1').check();
    await page.locator('#p2-1').check();
    await page.locator('#p3-0').check(); // salah: filter menghapus
    for (const id of ['p4-1', 'p5-1', 'p6-1', 'p7-1', 'p8-1', 'p9-2', 'p10-1', 'p11-0', 'p12-1']) await page.locator(`#${id}`).check();
    await page.getByRole('button', { name: 'Lihat hasil' }).click();
    await expect(page.getByText(/Saran: mulai dari modul/)).toBeVisible();
    expect((await saved).status()).toBe(201);
    await expect(page.getByText('Skormu sudah tersimpan.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Daftar gratis' }).first()).toBeVisible();
  });
});

test.describe('Sprint 60 detik (tanpa akun)', () => {
  test('main satu ronde sungguhan, simpan nama, dan tampil di papan peringkat beranda', async ({ page }) => {
    test.setTimeout(90_000);
    // Kunci jawaban tidak pernah dikirim ke browser, jadi tes membacanya langsung dari database tes.
    const db = await mysql.createConnection({
      host: '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? 'excellab',
      password: process.env.DB_PASSWORD ?? 'excellab_dev',
      database: 'excellab_test',
    });
    try {
      await page.goto('/sprint');
      await page.getByRole('button', { name: /Mulai/ }).click();
      await expect(page.locator('.xl-sp-option').first()).toBeVisible();
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(650); // jeda manusiawi minimum di server adalah 400 ms
        const [rows] = await db.query('SELECT answer_idx FROM sprint_sessions ORDER BY id DESC LIMIT 1');
        const key = (rows as { answer_idx: number }[])[0]!.answer_idx;
        await page.locator('.xl-sp-option').nth(key).click();
        await expect(page.getByText(/Benar, \+\d+/)).toBeVisible();
      }
      // Ronde pendek di lingkungan e2e (8 detik); tunggu waktu habis dan hasilnya muncul.
      await expect(page.getByTestId('skor-akhir')).toContainText('36', { timeout: 20_000 }); // 10 + 12 + 14
      await page.getByLabel('Nama untuk papan peringkat').fill('Penguji E2E');
      await page.getByRole('button', { name: 'Simpan skor' }).click();
      await expect(page.getByText(/Tersimpan sebagai/)).toBeVisible();
      await expect(page.locator('.xl-sp-board li.me')).toContainText('Penguji E2E');

      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Adu cepat/ })).toBeVisible();
      await expect(page.locator('.xl-l-sprint-board').getByText('Penguji E2E')).toBeVisible();
    } finally {
      await db.end();
    }
  });

  test('tanpa akun tidak bisa menjawab soal orang lain atau menyimpan skor tanpa ronde', async ({ page }) => {
    const bad = 'f'.repeat(48);
    expect((await page.request.post(`/api/sprint/${bad}/answer`, { data: { q: 0, choice: 0 } })).status()).toBe(404);
    expect((await page.request.post(`/api/sprint/${bad}/submit`, { data: { name: 'Curang' } })).status()).toBe(404);
    expect((await page.request.get('/api/sprint/leaderboard?period=all')).status()).toBe(200);
  });
});

test.describe('antarmuka', () => {
  test('bahasa Inggris untuk antarmuka', async ({ page }) => {
    await signUp(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ganti bahasa ke English' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Excel can be learned. Start here.' })).toBeVisible();
    await page.goto('/belajar');
    await expect(page.getByRole('note')).toContainText('Indonesian only');
  });

  test('tidak ada overflow horizontal pada lebar 360px', async ({ page }) => {
    test.setTimeout(120_000); // memeriksa belasan halaman, termasuk beranda panjang dan satu pendaftaran
    await page.setViewportSize({ width: 360, height: 740 });
    const check = async (paths: string[]): Promise<void> => {
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `overflow di ${path}`).toBeLessThanOrEqual(0);
      }
    };
    await check(['/', '/masuk', '/daftar', '/tes-penempatan']);
    await signUp(page);
    await check(['/', '/belajar', '/belajar/fungsi-if', '/latihan', '/latihan/total-pengeluaran', '/shortcut', '/worksheet', '/kemajuan']);
  });
});

test.describe('akun', () => {
  test('daftar, progres tersimpan di akun, keluar, masuk lagi', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/daftar');
    await page.locator('#reg-name').fill('Penguji E2E');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-pw').fill('sandi-e2e-12345');
    await page.getByRole('button', { name: 'Daftar' }).click();
    await expect(page.getByRole('heading', { name: 'Kemajuan belajarmu' })).toBeVisible();
    await expect(page.getByText(/tersimpan di akunmu/)).toBeVisible();

    await solveTotalPengeluaran(page);
    await page.goto('/kemajuan');
    await expect(page.getByText('Latihan selesai')).toBeVisible();
    await expect(page.getByRole('link', { name: /Kemajuan: 10 poin/ })).toBeVisible();

    await page.goto('/profil');
    await page.getByRole('button', { name: 'Keluar' }).click();
    await page.goto('/masuk');
    await page.locator('#login-email').fill(email);
    await page.locator('#login-pw').fill('sandi-e2e-12345');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kemajuan belajarmu' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Kemajuan: 10 poin/ })).toBeVisible();
  });

  test('login salah menampilkan galat yang jelas', async ({ page }) => {
    await page.goto('/masuk');
    await page.locator('#login-email').fill('tidak-ada@example.com');
    await page.locator('#login-pw').fill('salah-salah-1');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Email atau kata sandi salah');
  });
});

test.describe('admin', () => {
  test('admin melihat ringkasan, pengguna, dan konten; pengguna biasa tidak', async ({ page, browser }) => {
    await page.goto('/masuk');
    await page.locator('#login-email').fill(E2E_ADMIN.email);
    await page.locator('#login-pw').fill(E2E_ADMIN.password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kemajuan belajarmu' })).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Ringkasan' })).toBeVisible();
    await expect(page.getByText('Pengguna terdaftar').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Unduh statistik/ })).toHaveAttribute('href', '/api/admin/stats/usage.csv');

    await page.goto('/admin/pengguna');
    await expect(page.getByRole('table', { name: 'Daftar pengguna terdaftar' })).toBeVisible();
    await expect(page.getByText(E2E_ADMIN.email)).toBeVisible();

    await page.goto('/admin/exercises');
    await expect(page.getByRole('table', { name: 'Daftar latihan' })).toBeVisible();

    const csv = await page.request.get('/api/admin/users.csv');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');

    const guest = await browser.newContext();
    const gp = await guest.newPage();
    await gp.goto('http://localhost:5190/admin');
    await expect(gp).toHaveURL(/\/masuk$/);
    expect((await guest.request.get('http://localhost:5190/api/admin/users')).status()).toBe(401);
    await guest.close();
  });
});
