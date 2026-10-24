import { PUBLIC_LESSON_SLUGS, exercises, lessons, pathBySlug, worksheets } from '@excellab/shared';

/**
 * SEO di sisi server untuk aplikasi satu halaman: judul, deskripsi, canonical, noindex, dan kode status 404 dihitung
 * dari alamatnya, lalu disuntikkan ke index.html sebelum dikirim. Mesin pencari tidak perlu menunggu JavaScript.
 */

export interface PageSeo {
  status: 200 | 404;
  /** Judul lengkap, atau null untuk memakai judul bawaan index.html (beranda). */
  title: string | null;
  description: string | null;
  /** Alamat tanpa domain, mis. "/template". */
  path: string;
  index: boolean;
  jsonLd: object[];
}

interface Known {
  title: string;
  description: string;
}

const PUBLIC_PAGES: Record<string, Known> = {
  '/tes-penempatan': {
    title: 'Tes penempatan Excel',
    description: 'Tes untuk tahu level Excel-mu dan mulai belajar dari bagian yang tepat. Gratis, bisa dikerjakan tanpa daftar akun.',
  },
  '/sprint': {
    title: 'Sprint 60 detik',
    description: 'Jawab soal Excel sebanyak mungkin dalam 60 detik dan bandingkan skormu di papan peringkat.',
  },
  '/jalur': {
    title: 'Jalur belajar Excel: admin, jualan, keuangan',
    description: 'Pilih jalur sesuai tujuanmu. Urutan pelajaran, latihan, dan template yang sudah dipilih untuk admin, usaha kecil, atau keuangan dasar.',
  },
  '/template': {
    title: 'Template Excel gratis dan siap pakai',
    description:
      'Template Excel untuk laporan penjualan, keuangan pribadi, stok barang, invoice, anggaran pernikahan, dan RAB. Rumus sudah terpasang, tinggal isi datamu.',
  },
  '/premium': {
    title: 'Gratis atau Premium',
    description: 'Semua pelajaran dan latihan gratis. Premium menambah solusi tanpa batas, template dan worksheet lanjutan, penelusur rumus, dan sertifikat.',
  },
  '/program': {
    title: 'Program Perintis: sertifikat gratis',
    description: 'Sertifikat gratis untuk pengguna pertama yang menyelesaikan tes penempatan, Sprint 60 detik, dan beberapa latihan.',
  },
  '/tentang': {
    title: 'Tentang Mahir Excel',
    description: 'Mahir Excel adalah platform belajar Excel gratis berbahasa Indonesia untuk pemula dan pekerja kantor, bukan produk Microsoft.',
  },
  '/privasi': { title: 'Kebijakan privasi', description: 'Data apa yang disimpan Mahir Excel dan bagaimana data itu dipakai.' },
  '/syarat': { title: 'Syarat penggunaan', description: 'Aturan memakai Mahir Excel, termasuk materi, akun, dan Premium.' },
};

/** Halaman yang ada tetapi tidak untuk diindeks: butuh login, pribadi, atau tidak berisi konten. */
const PRIVATE_EXACT = new Set([
  '/belajar',
  '/latihan',
  '/shortcut',
  '/worksheet',
  '/tantangan',
  '/kemajuan',
  '/laporan',
  '/wizard',
  '/profil',
  '/masuk',
  '/daftar',
  '/lupa-sandi',
]);

const exerciseSlugs = new Set(exercises.map((e) => e.slug));
const worksheetSlugs = new Set(worksheets.map((w) => w.slug));
const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]));

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Mahir Excel',
  url: 'https://mahirexcel.online/',
  inLanguage: 'id',
  description: 'Belajar Excel gratis dalam bahasa Indonesia, dengan latihan yang dinilai langsung di browser.',
};

const COURSE_LD = {
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: 'Belajar Excel dari nol',
  description: 'Pelajaran dan latihan Excel dari sel pertama sampai VLOOKUP, dalam bahasa Indonesia.',
  inLanguage: 'id',
  isAccessibleForFree: true,
  provider: { '@type': 'Organization', name: 'Mahir Excel', url: 'https://mahirexcel.online/' },
};

export function seoFor(rawPath: string): PageSeo {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : '/';
  const base = { path, jsonLd: [] as object[] };
  const missing: PageSeo = { ...base, status: 404, title: 'Halaman tidak ditemukan | Mahir Excel', description: null, index: false };

  if (path === '/') return { ...base, status: 200, title: null, description: null, index: true, jsonLd: [WEBSITE_LD, COURSE_LD] };

  const page = PUBLIC_PAGES[path];
  if (page) return { ...base, status: 200, title: `${page.title} | Mahir Excel`, description: page.description, index: true };

  const lesson = /^\/belajar\/([^/]+)$/.exec(path);
  if (lesson) {
    const l = lessonBySlug.get(lesson[1]!);
    if (!l) return missing;
    // Hanya pelajaran contoh yang terbuka untuk umum; lainnya meminta login, jadi tidak diindeks.
    return { ...base, status: 200, title: `${l.title} | Mahir Excel`, description: l.summary, index: PUBLIC_LESSON_SLUGS.includes(l.slug) };
  }

  const jalur = /^\/jalur\/([^/]+)$/.exec(path);
  if (jalur) {
    const p = pathBySlug(jalur[1]!);
    if (!p) return missing;
    return { ...base, status: 200, title: `Jalur ${p.title} | Mahir Excel`, description: `${p.tagline} Urutan pelajaran, latihan, dan template yang sudah dipilih.`, index: true };
  }

  const latihan = /^\/latihan\/([^/]+)$/.exec(path);
  if (latihan) {
    return exerciseSlugs.has(latihan[1]!) ? { ...base, status: 200, title: null, description: null, index: false } : missing;
  }
  const ws = /^\/worksheet\/([^/]+)$/.exec(path);
  if (ws) return worksheetSlugs.has(ws[1]!) ? { ...base, status: 200, title: null, description: null, index: false } : missing;

  if (PRIVATE_EXACT.has(path) || /^\/(bagikan|sertifikat)\/[^/]+$/.test(path) || path === '/admin' || path.startsWith('/admin/')) {
    return { ...base, status: 200, title: null, description: null, index: false };
  }

  return missing;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"[\\s\\S]*?/>`);
  return html.replace(re, `<meta ${attr}="${key}" content="${esc(value)}" />`);
}

/** Menyuntikkan hasil seoFor ke index.html bawaan build. */
export function applySeo(html: string, seo: PageSeo, origin: string): string {
  let out = html;
  const url = `${origin}${seo.path === '/' ? '/' : seo.path}`;
  if (seo.title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`);
    out = setMeta(out, 'property', 'og:title', seo.title);
    out = setMeta(out, 'name', 'twitter:title', seo.title);
  }
  if (seo.description) {
    out = setMeta(out, 'name', 'description', seo.description);
    out = setMeta(out, 'property', 'og:description', seo.description);
    out = setMeta(out, 'name', 'twitter:description', seo.description);
  }
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  out = out.replace(/<meta\s+property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  const extra: string[] = [];
  if (!seo.index) extra.push('<meta name="robots" content="noindex" />');
  for (const ld of seo.jsonLd) extra.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  if (extra.length) out = out.replace('</head>', `    ${extra.join('\n    ')}\n  </head>`);
  return out;
}
