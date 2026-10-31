import type { Built, DatasetSpec, Field } from './kit';
import { createRng } from './rng';
import { specs } from './specs';

export type { Built, DatasetSpec, Field } from './kit';
export { gradeValue, type GivenAnswer, type Verdict } from './grade';

export interface DatasetSummary {
  slug: string;
  title: string;
  field: Field;
  blurb: string;
  mess: string;
  rows: number;
  cols: number;
  /** Judul pendek tiap tugas, untuk katalog. */
  tasks: string[];
}

const built = new Map<string, Built>();

export const findSpec = (slug: string): DatasetSpec | undefined => specs.find((s) => s.slug === slug);

/** Data dibangkitkan dari slug sebagai benih, jadi selalu sama dan kunci jawabannya ikut tetap. */
export function getDataset(slug: string): { spec: DatasetSpec; data: Built } | null {
  const spec = findSpec(slug);
  if (!spec) return null;
  let data = built.get(slug);
  if (!data) {
    data = spec.build(createRng(`mahir-excel:${slug}`));
    built.set(slug, data);
  }
  return { spec, data };
}

const firstSentence = (s: string): string => s.split(/(?<=[.?])\s/)[0]!;

let summaries: DatasetSummary[] | null = null;
export function datasetCatalog(): DatasetSummary[] {
  summaries ??= specs.map((s) => {
    const { data } = getDataset(s.slug)!;
    return {
      slug: s.slug,
      title: s.title,
      field: s.field,
      blurb: s.blurb,
      mess: s.mess,
      rows: data.rows.length,
      cols: data.headers.length,
      tasks: data.tasks.map((t) => firstSentence(t.ask)),
    };
  });
  return summaries;
}

export const DATASET_COUNT = specs.length;
