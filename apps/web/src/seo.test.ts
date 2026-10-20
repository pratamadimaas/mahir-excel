import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_LESSON_SLUGS } from '@excellab/shared';

const at = (rel: string): string => path.resolve(__dirname, rel);
const read = (rel: string): string => fs.readFileSync(at(rel), 'utf8');
const ORIGIN = 'https://mahirexcel.online';

describe('SEO dan pratinjau tautan', () => {
  const html = read('../index.html');

  it('deskripsi ringkas dan tidak menjanjikan "tanpa akun" untuk semua materi', () => {
    const desc = /<meta\s+name="description"\s+content="([^"]*)"/s.exec(html)![1]!;
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.toLowerCase()).not.toContain('tanpa perlu akun');
    expect(desc).toContain('Daftar gratis');
  });

  it('tag Open Graph dan Twitter lengkap dengan gambar bertautan mutlak yang filenya ada dan ringan', () => {
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      expect(html, p).toContain(`property="${p}"`);
    }
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    const img = /property="og:image" content="([^"]+)"/.exec(html)![1]!;
    expect(img.startsWith(`${ORIGIN}/`)).toBe(true);
    const file = at(`../public/${img.slice(ORIGIN.length + 1)}`);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeLessThan(300_000);
  });

  it('robots.txt melarang area pribadi dan menunjuk ke sitemap', () => {
    const robots = read('../public/robots.txt');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('sitemap memuat semua pelajaran contoh publik dan tidak memuat halaman yang butuh login', () => {
    const xml = read('../public/sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    for (const slug of PUBLIC_LESSON_SLUGS) expect(locs, slug).toContain(`${ORIGIN}/belajar/${slug}`);
    for (const l of locs) expect(l.startsWith(`${ORIGIN}/`)).toBe(true);
    for (const gated of ['/admin', '/profil', '/kemajuan', '/masuk', '/daftar', '/latihan', '/worksheet', '/shortcut']) {
      expect(locs.some((l) => l.includes(gated)), gated).toBe(false);
    }
    expect(new Set(locs).size).toBe(locs.length);
  });
});
