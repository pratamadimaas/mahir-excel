import { Router } from 'express';
import { z } from 'zod';
import { exercises, lessons, modules, pathBySlug, paths, templates, PUBLIC_LESSON_SLUGS, type PathDef } from '@excellab/shared';
import type { Ctx } from '../app';
import { notFound, parse } from '../middleware/errors';

const slugParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);

/** Bidang dihitung dari kurikulum di paket shared, tanpa database. Daftar dan rincian terbuka untuk umum. */
function summarize(p: PathDef) {
  const steps = p.lessons.map((slug) => {
    const l = lessons.find((x) => x.slug === slug)!;
    return {
      slug: l.slug,
      title: l.title,
      summary: l.summary,
      minutes: l.minutes,
      moduleTitle: modules.find((m) => m.slug === l.moduleSlug)?.title ?? '',
      exerciseCount: exercises.filter((e) => e.lessonSlug === l.slug).length,
      publicLesson: PUBLIC_LESSON_SLUGS.includes(l.slug),
    };
  });
  return {
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    forWho: p.forWho,
    lessons: steps.length,
    minutes: steps.reduce((n, s) => n + s.minutes, 0),
    exercises: steps.reduce((n, s) => n + s.exerciseCount, 0),
    steps,
  };
}

export function pathRoutes(_ctx: Ctx): Router {
  const r = Router();

  r.get('/paths', (_req, res) => {
    res.json({ data: paths.map((p) => ({ ...summarize(p), steps: undefined, lessonSlugs: p.lessons })) });
  });

  r.get('/paths/:slug', (req, res) => {
    const p = pathBySlug(parse(slugParam, req.params.slug));
    if (!p) throw notFound('Bidang');
    res.json({
      data: {
        ...summarize(p),
        outcomes: p.outcomes,
        premiumExtras: p.premiumExtras,
        templates: p.templates.map((slug) => {
          const t = templates.find((x) => x.slug === slug)!;
          return { slug: t.slug, title: t.title, description: t.description, free: t.free };
        }),
      },
    });
  });

  return r;
}
