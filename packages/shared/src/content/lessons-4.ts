import type { LessonContent, LessonDef } from '../types';

function project(
  slug: string,
  moduleSlug: string,
  sortOrder: number,
  title: string,
  summary: string,
  scenario: string[],
  steps: string[],
  example: LessonContent['example'],
  mistakes: LessonContent['mistakes'],
  quiz: LessonContent['quiz'][number],
  playgroundNote?: string,
): LessonDef {
  return {
    slug,
    moduleSlug,
    title: `Proyek Akhir: ${title}`,
    summary,
    minutes: 20,
    sortOrder,
    content: {
      objectives: [
        'Menggabungkan semua keterampilan modul ini dalam satu tugas yang mirip pekerjaan nyata.',
        'Mengerjakan beberapa sel jawaban sekaligus dengan rumus yang tetap benar saat data berubah.',
      ],
      sections: [
        { heading: 'Skenario', paragraphs: scenario },
        { heading: 'Langkah pengerjaan', paragraphs: steps },
        {
          heading: 'Cara menilai dirimu',
          paragraphs: [
            'Pemeriksa menguji rumusmu pada data yang diubah. Jadi hindari mengetik angka hasil secara langsung, dan gunakan referensi sel. Bila ada sel yang salah, pesan umpan balik menunjukkan sel mana dan memberi petunjuk perbaikan.',
          ],
        },
      ],
      example,
      mistakes,
      playgroundNote,
      quiz: [quiz],
    },
  };
}

/** Delapan proyek akhir, satu per modul. */
export const lessonsPart4: LessonDef[] = [
  project(
    'proyek-struk-belanja',
    'mengenal-excel',
    3,
    'Struk Belanja',
    'Susun struk sederhana: subtotal tiap barang, total, PPN, dan total bayar.',
    [
      'Kamu menyusun struk untuk warung. Tiap barang punya harga dan jumlah. Struk harus menampilkan subtotal per barang, total belanja, PPN, dan total yang harus dibayar.',
    ],
    [
      'Subtotal tiap barang = harga × jumlah (pakai referensi sel).',
      'Total belanja = jumlah semua subtotal.',
      'PPN = total belanja × tarif PPN (tarif ada di sel tersendiri).',
      'Total bayar = total belanja + PPN.',
    ],
    {
      title: 'Subtotal dan total',
      description: 'Dua barang dengan subtotal dan total.',
      table: [
        ['Barang', 'Harga', 'Jumlah', 'Subtotal'],
        ['Beras', 15000, 2, '=B2*C2'],
        ['Gula', 14000, 3, '=B3*C3'],
        ['Total', '', '', '=D2+D3'],
      ],
      formula: '=D2+D3',
      result: '72000',
      walkthrough: 'Subtotal Beras 30000 dan Gula 42000, dijumlahkan menjadi 72000.',
    },
    [
      {
        title: 'Mengetik tarif langsung di rumus',
        detail: 'Tarif PPN ada di sel B7. Merujuk ke sel itu membuat perubahan tarif otomatis terhitung.',
      },
      { title: 'Subtotal memakai baris yang salah', detail: 'Rumus di baris 3 harus memakai B3 dan C3, bukan B2 dan C2.' },
    ],
    {
      question: 'Mengapa tarif PPN disimpan di sel tersendiri?',
      options: ['Agar rumus lebih panjang', 'Agar mudah diubah tanpa mengedit rumus', 'Supaya tidak terlihat', 'Karena Excel mewajibkan'],
      answerIndex: 1,
      explanation: 'Satu sel tarif yang dirujuk membuat semua rumus ikut berubah saat tarif berubah.',
    },
  ),
  project(
    'proyek-merapikan-data-penjualan',
    'mengolah-data',
    4,
    'Merapikan Data Penjualan',
    'Perbaiki angka berbentuk teks dan penulisan kota yang beragam, lalu hitung hasil filter.',
    [
      'Kamu menerima data penjualan dari beberapa cabang yang diketik manual. Ada angka yang tersimpan sebagai teks, serta nama kota yang ditulis dengan huruf dan spasi berbeda-beda.',
    ],
    [
      'Temukan sel angka yang berbentuk teks dan gantilah dengan angka murni.',
      'Seragamkan penulisan kota: huruf pertama kapital, huruf lain kecil, tanpa spasi tambahan.',
      'Gunakan alat Filter (kolom Kota sama dengan "Jakarta") dan baca jumlah baris yang ditemukan. Perhatikan bagaimana data yang belum rapi memengaruhi hasil filter.',
    ],
    {
      title: 'Filter pada data yang belum rapi',
      description: 'Sel "jakarta " dengan spasi di belakang tidak cocok dengan filter "Jakarta".',
      table: [
        ['Sales', 'Kota'],
        ['Sari', 'Jakarta'],
        ['Dewi', 'jakarta '],
        ['Rina', 'JAKARTA'],
      ],
      formula: 'Filter: Kota sama dengan Jakarta',
      result: 'Sebelum dirapikan, baris dengan spasi tambahan tidak ikut tersaring',
      walkthrough:
        'Sebagian pencocokan mengabaikan huruf besar-kecil, tetapi spasi tambahan tetap membuat teks berbeda. Merapikan data dulu membuat hasil analisis dapat dipercaya.',
    },
    [
      { title: 'Percaya hasil filter pada data mentah', detail: 'Spasi tak terlihat membuat baris terlewat. Rapikan dulu, baru saring.' },
      { title: 'Mengubah sel yang bukan masalah', detail: 'Perbaiki hanya sel yang bermasalah; sisanya biarkan.' },
    ],
    {
      question: 'Mengapa jumlah baris hasil filter bisa kurang dari seharusnya?',
      options: ['Filter rusak', 'Ada teks berspasi tambahan yang dianggap berbeda', 'Excel membatasi 3 baris', 'Kolom terkunci'],
      answerIndex: 1,
      explanation: 'Spasi di akhir membuat "jakarta " berbeda dari "jakarta" bagi pencocokan persis.',
    },
    'Alat Filter di playground menyerupai filter Excel; baris yang tidak cocok disembunyikan dan jumlah yang ditemukan ditampilkan.',
  ),
  project(
    'proyek-rekap-gaji',
    'rumus-dasar',
    8,
    'Rekap Gaji Karyawan',
    'Hitung gaji bersih dan ringkasannya dengan SUM, AVERAGE, MAX, MIN, COUNTA, dan ROUND.',
    [
      'Bagian keuangan perlu rekap gaji bulanan. Setiap karyawan punya gaji pokok, tunjangan, dan potongan. Atasan ingin melihat total, rata-rata, gaji tertinggi dan terendah, jumlah karyawan, serta rata-rata dalam ribuan.',
    ],
    [
      'Gaji bersih tiap karyawan = gaji pokok + tunjangan - potongan.',
      'Hitung total, rata-rata, tertinggi, dan terendah gaji bersih dengan fungsi yang sesuai.',
      'Hitung jumlah karyawan dengan COUNTA atas kolom nama.',
      'Bulatkan rata-rata ke ribuan terdekat dengan ROUND.',
    ],
    {
      title: 'Gaji bersih dan rata-rata',
      description: 'Dua karyawan dengan gaji bersih dan rata-ratanya.',
      table: [
        ['Nama', 'Pokok', 'Tunjangan', 'Potongan', 'Bersih'],
        ['Ani', 5000000, 500000, 200000, '=B2+C2-D2'],
        ['Beni', 4500000, 300000, 100000, '=B3+C3-D3'],
        ['Rata-rata', '', '', '', '=AVERAGE(E2:E3)'],
      ],
      formula: '=AVERAGE(E2:E3)',
      result: '5000000',
      walkthrough: 'Gaji bersih Ani 5.300.000 dan Beni 4.700.000. Rata-ratanya (5.300.000 + 4.700.000) / 2 = 5.000.000.',
    },
    [
      { title: 'Menjumlahkan kolom yang salah', detail: 'Total gaji bersih memakai kolom Bersih (E), bukan Pokok (B).' },
      { title: 'Membulatkan terlalu awal', detail: 'Bulatkan hanya hasil akhir rata-rata, bukan tiap gaji bersih.' },
    ],
    {
      question: 'Fungsi yang tepat untuk menghitung jumlah nama karyawan?',
      options: ['COUNT', 'COUNTA', 'SUM', 'MAX'],
      answerIndex: 1,
      explanation: 'Nama berupa teks; COUNT mengabaikan teks, COUNTA menghitung sel terisi.',
    },
  ),
  project(
    'proyek-penilaian-siswa',
    'logika',
    5,
    'Penilaian Siswa',
    'Hitung nilai akhir, status kelulusan, dan kelayakan beasiswa dengan IF, AND, dan ROUND.',
    ['Guru ingin menghitung nilai akhir dari nilai tugas dan UAS, menentukan siapa yang lulus, dan siapa yang berhak mendapat beasiswa.'],
    [
      'Nilai akhir = 40% nilai tugas + 60% nilai UAS, dibulatkan ke bilangan bulat.',
      'Status: "Lulus" bila nilai akhir minimal 70, selain itu "Remedial".',
      'Beasiswa: "Ya" bila nilai akhir minimal 85 DAN nilai UAS minimal 80, selain itu "Tidak".',
    ],
    {
      title: 'Status dari nilai akhir',
      description: 'Nilai akhir 76 lulus.',
      table: [
        ['Siswa', 'Tugas', 'UAS', 'Akhir', 'Status'],
        ['Ani', 80, 74, '=ROUND(B2*0.4+C2*0.6,0)', '=IF(D2>=70,"Lulus","Remedial")'],
      ],
      formula: '=IF(D2>=70,"Lulus","Remedial")',
      result: 'Lulus',
      walkthrough: '80 × 0,4 + 74 × 0,6 = 76,4 dibulatkan 76. Karena 76 ≥ 70, statusnya Lulus.',
    },
    [
      { title: 'Syarat beasiswa hanya satu', detail: 'Beasiswa butuh dua syarat sekaligus, jadi pakai AND.' },
      { title: '> bukan >=', detail: 'Nilai tepat 70 harus lulus; gunakan >=.' },
    ],
    {
      question: 'Beasiswa butuh nilai akhir ≥ 85 dan UAS ≥ 80. Fungsi penghubung syarat yang tepat?',
      options: ['OR', 'AND', 'IFERROR', 'SUM'],
      answerIndex: 1,
      explanation: 'Kedua syarat harus terpenuhi, itulah AND.',
    },
  ),
  project(
    'proyek-laporan-penjualan',
    'fungsi-bersyarat',
    5,
    'Laporan Penjualan',
    'Ringkas data transaksi dengan SUM, SUMIF, COUNTIF, SUMIFS, dan COUNTIF.',
    [
      'Pemilik toko ingin laporan singkat dari daftar transaksi: total penjualan, total per kategori, jumlah transaksi per kota, dan berapa yang belum lunas.',
    ],
    [
      'Hitung total semua penjualan.',
      'Hitung total kategori Makanan dengan SUMIF.',
      'Hitung jumlah transaksi di Jakarta dengan COUNTIF.',
      'Hitung total Makanan di Jakarta yang sudah Lunas dengan SUMIFS (tiga syarat).',
      'Hitung jumlah transaksi berstatus Belum.',
    ],
    {
      title: 'SUMIFS dengan tiga syarat',
      description: 'Total Makanan di Jakarta yang Lunas.',
      table: [
        ['Kategori', 'Kota', 'Penjualan', 'Status'],
        ['Makanan', 'Jakarta', 300000, 'Lunas'],
        ['Makanan', 'Jakarta', 90000, 'Belum'],
      ],
      formula: '=SUMIFS(C2:C3,A2:A3,"Makanan",B2:B3,"Jakarta",D2:D3,"Lunas")',
      result: '300000',
      walkthrough: 'Hanya baris pertama yang memenuhi ketiga syarat, sehingga totalnya 300000.',
    },
    [
      { title: 'Rentang berbeda panjang', detail: 'Semua rentang pada SUMIFS harus sama panjang.' },
      { title: 'Urutan argumen SUMIFS', detail: 'Rentang yang dijumlahkan ditulis lebih dulu.' },
    ],
    {
      question: 'SUMIFS dengan tiga pasangan syarat menjumlahkan baris yang…',
      options: ['Memenuhi salah satu syarat', 'Memenuhi semua syarat', 'Tidak memenuhi syarat', 'Berada paling atas'],
      answerIndex: 1,
      explanation: 'SUMIFS memakai logika DAN: semua syarat harus terpenuhi.',
    },
  ),
  project(
    'proyek-katalog-harga',
    'fungsi-pencarian',
    5,
    'Formulir Pesanan dari Katalog',
    'Ambil nama dan harga dari katalog, hitung total, dan tangani kode yang tidak ada.',
    [
      'Bagian penjualan memiliki katalog harga dan formulir pesanan berisi kode barang dan jumlah. Nama barang, harga, dan total harus terisi otomatis. Kode yang salah ketik tidak boleh menampilkan galat.',
    ],
    [
      'Ambil Nama dan Harga dari katalog menggunakan fungsi pencarian pilihanmu (VLOOKUP, XLOOKUP, atau INDEX-MATCH).',
      'Kunci rentang katalog dengan $ supaya aman disalin.',
      'Bila kode tidak ditemukan, tampilkan "Tidak ditemukan" untuk nama dan 0 untuk harga.',
      'Total tiap baris = harga × jumlah; total pesanan = jumlah semua total baris.',
    ],
    {
      title: 'Pencarian aman dari galat',
      description: 'Kode yang tidak ada ditangani dengan IFERROR.',
      table: [
        ['Kode', 'Harga', '', 'Kode', 'Harga'],
        ['GLA', '=IFERROR(VLOOKUP(A2,$D$2:$E$3,2,FALSE),0)', '', 'BRS', 68000],
        ['XXX', '=IFERROR(VLOOKUP(A3,$D$2:$E$3,2,FALSE),0)', '', 'GLA', 16000],
      ],
      formula: '=IFERROR(VLOOKUP(A3,$D$2:$E$3,2,FALSE),0)',
      result: '0',
      walkthrough: 'XXX tidak ada di katalog sehingga VLOOKUP menghasilkan #N/A, dan IFERROR menggantinya dengan 0.',
    },
    [
      { title: 'Katalog tidak dikunci', detail: 'Tanpa $, rentang katalog bergeser di baris berikutnya.' },
      { title: 'Lupa menangani kode salah', detail: '#N/A menjalar ke total dan merusak seluruh pesanan.' },
    ],
    {
      question: 'Agar kode yang tidak ada menghasilkan 0 alih-alih #N/A, bungkus pencarian dengan…',
      options: ['IFERROR', 'ROUND', 'TRIM', 'COUNT'],
      answerIndex: 0,
      explanation: 'IFERROR (atau IFNA) menggantikan galat dengan nilai yang kamu tentukan.',
    },
  ),
  project(
    'proyek-data-pelanggan',
    'teks-tanggal',
    7,
    'Merapikan Data Pelanggan',
    'Rapikan nama, seragamkan kode, dan ambil tahun pendaftaran dari tanggal.',
    [
      'Data pelanggan dari berbagai sumber berantakan: nama berspasi ganda dan huruf acak, kode memakai huruf campuran dan spasi, dan tanggal daftar berupa tanggal biasa.',
    ],
    [
      'Nama rapi: huruf awal kapital tiap kata dan spasi dirapikan.',
      'Kode: buang spasi dan jadikan huruf besar semua.',
      'Tahun daftar: ambil tahun dari tanggal pendaftaran.',
    ],
    {
      title: 'Merapikan kode',
      description: 'Kode dari formulir bercampur huruf dan spasi.',
      table: [
        ['Kode mentah', 'Kode rapi'],
        [' cst-0012 ', '=UPPER(TRIM(A2))'],
      ],
      formula: '=UPPER(TRIM(A2))',
      result: 'CST-0012',
      walkthrough: 'TRIM membuang spasi di awal dan akhir, UPPER mengubah semua huruf menjadi besar.',
    },
    [
      { title: 'Urutan fungsi', detail: 'Rapikan spasi dulu dengan TRIM baru ubah huruf, atau hasil bisa tetap berspasi.' },
      { title: 'Mengambil tahun dari teks', detail: 'YEAR butuh tanggal sungguhan, bukan teks. Pastikan kolom tanggal berisi tanggal.' },
    ],
    {
      question: 'Resep merapikan nama berspasi ganda dan huruf acak?',
      options: ['=UPPER(A2)', '=PROPER(TRIM(A2))', '=LEN(A2)', '=LEFT(A2;1)'],
      answerIndex: 1,
      explanation: 'TRIM merapikan spasi dan PROPER mengatur huruf kapital di awal kata.',
    },
  ),
  project(
    'proyek-dashboard-ringkas',
    'rapi-dan-aman',
    7,
    'Dashboard Stok Ringkas',
    'Tandai barang yang perlu restok dan ringkas penjualan per kategori.',
    [
      'Pemilik toko ingin satu lembar yang menandai barang yang stoknya kurang dari batas minimum dan meringkas jumlah terjual per kategori.',
    ],
    [
      'Kolom "Perlu restok?" berisi TRUE bila stok kurang dari minimum (aturan yang sama dipakai sebagai Conditional Formatting).',
      'Ringkas jumlah terjual per kategori dengan SUMIF, dengan rentang dikunci dan nama kategori dirujuk dari sel.',
      'Hitung berapa barang yang perlu restok.',
    ],
    {
      title: 'Aturan restok',
      description: 'TRUE berarti barang perlu restok.',
      table: [
        ['Barang', 'Stok', 'Minimum', 'Restok?'],
        ['Beras', 8, 10, '=B2<C2'],
      ],
      formula: '=B2<C2',
      result: 'TRUE',
      walkthrough: 'Stok 8 kurang dari minimum 10, jadi hasilnya TRUE.',
    },
    [
      { title: 'Rentang ringkasan tidak dikunci', detail: 'SUMIF yang disalin ke baris lain perlu rentang dengan $.' },
      { title: 'Hardcode nama kategori', detail: 'Rujuk sel judul kategori agar rumus mudah disalin.' },
    ],
    {
      question: 'Aturan "stok kurang dari minimum" ditulis…',
      options: ['=B2>C2', '=B2<C2', '=B2=C2', '=B2+C2'],
      answerIndex: 1,
      explanation: 'Kurang dari ditulis dengan operator <.',
    },
    'Playground tidak mewarnai sel; kamu menulis rumus aturan yang sama persis dengan yang dipakai Conditional Formatting.',
  ),
];
