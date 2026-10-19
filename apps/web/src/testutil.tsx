import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes, Providers } from './App';
import { resetCatalogCache } from './services/catalog';

type Handler = (url: URL, init?: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;

/** Mengganti fetch global dengan penangan per "METODE /path". Rute tak dikenal -> 404 JSON. */
export function mockApi(routes: Record<string, Handler | unknown>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${url.pathname.replace(/^\/api/, '')}`;
    const h = routes[key];
    let status = 200;
    let body: unknown;
    if (h === undefined) {
      status = 404;
      body = { error: { code: 'NOT_FOUND', message: `Tidak dimock: ${key}` } };
    } else if (typeof h === 'function') {
      const r = await (h as Handler)(url, init);
      status = r.status ?? 200;
      body = r.body;
    } else body = { data: h };
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function renderApp(path = '/') {
  resetCatalogCache();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Providers>
        <AppRoutes />
      </Providers>
    </MemoryRouter>,
  );
}

export const MODULES = [
  {
    slug: 'rumus-dasar',
    title: 'Rumus Dasar',
    summary: 'SUM dan kawan-kawan',
    sortOrder: 3,
    lessons: [
      { slug: 'fungsi-sum', title: 'SUM: Menjumlahkan Angka', summary: 'Jumlahkan rentang', minutes: 8, sortOrder: 1, exerciseCount: 1 },
      { slug: 'average-min-max', title: 'AVERAGE, MIN, dan MAX', summary: 'Ringkas data', minutes: 8, sortOrder: 2, exerciseCount: 1 },
    ],
  },
];

export const LESSON = {
  slug: 'fungsi-sum',
  title: 'SUM: Menjumlahkan Angka',
  summary: 'Jumlahkan rentang sel dengan satu fungsi.',
  minutes: 8,
  published: true,
  module: { slug: 'rumus-dasar', title: 'Rumus Dasar' },
  siblings: [
    { slug: 'fungsi-sum', title: 'SUM: Menjumlahkan Angka' },
    { slug: 'average-min-max', title: 'AVERAGE, MIN, dan MAX' },
  ],
  prev: null,
  next: { slug: 'average-min-max', title: 'AVERAGE, MIN, dan MAX' },
  exercises: [
    {
      slug: 'total-pengeluaran',
      title: 'Total pengeluaran bulanan',
      description: 'd',
      topic: 'rumus-dasar',
      difficulty: 'mudah',
      points: 10,
      lessonSlug: 'fungsi-sum',
    },
  ],
  content: {
    objectives: ['Menulis SUM dengan rentang sel.'],
    sections: [{ heading: 'Mengapa SUM', paragraphs: ['SUM menjumlahkan angka.'] }],
    syntax: { signature: '=SUM(angka1; [angka2]; ...)', params: [{ name: 'angka1', description: 'Rentang pertama.' }] },
    example: {
      title: 'Pengeluaran mingguan',
      description: 'Menjumlahkan tiga pengeluaran.',
      table: [
        ['Pos', 'Biaya'],
        ['Makan', 350000],
        ['Transport', 120000],
        ['Total', '=SUM(B2:B3)'],
      ],
      formula: '=SUM(B2:B3)',
      result: '470000',
      walkthrough: 'B2 + B3.',
    },
    mistakes: [{ title: 'Rentang kurang', detail: 'Periksa batas rentang.' }],
    quiz: [{ question: 'Hasil =SUM(1;2)?', options: ['2', '3'], answerIndex: 1, explanation: '1+2=3.' }],
  },
};

export const EXERCISE = {
  slug: 'total-pengeluaran',
  title: 'Total pengeluaran bulanan',
  description: 'Gunakan SUM.',
  topic: 'rumus-dasar',
  difficulty: 'mudah',
  rows: 6,
  cols: 4,
  cells: { A1: 'Pos', B1: 'Biaya', A2: 'Makan', B2: '350000', A3: 'Transport', B3: '120000', A4: 'Total' },
  editable: ['B4'],
  task: 'Isi B4 dengan SUM dari B2 sampai B3.',
  hints: ['Awali dengan =SUM(', 'Rentang B2:B3'],
  points: 10,
  lessonSlug: 'fungsi-sum',
  targetCells: ['B4'],
};

export const STUDENT = { id: 5, email: 'siswa@example.com', displayName: 'Siswa', role: 'user', emailVerified: true };

export const EMPTY_PROGRESS = {
  completedLessons: [] as string[],
  exercises: {} as Record<string, { completedAt: string; attempts: number; points: number }>,
  reviews: {},
  activeDays: [] as string[],
  totalPoints: 0,
  streak: { current: 0, longest: 0 },
};

/** Pengguna yang sudah masuk: seluruh materi belajar hanya terbuka untuk pengguna masuk. */
export const SIGNED_IN = {
  'GET /auth/me': { user: STUDENT, csrfToken: 'tok' },
  'GET /progress': EMPTY_PROGRESS,
  'GET /progress/review-due': { due: [], upcoming: 0 },
};
