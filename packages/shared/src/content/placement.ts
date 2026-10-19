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

/** Tes penempatan singkat: dua pertanyaan untuk modul awal, satu atau dua untuk modul lanjutan. Tidak mengukur kemahiran secara resmi. */
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
];

export interface PlacementResult {
  score: number;
  total: number;
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
  return { score, total: questions.length, perModule, startModule: first?.module ?? null, missed };
}

export type PlacementLevel = 'Pemula' | 'Menengah' | 'Mahir';

/** Label singkat untuk dibagikan: berdasarkan modul pertama yang belum dikuasai (null = semua benar = Mahir). */
export function placementLevel(result: Pick<PlacementResult, 'startModule'>): PlacementLevel {
  if (result.startModule === null) return 'Mahir';
  const idx = modules.findIndex((m) => m.slug === result.startModule);
  if (idx <= 2) return 'Pemula'; // Mengenal Excel, Mengolah Data, Rumus Dasar (juga bila tidak dikenal)
  if (idx <= 5) return 'Menengah'; // Logika, Fungsi Bersyarat, Fungsi Pencarian
  return 'Mahir'; // Teks/Tanggal dan Rapi/Aman: dasar sudah kuat
}
