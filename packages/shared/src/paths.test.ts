import { describe, expect, it } from 'vitest';
import { lessons, paths, templates } from './index';

describe('jalur belajar', () => {
  it('slug unik dan jalur yang diharapkan ada', () => {
    expect(new Set(paths.map((p) => p.slug)).size).toBe(paths.length);
    expect(paths.map((p) => p.slug)).toEqual(['perkantoran-admin', 'admin-hrd', 'jualan-usaha', 'keuangan-dasar']);
  });

  it.each(paths.map((p) => [p.slug, p] as const))('%s: semua slug ada, tidak berulang, dan urutan di tiap modul mengikuti kurikulum', (_slug, p) => {
    expect(new Set(p.lessons).size).toBe(p.lessons.length);
    expect(p.lessons.length).toBeGreaterThanOrEqual(8);
    const defs = p.lessons.map((s) => {
      const l = lessons.find((x) => x.slug === s);
      expect(l, `pelajaran ${s}`).toBeDefined();
      return l!;
    });
    // Dalam satu modul, pelajaran yang lebih awal di kurikulum tidak boleh muncul setelah yang lebih akhir.
    const lastOrder = new Map<string, number>();
    for (const l of defs) {
      expect(l.sortOrder, `${l.slug} muncul setelah pelajaran yang lebih akhir di modul ${l.moduleSlug}`).toBeGreaterThanOrEqual(lastOrder.get(l.moduleSlug) ?? 0);
      lastOrder.set(l.moduleSlug, l.sortOrder);
    }
    for (const t of p.templates) expect(templates.some((x) => x.slug === t), `template ${t}`).toBe(true);
    expect(p.outcomes.length).toBeGreaterThanOrEqual(3);
    expect(p.premiumExtras.length).toBeGreaterThan(0);
    expect(p.tagline.length).toBeLessThanOrEqual(90);
  });

  it('teks tidak menjanjikan pekerjaan, gaji, atau sertifikasi resmi', () => {
    const text = JSON.stringify(paths.map(({ lessons: _l, templates: _t, ...rest }) => rest)).toLowerCase();
    // Jalur HRD wajar membahas data penggajian; yang dilarang adalah janji tentang penghasilan pembaca.
    for (const bad of ['dijamin', 'pasti diterima', 'gaji tinggi', 'gaji besar', 'bergaji', 'bersertifikat resmi']) expect(text).not.toContain(bad);
  });
});
