import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_LESSON_SLUGS, exercises, lessons, worksheets } from '@excellab/shared';
import { applySeo, seoFor } from './lib/seo';

const ORIGIN = 'https://mahirexcel.online';
const html = fs.readFileSync(path.resolve(__dirname, '../../web/index.html'), 'utf8');
const render = (p: string): string => applySeo(html, seoFor(p), ORIGIN);
const canonical = (h: string): string => /<link rel="canonical" href="([^"]*)"/.exec(h)![1]!;
const title = (h: string): string => /<title>([^<]*)<\/title>/.exec(h)![1]!;
const desc = (h: string): string => /<meta\s+name="description"\s+content="([^"]*)"/.exec(h)![1]!;

describe('SEO per halaman di sisi server', () => {
  it('beranda: judul bawaan, canonical ke akar, dan data terstruktur', () => {
    const s = seoFor('/');
    expect(s).toMatchObject({ status: 200, index: true });
    const h = render('/');
    expect(canonical(h)).toBe(`${ORIGIN}/`);
    expect(title(h)).toBe(title(html));
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]!));
    expect(ld.map((x) => x['@type']).sort()).toEqual(['Course', 'WebSite']);
    expect(h).not.toContain('noindex');
  });

  it('halaman publik punya judul, deskripsi, dan canonical sendiri', () => {
    for (const p of ['/template', '/premium', '/tes-penempatan', '/sprint', '/tentang', '/program', '/privasi', '/syarat']) {
      const h = render(p);
      expect(seoFor(p).status, p).toBe(200);
      expect(canonical(h), p).toBe(`${ORIGIN}${p}`);
      expect(title(h), p).toMatch(/ \| Mahir Excel$/);
      expect(title(h), p).not.toBe(title(html));
      expect(desc(h), p).not.toBe(desc(html));
      expect(desc(h).length, p).toBeLessThanOrEqual(170);
      expect(h, p).toContain(`<meta property="og:url" content="${ORIGIN}${p}" />`);
      expect(h, p).not.toContain('noindex');
    }
  });

  it('pelajaran contoh diindeks dengan judul dan ringkasannya; pelajaran lain noindex', () => {
    for (const slug of PUBLIC_LESSON_SLUGS) {
      const l = lessons.find((x) => x.slug === slug)!;
      const h = render(`/belajar/${slug}`);
      expect(title(h)).toBe(`${l.title} | Mahir Excel`.replace(/&/g, '&amp;'));
      expect(canonical(h)).toBe(`${ORIGIN}/belajar/${slug}`);
      expect(h).not.toContain('noindex');
    }
    const other = lessons.find((l) => !PUBLIC_LESSON_SLUGS.includes(l.slug))!;
    expect(seoFor(`/belajar/${other.slug}`)).toMatchObject({ status: 200, index: false });
    expect(render(`/belajar/${other.slug}`)).toContain('<meta name="robots" content="noindex" />');
  });

  it('halaman pribadi yang ada: 200 tetapi noindex', () => {
    const ex = exercises[0]!.slug;
    const ws = worksheets[0]!.slug;
    for (const p of ['/belajar', '/latihan', `/latihan/${ex}`, '/worksheet', `/worksheet/${ws}`, '/kemajuan', '/laporan', '/wizard', '/profil', '/masuk', '/daftar', '/admin', '/admin/pengguna', '/bagikan/abc', '/sertifikat/ABC']) {
      expect(seoFor(p), p).toMatchObject({ status: 200, index: false });
      expect(render(p), p).toContain('noindex');
    }
  });

  it('alamat yang tidak dikenal menjawab 404 dan noindex', () => {
    for (const p of ['/nonexistent-xyz', '/ads.txt', '/belajar/tidak-ada', '/latihan/tidak-ada', '/worksheet/tidak-ada', '/index.html', '/a/b/c']) {
      expect(seoFor(p).status, p).toBe(404);
      const h = render(p);
      expect(h, p).toContain('noindex');
      expect(title(h), p).toContain('tidak ditemukan');
    }
  });

  it('garis miring di akhir diabaikan dan karakter khusus di judul di-escape', () => {
    expect(seoFor('/template/').status).toBe(200);
    expect(canonical(render('/template/'))).toBe(`${ORIGIN}/template`);
    const withAmp = applySeo(html, { status: 200, title: 'A "b" <c> & d', description: 'x "y"', path: '/x', index: true, jsonLd: [] }, ORIGIN);
    expect(withAmp).toContain('<title>A &quot;b&quot; &lt;c> &amp; d</title>');
    expect(withAmp).not.toContain('<c>');
  });

  it('semua alamat di sitemap menjawab 200 dan bisa diindeks', () => {
    const xml = fs.readFileSync(path.resolve(__dirname, '../../web/public/sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.slice(ORIGIN.length) || '/');
    for (const p of locs) expect(seoFor(p), p).toMatchObject({ status: 200, index: true });
  });
});
