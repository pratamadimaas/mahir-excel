/** Tujuan yang bisa dipilih di Wizard rumus. Setiap tujuan merakit rumus dari isian dan menjelaskannya dalam bahasa sehari-hari. */

export interface WizardField {
  key: string;
  label: string;
  kind: 'range' | 'cell' | 'text' | 'number' | 'choice';
  default: string;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface WizardGoal {
  id: string;
  title: string;
  hint: string;
  /** Rumusnya terbuka untuk akun gratis. Lainnya khusus Premium. */
  free: boolean;
  fields: WizardField[];
  build: (v: Record<string, string>) => string;
  explain: (v: Record<string, string>) => string[];
}

/** Tabel contoh yang dipakai wizard untuk menghitung hasil. Baris 1 adalah judul kolom. */
export const SAMPLE_TABLE: string[][] = [
  ['Produk', 'Kategori', 'Harga', 'Jumlah'],
  ['Kopi susu', 'Minuman', '18000', '3'],
  ['Teh manis', 'Minuman', '8000', '5'],
  ['Roti bakar', 'Makanan', '15000', '2'],
  ['Nasi goreng', 'Makanan', '25000', '4'],
  ['Mie goreng', 'Makanan', '22000', '1'],
  ['Es jeruk', 'Minuman', '9000', '6'],
  ['Kopi susu', 'Minuman', '18000', '2'],
  ['Total', '', '', '=SUM(D2:D8)'],
];

export const SAMPLE_CELLS: Record<string, string> = Object.fromEntries(
  SAMPLE_TABLE.flatMap((row, r) => row.map((v, c) => [`${String.fromCharCode(65 + c)}${r + 1}`, v] as const)),
);

const CELL = /^\$?[A-Za-z]{1,3}\$?\d+$/;
const RANGE = /^\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+$/;
const NUMBER = /^-?\d+([.]\d+)?$/;

const up = (s: string): string => s.trim().toUpperCase();
const quote = (s: string): string => `"${s.replace(/"/g, '""')}"`;

/** Teks atau angka biasa untuk dimasukkan ke rumus: angka dan alamat sel apa adanya, selain itu diberi tanda kutip. */
export function lit(raw: string): string {
  const t = raw.trim();
  if (NUMBER.test(t) || CELL.test(t) || /^(TRUE|FALSE)$/i.test(t)) return CELL.test(t) ? up(t) : t;
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t;
  return quote(t);
}

/** Kriteria untuk COUNTIF dan SUMIF: teks seperti ">3" atau "Makanan" harus diberi tanda kutip. */
export function crit(raw: string): string {
  const t = raw.trim();
  if (t === '') return '""';
  if (NUMBER.test(t)) return t;
  if (CELL.test(t)) return up(t);
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t;
  return quote(t);
}

/** Pesan galat untuk isian yang tidak valid, atau null bila semuanya baik. */
export function validateFields(goal: WizardGoal, v: Record<string, string>): string | null {
  for (const f of goal.fields) {
    const val = (v[f.key] ?? '').trim();
    if (val === '' && f.kind !== 'text' && f.kind !== 'choice') return `Isi "${f.label}".`;
    if (f.kind === 'range' && !RANGE.test(val)) return `"${f.label}" harus berupa rentang, misalnya B2:B10.`;
    if (f.kind === 'cell' && !CELL.test(val)) return `"${f.label}" harus berupa satu sel, misalnya B2.`;
    if (f.kind === 'number' && !NUMBER.test(val)) return `"${f.label}" harus berupa angka.`;
  }
  return null;
}

const r = (label: string, key: string, def: string, help?: string): WizardField => ({ key, label, kind: 'range', default: def, help });
const c = (label: string, key: string, def: string, help?: string): WizardField => ({ key, label, kind: 'cell', default: def, help });
const t = (label: string, key: string, def: string, help?: string): WizardField => ({ key, label, kind: 'text', default: def, help });
const n = (label: string, key: string, def: string, help?: string): WizardField => ({ key, label, kind: 'number', default: def, help });

export const GOALS: WizardGoal[] = [
  {
    id: 'jumlahkan',
    title: 'Menjumlahkan angka',
    hint: 'Total dari satu kolom atau beberapa sel.',
    free: true,
    fields: [r('Rentang angka', 'range', 'D2:D8', 'Sel-sel yang mau dijumlahkan.')],
    build: (v) => `=SUM(${up(v.range!)})`,
    explain: (v) => [`SUM menjumlahkan semua angka di ${up(v.range!)}.`, 'Sel kosong dan teks di dalam rentang diabaikan, tidak membuat galat.'],
  },
  {
    id: 'rata-rata',
    title: 'Menghitung rata-rata',
    hint: 'Nilai tengah dari sekumpulan angka.',
    free: true,
    fields: [r('Rentang angka', 'range', 'C2:C8')],
    build: (v) => `=AVERAGE(${up(v.range!)})`,
    explain: (v) => [`AVERAGE menjumlahkan angka di ${up(v.range!)} lalu membaginya dengan banyaknya angka.`, 'Sel kosong tidak ikut dihitung, tetapi angka 0 ikut dihitung.'],
  },
  {
    id: 'terbesar-terkecil',
    title: 'Mencari nilai terbesar atau terkecil',
    hint: 'Harga tertinggi, nilai terendah, dan sejenisnya.',
    free: true,
    fields: [
      r('Rentang angka', 'range', 'C2:C8'),
      { key: 'mode', label: 'Yang dicari', kind: 'choice', default: 'MAX', options: [{ value: 'MAX', label: 'Terbesar' }, { value: 'MIN', label: 'Terkecil' }] },
    ],
    build: (v) => `=${v.mode}(${up(v.range!)})`,
    explain: (v) => [`${v.mode} memeriksa semua angka di ${up(v.range!)} dan mengambil yang ${v.mode === 'MAX' ? 'terbesar' : 'terkecil'}.`],
  },
  {
    id: 'hitung-terisi',
    title: 'Menghitung banyak sel',
    hint: 'Berapa sel yang terisi, atau berapa yang berisi angka.',
    free: true,
    fields: [
      r('Rentang', 'range', 'A2:A8'),
      {
        key: 'mode',
        label: 'Yang dihitung',
        kind: 'choice',
        default: 'COUNTA',
        options: [
          { value: 'COUNTA', label: 'Semua sel yang terisi (angka atau teks)' },
          { value: 'COUNT', label: 'Hanya sel berisi angka' },
        ],
      },
    ],
    build: (v) => `=${v.mode}(${up(v.range!)})`,
    explain: (v) => [
      v.mode === 'COUNTA' ? `COUNTA menghitung sel di ${up(v.range!)} yang tidak kosong, apa pun isinya.` : `COUNT menghitung sel di ${up(v.range!)} yang berisi angka. Teks tidak dihitung.`,
    ],
  },
  {
    id: 'hitung-jika',
    title: 'Menghitung yang memenuhi syarat',
    hint: 'Berapa baris berkategori Makanan, berapa nilai di atas 70, dan sejenisnya.',
    free: false,
    fields: [
      r('Rentang yang diperiksa', 'range', 'B2:B8'),
      t('Syaratnya', 'crit', 'Makanan', 'Teks, angka, atau perbandingan seperti >3 atau <>Minuman. Bisa juga alamat sel.'),
    ],
    build: (v) => `=COUNTIF(${up(v.range!)},${crit(v.crit ?? '')})`,
    explain: (v) => [
      `COUNTIF memeriksa sel di ${up(v.range!)} satu per satu.`,
      `Sel yang cocok dengan syarat ${crit(v.crit ?? '')} dihitung satu.`,
      'Huruf besar dan kecil dianggap sama.',
    ],
  },
  {
    id: 'jumlah-jika',
    title: 'Menjumlahkan yang memenuhi syarat',
    hint: 'Total penjualan kategori Minuman, total gaji divisi tertentu, dan sejenisnya.',
    free: false,
    fields: [
      r('Rentang yang diperiksa', 'range', 'B2:B8'),
      t('Syaratnya', 'crit', 'Minuman'),
      r('Rentang angka yang dijumlahkan', 'sum', 'C2:C8', 'Harus sebaris dengan rentang yang diperiksa dan sama panjang.'),
    ],
    build: (v) => `=SUMIF(${up(v.range!)},${crit(v.crit ?? '')},${up(v.sum!)})`,
    explain: (v) => [
      `SUMIF memeriksa ${up(v.range!)} satu per satu.`,
      `Di baris yang cocok dengan syarat ${crit(v.crit ?? '')}, angka dari ${up(v.sum!)} pada baris yang sama ikut dijumlahkan.`,
      'Baris yang tidak cocok dilewati.',
    ],
  },
  {
    id: 'jumlah-dua-syarat',
    title: 'Menjumlahkan dengan dua syarat',
    hint: 'Total penjualan Minuman untuk jumlah di atas 2, dan sejenisnya.',
    free: false,
    fields: [
      r('Rentang angka yang dijumlahkan', 'sum', 'C2:C8'),
      r('Rentang syarat pertama', 'range1', 'B2:B8'),
      t('Syarat pertama', 'crit1', 'Minuman'),
      r('Rentang syarat kedua', 'range2', 'D2:D8'),
      t('Syarat kedua', 'crit2', '>2'),
    ],
    build: (v) => `=SUMIFS(${up(v.sum!)},${up(v.range1!)},${crit(v.crit1 ?? '')},${up(v.range2!)},${crit(v.crit2 ?? '')})`,
    explain: (v) => [
      `SUMIFS menjumlahkan ${up(v.sum!)} hanya untuk baris yang memenuhi KEDUA syarat.`,
      `Syarat pertama: ${up(v.range1!)} cocok dengan ${crit(v.crit1 ?? '')}.`,
      `Syarat kedua: ${up(v.range2!)} cocok dengan ${crit(v.crit2 ?? '')}.`,
      'Perhatikan urutannya: rentang yang dijumlahkan ditulis lebih dulu, tidak seperti SUMIF.',
    ],
  },
  {
    id: 'jika-lalu',
    title: 'Memberi hasil berbeda tergantung kondisi',
    hint: 'Lulus atau tidak, lunas atau belum, aman atau pesan lagi.',
    free: false,
    fields: [
      c('Sel yang diperiksa', 'cell', 'C2'),
      {
        key: 'op',
        label: 'Perbandingan',
        kind: 'choice',
        default: '>=',
        options: [
          { value: '>=', label: 'lebih besar atau sama dengan' },
          { value: '>', label: 'lebih besar dari' },
          { value: '<=', label: 'lebih kecil atau sama dengan' },
          { value: '<', label: 'lebih kecil dari' },
          { value: '=', label: 'sama dengan' },
          { value: '<>', label: 'tidak sama dengan' },
        ],
      },
      t('Nilai pembanding', 'value', '15000'),
      t('Hasil bila benar', 'yes', 'Mahal'),
      t('Hasil bila salah', 'no', 'Murah'),
    ],
    build: (v) => `=IF(${up(v.cell!)}${v.op}${lit(v.value ?? '')},${lit(v.yes ?? '')},${lit(v.no ?? '')})`,
    explain: (v) => [
      `IF memeriksa apakah ${up(v.cell!)} ${v.op} ${lit(v.value ?? '')}.`,
      `Kalau benar, hasilnya ${lit(v.yes ?? '')}. Kalau salah, hasilnya ${lit(v.no ?? '')}.`,
      'Teks di dalam rumus harus diapit tanda kutip, wizard sudah menambahkannya.',
    ],
  },
  {
    id: 'cari-vlookup',
    title: 'Mencari data di tabel (VLOOKUP)',
    hint: 'Ambil harga dari daftar produk, nama dari daftar kode.',
    free: false,
    fields: [
      t('Yang dicari', 'key', 'Roti bakar', 'Teks, angka, atau alamat sel yang berisi kuncinya.'),
      r('Tabel pencarian', 'table', 'A2:C8', 'Kolom pertama tabel harus berisi kunci yang dicari.'),
      n('Hasil ada di kolom ke', 'col', '3', 'Hitung dari kolom pertama tabel: kolom pertama = 1.'),
      {
        key: 'miss',
        label: 'Bila tidak ketemu',
        kind: 'choice',
        default: 'tulis',
        options: [
          { value: 'tulis', label: 'Tulis "Tidak ada"' },
          { value: 'galat', label: 'Biarkan muncul #N/A' },
        ],
      },
    ],
    build: (v) => {
      const core = `VLOOKUP(${lit(v.key ?? '')},${up(v.table!)},${v.col!.trim()},FALSE)`;
      return v.miss === 'galat' ? `=${core}` : `=IFERROR(${core},"Tidak ada")`;
    },
    explain: (v) => [
      `VLOOKUP mencari ${lit(v.key ?? '')} di kolom paling kiri ${up(v.table!)}.`,
      `Kalau ketemu, ia mengambil isi kolom ke-${v.col!.trim()} pada baris itu.`,
      'FALSE di akhir berarti harus persis sama. Ini hampir selalu yang kamu mau.',
      ...(v.miss === 'galat' ? [] : ['IFERROR menggantikan galat #N/A dengan tulisan "Tidak ada" supaya tabelmu rapi.']),
    ],
  },
  {
    id: 'cari-index-match',
    title: 'Mencari data ke kiri atau kolom bebas (INDEX dan MATCH)',
    hint: 'Saat kolom hasil ada di kiri kunci, yang tidak bisa dilakukan VLOOKUP.',
    free: false,
    fields: [
      t('Yang dicari', 'key', 'Mie goreng'),
      r('Kolom tempat kunci dicari', 'lookup', 'A2:A8'),
      r('Kolom hasil yang diambil', 'result', 'C2:C8', 'Harus sama panjang dan sebaris dengan kolom kunci.'),
    ],
    build: (v) => `=INDEX(${up(v.result!)},MATCH(${lit(v.key ?? '')},${up(v.lookup!)},0))`,
    explain: (v) => [
      `MATCH mencari ${lit(v.key ?? '')} di ${up(v.lookup!)} dan menjawab urutannya (baris ke berapa).`,
      `INDEX mengambil isi ${up(v.result!)} pada urutan itu.`,
      '0 di MATCH berarti harus persis sama.',
    ],
  },
  {
    id: 'persentase',
    title: 'Menghitung persentase',
    hint: 'Bagian dari total, misalnya porsi penjualan satu produk.',
    free: false,
    fields: [c('Sel bagian', 'part', 'D2'), c('Sel total', 'total', 'D9', 'Kunci dengan $ (mis. $D$9) bila rumusnya akan disalin ke bawah.')],
    build: (v) => `=${up(v.part!)}/${up(v.total!)}`,
    explain: (v) => [
      `Rumus ini membagi ${up(v.part!)} dengan ${up(v.total!)}. Hasilnya angka desimal, misalnya 0.25.`,
      'Ubah tampilan sel menjadi Persen (Ctrl+Shift+5) supaya terbaca 25%.',
      'Kalau total bisa nol, bungkus dengan IFERROR supaya tidak muncul #DIV/0!.',
    ],
  },
  {
    id: 'gabung-teks',
    title: 'Menggabungkan teks dari dua sel',
    hint: 'Nama depan dan belakang, kode dan nama.',
    free: false,
    fields: [
      c('Sel pertama', 'a', 'A2'),
      c('Sel kedua', 'b', 'B2'),
      { key: 'sep', label: 'Pemisah', kind: 'choice', default: ' ', options: [{ value: ' ', label: 'Spasi' }, { value: '-', label: 'Tanda hubung (-)' }, { value: ', ', label: 'Koma dan spasi' }, { value: '', label: 'Tanpa pemisah' }] },
    ],
    build: (v) => (v.sep === '' ? `=${up(v.a!)}&${up(v.b!)}` : `=${up(v.a!)}&${quote(v.sep ?? '')}&${up(v.b!)}`),
    explain: (v) => [
      `Tanda & menyambung teks. ${up(v.a!)} disambung ${v.sep === '' ? 'langsung' : `dengan ${quote(v.sep ?? '')}`} ke ${up(v.b!)}.`,
      'Angka juga bisa disambung, hasilnya menjadi teks.',
    ],
  },
  {
    id: 'rapikan-teks',
    title: 'Merapikan teks',
    hint: 'Hapus spasi berlebih, ubah huruf besar atau kecil.',
    free: false,
    fields: [
      c('Sel teks', 'cell', 'A2'),
      {
        key: 'mode',
        label: 'Yang dilakukan',
        kind: 'choice',
        default: 'TRIM',
        options: [
          { value: 'TRIM', label: 'Hapus spasi berlebih' },
          { value: 'UPPER', label: 'HURUF BESAR semua' },
          { value: 'LOWER', label: 'huruf kecil semua' },
          { value: 'PROPER', label: 'Huruf Besar Di Awal Kata' },
        ],
      },
    ],
    build: (v) => `=${v.mode}(${up(v.cell!)})`,
    explain: (v) => [
      v.mode === 'TRIM'
        ? 'TRIM membuang spasi di awal dan akhir, dan menyisakan satu spasi di antara kata.'
        : `${v.mode} mengubah huruf teks di ${up(v.cell!)}; teks asli tidak berubah, hasilnya ada di sel rumus.`,
    ],
  },
  {
    id: 'bulatkan',
    title: 'Membulatkan angka',
    hint: 'Dua angka di belakang koma, atau ke ribuan terdekat.',
    free: false,
    fields: [
      c('Sel angka', 'cell', 'C2'),
      n('Jumlah angka di belakang koma', 'digits', '0', 'Angka negatif membulatkan ke kiri: -3 berarti ke ribuan terdekat.'),
    ],
    build: (v) => `=ROUND(${up(v.cell!)},${v.digits!.trim()})`,
    explain: (v) => [
      `ROUND membulatkan ${up(v.cell!)} ke ${Number(v.digits) >= 0 ? `${Number(v.digits)} angka di belakang koma` : `${10 ** -Number(v.digits)} terdekat`}.`,
      'Pembulatan biasa: 5 ke atas naik, di bawah 5 turun.',
    ],
  },
];

export const goalById = (id: string): WizardGoal | undefined => GOALS.find((g) => g.id === id);

export const defaultsOf = (goal: WizardGoal): Record<string, string> => Object.fromEntries(goal.fields.map((f) => [f.key, f.default]));
