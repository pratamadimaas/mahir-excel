import { modules } from './modules';

export interface PlacementQuestion {
  id: string;
  /** Slug modul yang diukur. */
  module: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

/** Uji Kemampuan Excel singkat: dua pertanyaan untuk modul awal, satu atau dua untuk modul lanjutan. Tidak mengukur kemahiran secara resmi. */
export const placementQuestions: PlacementQuestion[] = [
  {
    id: 'p1',
    module: 'mengenal-excel',
    question: 'Alamat sel di kolom C, baris 5 adalah…',
    options: ['5C', 'C5', 'C:5', 'R5C3'],
    answerIndex: 1,
    explanation: 'Alamat sel ditulis huruf kolom lalu nomor baris: C5.',
  },
  {
    id: 'p2',
    module: 'mengenal-excel',
    question: 'Agar Excel menghitung isi sel, rumus harus diawali…',
    options: ['Tanda kutip', 'Tanda sama dengan (=)', 'Tanda kurung', 'Huruf besar'],
    answerIndex: 1,
    explanation: 'Tanda sama dengan memberi tahu Excel bahwa isi sel adalah perhitungan.',
  },
  {
    id: 'p3',
    module: 'mengolah-data',
    question: 'Filter pada tabel data akan…',
    options: ['Menghapus baris yang tidak cocok', 'Menyembunyikan baris yang tidak cocok', 'Mengubah isi sel', 'Mengurutkan kolom'],
    answerIndex: 1,
    explanation: 'Filter hanya menyembunyikan baris; datanya tetap ada.',
  },
  {
    id: 'p4',
    module: 'rumus-dasar',
    question: 'Pada =SUM(B2:B6), apa arti B2:B6?',
    options: ['Hanya B2 dan B6', 'Semua sel dari B2 sampai B6', 'B2 dikurangi B6', 'Kolom B dan baris 6'],
    answerIndex: 1,
    explanation: 'Tanda titik dua menandai rentang: semua sel dari B2 sampai B6.',
  },
  {
    id: 'p5',
    module: 'rumus-dasar',
    question: 'Rumus =B2*$E$1 disalin ke baris bawahnya. Referensi mana yang tidak berubah?',
    options: ['B2', '$E$1', 'Keduanya', 'Tidak ada'],
    answerIndex: 1,
    explanation: 'Tanda $ mengunci kolom dan baris, sehingga $E$1 tetap sedangkan B2 bergeser menjadi B3, B4, ….',
  },
  {
    id: 'p6',
    module: 'logika',
    question: 'Apa hasil =IF(70>=70;"Lulus";"Remedial")?',
    options: ['Remedial', 'Lulus', 'TRUE', 'Galat'],
    answerIndex: 1,
    explanation: '70 >= 70 benar, sehingga IF menampilkan argumen kedua: Lulus.',
  },
  {
    id: 'p7',
    module: 'logika',
    question: 'AND(A1>5; B1>5) bernilai TRUE bila…',
    options: ['Salah satu lebih dari 5', 'Keduanya lebih dari 5', 'Keduanya 5 atau kurang', 'Selalu'],
    answerIndex: 1,
    explanation: 'AND hanya benar bila semua syarat benar.',
  },
  {
    id: 'p8',
    module: 'fungsi-bersyarat',
    question: '=COUNTIF(A1:A5;">3") menghitung…',
    options: ['Jumlah nilai di atas 3', 'Banyaknya sel yang bernilai lebih dari 3', 'Rata-rata nilai di atas 3', 'Nilai terbesar'],
    answerIndex: 1,
    explanation: 'COUNTIF menghitung banyaknya sel yang memenuhi kriteria, bukan menjumlahkan nilainya.',
  },
  {
    id: 'p9',
    module: 'fungsi-bersyarat',
    question: 'Pada SUMIFS, argumen yang ditulis paling awal adalah…',
    options: ['Rentang kriteria pertama', 'Kriteria pertama', 'Rentang yang dijumlahkan', 'Jumlah syarat'],
    answerIndex: 2,
    explanation: 'SUMIFS menaruh rentang yang dijumlahkan di depan, berbeda dari SUMIF.',
  },
  {
    id: 'p10',
    module: 'fungsi-pencarian',
    question: 'Agar VLOOKUP hanya menerima kecocokan persis, argumen terakhir diisi…',
    options: ['TRUE', 'FALSE', '1', 'Dikosongkan'],
    answerIndex: 1,
    explanation: 'FALSE (atau 0) memaksa pencocokan persis.',
  },
  {
    id: 'p11',
    module: 'teks-tanggal',
    question: 'Apa hasil =LEFT("BRS-2025";3)?',
    options: ['BRS', '2025', 'BRS-', '3'],
    answerIndex: 0,
    explanation: 'LEFT mengambil 3 karakter pertama dari kiri: BRS.',
  },
  {
    id: 'p12',
    module: 'rapi-dan-aman',
    question: 'Aturan Conditional Formatting berbasis rumus akan menandai sel bila rumusnya bernilai…',
    options: ['FALSE', 'TRUE', '0', 'Teks kosong'],
    answerIndex: 1,
    explanation: 'Format diterapkan pada sel yang rumus aturannya menghasilkan TRUE.',
  },
  {
    id: 'p13',
    module: 'teks-tanggal',
    question: 'Apa hasil =MID("INV-2025-007";5;4)?',
    options: ['INV-', '2025', '-200', '2025-'],
    answerIndex: 1,
    explanation: 'MID mulai dari karakter ke-5 dan mengambil 4 karakter: 2025.',
  },
  {
    id: 'p14',
    module: 'teks-tanggal',
    question: 'Di Excel, tanggal sebenarnya disimpan sebagai…',
    options: ['Teks biasa', 'Angka seri (hitungan hari)', 'Gambar', 'Rumus'],
    answerIndex: 1,
    explanation: 'Tanggal adalah angka seri, itulah sebabnya tanggal bisa dikurangkan untuk mendapat selisih hari.',
  },
  {
    id: 'p15',
    module: 'rapi-dan-aman',
    question: 'Data Validation berupa daftar pilihan dipakai untuk…',
    options: ['Membatasi isian sel hanya pada pilihan yang diizinkan', 'Menyembunyikan sel yang kosong', 'Mengurutkan isi sel', 'Menyalin rumus ke sel lain'],
    answerIndex: 0,
    explanation: 'Daftar pilihan membuat sel hanya menerima nilai yang kamu izinkan, sehingga salah ketik berkurang.',
  },
  {
    id: 'p16',
    module: 'fungsi-pencarian',
    question: 'VLOOKUP hanya mencari ke kanan dari kolom kunci. Fungsi yang bisa mengambil nilai di kiri kolom kunci adalah…',
    options: ['SUMIF', 'XLOOKUP', 'ROUND', 'COUNT'],
    answerIndex: 1,
    explanation: 'XLOOKUP memisahkan kolom yang dicari dan kolom hasil, sehingga hasil boleh berada di sebelah kiri.',
  },
];

export type PlacementLevel = 'Pemula' | 'Menengah' | 'Mahir';

/** Tingkat tiap modul. Urutan array adalah urutan tampil di tes (dari gampang ke sulit). */
export const PLACEMENT_TIERS: { level: PlacementLevel; modules: string[] }[] = [
  { level: 'Pemula', modules: ['mengenal-excel', 'mengolah-data', 'rumus-dasar'] },
  { level: 'Menengah', modules: ['logika', 'fungsi-bersyarat', 'fungsi-pencarian'] },
  { level: 'Mahir', modules: ['teks-tanggal', 'rapi-dan-aman'] },
];

/** Satu tingkat dianggap lulus bila minimal 60% jawabannya benar. */
const passNeeded = (n: number): number => Math.ceil((n * 3) / 5);

export function placementTierOf(module: string): PlacementLevel {
  return PLACEMENT_TIERS.find((t) => t.modules.includes(module))?.level ?? 'Pemula';
}

/** Pertanyaan menurut urutan tampil: per tingkat, urutan di daftar sumber dipertahankan. */
export const placementOrdered: PlacementQuestion[] = PLACEMENT_TIERS.flatMap((t) =>
  placementQuestions.filter((q) => placementTierOf(q.module) === t.level),
);

export interface PlacementProgress {
  /** Pertanyaan yang sudah dijawab sesuai alur tes. */
  asked: PlacementQuestion[];
  /** Pertanyaan berikutnya; null bila tes selesai. */
  next: PlacementQuestion | null;
}

/**
 * Alur tes: pertanyaan muncul per tingkat. Begitu satu tingkat tidak mungkin lagi lulus (terlalu banyak salah),
 * tes berhenti, supaya pemula tidak dihadapkan pada soal yang pasti belum dikuasai.
 */
export function placementProgress(answers: Record<string, number>): PlacementProgress {
  const asked: PlacementQuestion[] = [];
  for (const tier of PLACEMENT_TIERS) {
    const qs = placementOrdered.filter((q) => placementTierOf(q.module) === tier.level);
    const maxWrong = qs.length - passNeeded(qs.length);
    let wrong = 0;
    for (const q of qs) {
      const a = answers[q.id];
      if (a === undefined) return { asked, next: q };
      asked.push(q);
      if (a !== q.answerIndex && ++wrong > maxWrong) return { asked, next: null };
    }
  }
  return { asked, next: null };
}

export interface PlacementResult {
  score: number;
  total: number;
  /** Tingkat kemampuan dari akurasi per tingkat: tingkat pertama yang tidak lulus; Mahir bila semua tingkat lulus. */
  level: PlacementLevel;
  tiers: { level: PlacementLevel; correct: number; total: number; passed: boolean }[];
  perModule: { module: string; correct: number; total: number }[];
  /** Modul pertama (urutan kurikulum) yang belum dikuasai penuh; null bila semua benar. */
  startModule: string | null;
  /** Pertanyaan yang dijawab salah, untuk ditinjau. */
  missed: string[];
}

/** Menilai jawaban: tiap modul dihitung sendiri; mulai dari modul pertama yang belum dijawab benar seluruhnya. */
export function evaluatePlacement(answers: Record<string, number>, questions: PlacementQuestion[] = placementQuestions): PlacementResult {
  const perMap = new Map<string, { correct: number; total: number }>();
  const missed: string[] = [];
  let score = 0;
  for (const q of questions) {
    const cur = perMap.get(q.module) ?? { correct: 0, total: 0 };
    cur.total++;
    if (answers[q.id] === q.answerIndex) {
      cur.correct++;
      score++;
    } else missed.push(q.id);
    perMap.set(q.module, cur);
  }
  const perModule = modules.filter((m) => perMap.has(m.slug)).map((m) => ({ module: m.slug, ...perMap.get(m.slug)! }));
  const first = perModule.find((m) => m.correct < m.total);
  const tiers = PLACEMENT_TIERS.map((t) => {
    const mine = perModule.filter((m) => t.modules.includes(m.module));
    const correct = mine.reduce((n, m) => n + m.correct, 0);
    const total = mine.reduce((n, m) => n + m.total, 0);
    return { level: t.level, correct, total, passed: correct >= passNeeded(total) };
  }).filter((t) => t.total > 0);
  const level = tiers.find((t) => !t.passed)?.level ?? 'Mahir';
  return { score, total: questions.length, level, tiers, perModule, startModule: first?.module ?? null, missed };
}

/** Label tingkat: dari hasil tes bila ada (akurasi per tingkat), atau dari modul pertama yang belum dikuasai untuk hasil versi lama. */
export function placementLevel(result: Pick<PlacementResult, 'startModule'> & Partial<Pick<PlacementResult, 'level'>>): PlacementLevel {
  if (result.level) return result.level;
  if (result.startModule === null) return 'Mahir';
  const idx = modules.findIndex((m) => m.slug === result.startModule);
  if (idx <= 2) return 'Pemula'; // Mengenal Excel, Mengolah Data, Rumus Dasar (juga bila tidak dikenal)
  if (idx <= 5) return 'Menengah'; // Logika, Fungsi Bersyarat, Fungsi Pencarian
  return 'Mahir'; // Teks/Tanggal dan Rapi/Aman: dasar sudah kuat
}
