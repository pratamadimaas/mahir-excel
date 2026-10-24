import type { LessonDef } from '../types';

/** Pelajaran tambahan untuk rumus yang ditambahkan ke mesin: statistik, pembulatan, logika bertingkat, teks, tanggal, dan HLOOKUP. */
export const lessonsPart5: LessonDef[] = [
  {
    slug: 'median-large-small-rank',
    moduleSlug: 'rumus-dasar',
    title: 'MEDIAN, LARGE, SMALL, dan RANK',
    summary: 'Cari nilai tengah, nilai terbesar ke-n, dan peringkat tanpa mengurutkan data.',
    minutes: 10,
    sortOrder: 6,
    content: {
      objectives: [
        'Membedakan rata-rata dan median.',
        'Mengambil nilai terbesar atau terkecil ke-n dengan LARGE dan SMALL.',
        'Menentukan peringkat dengan RANK.',
      ],
      sections: [
        {
          heading: 'Median: nilai tengah',
          paragraphs: [
            'MEDIAN mengurutkan angka di belakang layar lalu mengambil yang di tengah. Kalau jumlah angkanya genap, hasilnya rata-rata dua angka yang di tengah.',
            'Rata-rata gampang terseret satu angka yang sangat besar. Gaji lima orang 4 juta, 4 juta, 5 juta, 5 juta, dan 40 juta punya rata-rata 11,6 juta, padahal mediannya 5 juta. Median lebih menggambarkan kebanyakan orang.',
          ],
        },
        {
          heading: 'LARGE dan SMALL',
          paragraphs: [
            'MAX dan MIN hanya memberi nilai paling ujung. LARGE(rentang; 2) memberi yang terbesar kedua, dan SMALL(rentang; 3) yang terkecil ketiga.',
            'Cocok untuk "tiga penjualan teratas" tanpa harus mengurutkan tabelnya.',
          ],
        },
        {
          heading: 'RANK: peringkat',
          paragraphs: [
            'RANK(angka; rentang) menjawab angka itu peringkat berapa. Urutan bawaannya dari yang terbesar, jadi angka terbesar mendapat peringkat 1. Isi argumen ketiga dengan 1 bila peringkat 1 harus yang terkecil.',
            'Dua angka yang sama mendapat peringkat yang sama, dan peringkat berikutnya melompat. Kunci rentang dengan $ saat rumus disalin ke bawah: RANK(B2; $B$2:$B$6).',
          ],
        },
      ],
      syntax: {
        signature: '=RANK(angka; rentang; [urutan])',
        params: [
          { name: 'angka', description: 'Angka yang dicari peringkatnya.' },
          { name: 'rentang', description: 'Kumpulan angka pembanding.' },
          { name: 'urutan', description: '0 atau dikosongkan: terbesar jadi peringkat 1. 1: terkecil jadi peringkat 1.' },
        ],
        notes: ['MEDIAN(angka1; ...) mengambil nilai tengah.', 'LARGE(rentang; n) dan SMALL(rentang; n) mengambil nilai terbesar atau terkecil ke-n.'],
      },
      example: {
        title: 'Peringkat penjualan',
        description: 'Lima sales diberi peringkat dari penjualan terbesar.',
        table: [
          ['Sales', 'Penjualan', 'Peringkat'],
          ['Budi', 7500000, '=RANK(B2;$B$2:$B$6)'],
          ['Sari', 9200000, '=RANK(B3;$B$2:$B$6)'],
          ['Dewi', 5100000, '=RANK(B4;$B$2:$B$6)'],
          ['Andi', 6400000, '=RANK(B5;$B$2:$B$6)'],
          ['Rina', 8100000, '=RANK(B6;$B$2:$B$6)'],
        ],
        formula: '=RANK(B2;$B$2:$B$6)',
        result: '3',
        walkthrough: 'Hanya Sari (9,2 juta) dan Rina (8,1 juta) yang lebih besar dari Budi (7,5 juta), jadi Budi peringkat 3.',
      },
      mistakes: [
        { title: 'Lupa mengunci rentang', detail: 'Tanpa $, rentang ikut bergeser saat rumus disalin ke bawah sehingga peringkatnya salah atau muncul #N/A.' },
        { title: 'Mengira peringkat tidak bisa sama', detail: 'Angka kembar mendapat peringkat yang sama. Dua orang di peringkat 2 berarti tidak ada peringkat 3.' },
      ],
      quiz: [
        {
          question: 'Apa median dari 2, 4, 6, dan 100?',
          options: ['4', '5', '28', '6'],
          answerIndex: 1,
          explanation: 'Angkanya sudah urut. Dua angka di tengah adalah 4 dan 6, rata-ratanya 5.',
        },
        {
          question: 'Apa yang dilakukan =LARGE(A1:A10; 2)?',
          options: ['Mengambil nilai terbesar kedua', 'Menjumlahkan dua nilai terbesar', 'Mengambil nilai terkecil kedua', 'Mengambil baris kedua dari rentang'],
          answerIndex: 0,
          explanation: 'LARGE(rentang; n) mengambil nilai terbesar ke-n. Dengan n = 2, hasilnya nilai terbesar kedua.',
        },
      ],
    },
  },
  {
    slug: 'roundup-rounddown',
    moduleSlug: 'rumus-dasar',
    title: 'ROUNDUP dan ROUNDDOWN: Membulatkan Satu Arah',
    summary: 'Bulatkan selalu ke atas atau selalu ke bawah, misalnya untuk jumlah kardus atau ongkos kirim.',
    minutes: 8,
    sortOrder: 7,
    content: {
      objectives: [
        'Membedakan ROUND, ROUNDUP, dan ROUNDDOWN.',
        'Membulatkan ke ratusan atau ribuan dengan digit negatif.',
        'Memilih arah pembulatan sesuai kebutuhan.',
      ],
      sections: [
        {
          heading: 'Tiga cara membulatkan',
          paragraphs: [
            'ROUND membulatkan ke angka terdekat. ROUNDUP selalu menjauhi nol, jadi angka positif selalu naik. ROUNDDOWN selalu mendekati nol, jadi angka positif selalu turun.',
            'Dengan 0 digit, angka 12,1 menjadi 13 lewat ROUNDUP, 12 lewat ROUNDDOWN, dan 12 lewat ROUND.',
          ],
        },
        {
          heading: 'Kapan dipakai',
          paragraphs: [
            'Ada 25 barang dan satu kardus muat 6. 25 dibagi 6 sama dengan 4,17, tetapi kamu tidak bisa membeli 0,17 kardus. ROUNDUP(25/6; 0) memberi 5.',
            'Digit negatif membulatkan ke kiri titik desimal. ROUNDUP(12345; -3) menjadi 13000 dan ROUNDDOWN(12345; -3) menjadi 12000.',
          ],
        },
      ],
      syntax: {
        signature: '=ROUNDUP(angka; jumlah_digit)',
        params: [
          { name: 'angka', description: 'Angka yang dibulatkan.' },
          { name: 'jumlah_digit', description: 'Jumlah angka di belakang koma. Negatif membulatkan ke puluhan, ratusan, atau ribuan.' },
        ],
        notes: ['ROUNDDOWN memakai argumen yang sama dan selalu membulatkan ke bawah.'],
      },
      example: {
        title: 'Kardus untuk pesanan',
        description: 'Berapa kardus yang dibutuhkan bila tiap kardus muat 6 barang.',
        table: [
          ['Pesanan', 'Muat per kardus', 'Kardus dibutuhkan'],
          [25, 6, '=ROUNDUP(A2/B2;0)'],
          [30, 6, '=ROUNDUP(A3/B3;0)'],
        ],
        formula: '=ROUNDUP(A2/B2;0)',
        result: '5',
        walkthrough: '25/6 = 4,17. ROUNDUP selalu naik, sehingga hasilnya 5 kardus.',
      },
      mistakes: [
        { title: 'Memakai ROUND untuk kebutuhan fisik', detail: 'ROUND(25/6; 0) menjadi 4 sehingga kurang satu kardus. Pakai ROUNDUP untuk kebutuhan yang tidak bisa dipecah.' },
        { title: 'Salah membaca digit negatif', detail: 'Digit negatif membulatkan ke kiri: -3 ke ribuan, -2 ke ratusan, -1 ke puluhan.' },
      ],
      quiz: [
        {
          question: 'Apa hasil =ROUNDDOWN(7.99; 0)?',
          options: ['8', '7', '7.9', '0'],
          answerIndex: 1,
          explanation: 'ROUNDDOWN selalu turun, jadi 7.99 menjadi 7.',
        },
        {
          question: 'Apa hasil =ROUNDUP(12345; -3)?',
          options: ['12000', '12300', '13000', '12345'],
          answerIndex: 2,
          explanation: 'Digit -3 membulatkan ke ribuan, dan ROUNDUP selalu naik: 13000.',
        },
      ],
    },
  },
  {
    slug: 'averageif-sumproduct',
    moduleSlug: 'fungsi-bersyarat',
    title: 'AVERAGEIF dan SUMPRODUCT',
    summary: 'Rata-rata dengan syarat, dan menjumlahkan hasil kali dua kolom sekaligus.',
    minutes: 10,
    sortOrder: 3,
    content: {
      objectives: [
        'Menghitung rata-rata bersyarat dengan AVERAGEIF.',
        'Menjumlahkan hasil kali dua kolom dengan SUMPRODUCT.',
        'Tahu batas SUMPRODUCT di playground.',
      ],
      sections: [
        {
          heading: 'AVERAGEIF',
          paragraphs: [
            'AVERAGEIF bekerja seperti SUMIF, tetapi hasilnya rata-rata. Urutan argumennya sama: rentang syarat, syarat, lalu rentang yang dirata-ratakan.',
            'Kalau tidak ada baris yang cocok, hasilnya #DIV/0!. Bungkus dengan IFERROR bila itu mungkin terjadi.',
          ],
        },
        {
          heading: 'SUMPRODUCT',
          paragraphs: [
            'Total pendapatan dari kolom harga dan kolom jumlah biasanya butuh kolom bantu (harga x jumlah) lalu SUM. SUMPRODUCT melakukannya sekaligus: mengalikan pasangan sel dari rentang-rentangnya, lalu menjumlahkan semua hasilnya.',
            'Rentangnya harus sama besar. Sel teks atau kosong dihitung nol.',
          ],
        },
      ],
      syntax: {
        signature: '=SUMPRODUCT(rentang1; rentang2; ...)',
        params: [
          { name: 'rentang1', description: 'Rentang pertama.' },
          { name: 'rentang2', description: 'Rentang kedua, harus sama ukurannya dengan yang pertama.' },
        ],
        notes: ['AVERAGEIF(rentang_syarat; syarat; [rentang_rata_rata]) menghitung rata-rata baris yang memenuhi syarat.'],
      },
      example: {
        title: 'Pendapatan dari harga dan jumlah',
        description: 'Total pendapatan empat produk tanpa kolom bantu.',
        table: [
          ['Produk', 'Kategori', 'Harga', 'Jumlah'],
          ['Kopi', 'Minuman', 18000, 3],
          ['Teh', 'Minuman', 8000, 5],
          ['Roti', 'Makanan', 15000, 2],
          ['Nasi', 'Makanan', 25000, 4],
        ],
        formula: '=SUMPRODUCT(C2:C5;D2:D5)',
        result: '224000',
        walkthrough: '18000x3 + 8000x5 + 15000x2 + 25000x4 = 54000 + 40000 + 30000 + 100000 = 224000.',
      },
      mistakes: [
        { title: 'Rentang berbeda ukuran', detail: 'SUMPRODUCT(C2:C5; D2:D4) memberi #VALUE! karena jumlah barisnya berbeda.' },
        { title: 'Mengira bentuk bersyarat Excel asli berjalan di sini', detail: 'Di Excel asli SUMPRODUCT sering dipakai dengan syarat, seperti (A2:A9="x")*B2:B9. Playground belum mendukung bentuk itu. Pakai SUMIFS untuk syarat.' },
      ],
      playgroundNote: 'Playground mendukung SUMPRODUCT dengan rentang yang dipisah koma atau titik koma, bukan bentuk perkalian rentang dengan syarat di dalam argumen.',
      quiz: [
        {
          question: 'Apa hasil AVERAGEIF bila tidak ada baris yang cocok dengan syarat?',
          options: ['0', '#DIV/0!', '#N/A', 'Sel kosong'],
          answerIndex: 1,
          explanation: 'Tidak ada angka untuk dirata-ratakan, sehingga terjadi pembagian dengan nol: #DIV/0!.',
        },
        {
          question: 'Apa yang dihitung =SUMPRODUCT(B2:B4; C2:C4)?',
          options: ['Jumlah B ditambah jumlah C', 'Jumlah hasil kali B dan C baris demi baris', 'Rata-rata B dikali C', 'Total B dikali total C'],
          answerIndex: 1,
          explanation: 'Tiap baris dikalikan dulu (B2xC2, B3xC3, B4xC4), baru hasilnya dijumlahkan.',
        },
      ],
    },
  },
  {
    slug: 'ifs-switch',
    moduleSlug: 'logika',
    title: 'IFS dan SWITCH',
    summary: 'Ganti IF bertingkat yang panjang dengan daftar syarat yang rapi.',
    minutes: 9,
    sortOrder: 4,
    content: {
      objectives: [
        'Menulis IFS untuk banyak syarat berurutan.',
        'Memakai SWITCH untuk mencocokkan nilai tertentu.',
        'Menambahkan hasil "selain itu" di akhir.',
      ],
      sections: [
        {
          heading: 'IFS',
          paragraphs: [
            'IF bertingkat yang panjang cepat sulit dibaca. IFS menulis pasangan syarat dan hasil secara berurutan: IFS(syarat1; hasil1; syarat2; hasil2; ...). Excel memeriksa dari kiri dan berhenti di syarat pertama yang benar, jadi urutkan dari yang paling ketat.',
            'Bila tidak ada syarat yang benar, hasilnya #N/A. Untuk memberi hasil "selain itu", tulis pasangan terakhir dengan syarat TRUE.',
          ],
        },
        {
          heading: 'SWITCH',
          paragraphs: [
            'SWITCH cocok bila yang dicek adalah satu nilai yang dibandingkan dengan daftar kemungkinan: SWITCH(nilai; cocok1; hasil1; cocok2; hasil2; selain_itu). Argumen terakhir yang tidak berpasangan menjadi nilai bawaan.',
            'Contoh: kode wilayah J, B, dan S menjadi Jakarta, Bandung, dan Surabaya, dan kode lain menjadi "Tidak dikenal".',
          ],
        },
        {
          heading: 'Ketersediaan',
          paragraphs: ['IFS dan SWITCH ada di Excel 2019 dan Microsoft 365. Di Excel 2016 ke bawah, pakai IF bertingkat.'],
        },
      ],
      syntax: {
        signature: '=IFS(syarat1; hasil1; [syarat2; hasil2]; ...)',
        params: [
          { name: 'syarat', description: 'Pemeriksaan yang hasilnya benar atau salah.' },
          { name: 'hasil', description: 'Nilai yang dipakai bila syarat di sebelah kirinya benar.' },
        ],
        notes: ['SWITCH(nilai; cocok1; hasil1; [cocok2; hasil2]; ...; [selain_itu]) mencocokkan satu nilai dengan daftar.'],
      },
      example: {
        title: 'Nilai menjadi grade',
        description: 'Grade A untuk 90 ke atas, B untuk 80 ke atas, C untuk 70 ke atas, selain itu D.',
        table: [
          ['Siswa', 'Nilai', 'Grade'],
          ['Ani', 92, '=IFS(B2>=90;"A";B2>=80;"B";B2>=70;"C";TRUE;"D")'],
          ['Budi', 78, '=IFS(B3>=90;"A";B3>=80;"B";B3>=70;"C";TRUE;"D")'],
          ['Cici', 65, '=IFS(B4>=90;"A";B4>=80;"B";B4>=70;"C";TRUE;"D")'],
        ],
        formula: '=IFS(B3>=90;"A";B3>=80;"B";B3>=70;"C";TRUE;"D")',
        result: 'C',
        walkthrough: '78 tidak memenuhi 90 dan 80, tetapi memenuhi 70, sehingga hasilnya C.',
      },
      mistakes: [
        { title: 'Urutan syarat terbalik', detail: 'Kalau B2>=70 ditulis lebih dulu, nilai 92 ikut menjadi C karena syarat pertama yang benar yang dipakai.' },
        { title: 'Lupa hasil "selain itu"', detail: 'Nilai yang tidak memenuhi syarat apa pun menghasilkan #N/A. Tutup dengan pasangan TRUE.' },
      ],
      quiz: [
        {
          question: 'Apa hasil =IFS(5>10; "a"; 5>3; "b")?',
          options: ['a', 'b', '#N/A', 'TRUE'],
          answerIndex: 1,
          explanation: '5>10 salah, 5>3 benar, jadi hasilnya b.',
        },
        {
          question: 'Untuk apa pasangan terakhir TRUE; "D" di IFS?',
          options: ['Memeriksa data', 'Hasil bawaan bila tidak ada syarat lain yang benar', 'Menghentikan rumus', 'Tidak berguna'],
          answerIndex: 1,
          explanation: 'TRUE selalu benar, jadi pasangan itu dipakai bila semua syarat sebelumnya salah.',
        },
      ],
    },
  },
  {
    slug: 'hlookup',
    moduleSlug: 'fungsi-pencarian',
    title: 'HLOOKUP: Mencari ke Samping',
    summary: 'VLOOKUP untuk tabel yang judulnya tersusun mendatar.',
    minutes: 8,
    sortOrder: 4,
    content: {
      objectives: [
        'Mengenali tabel yang tersusun mendatar.',
        'Menulis HLOOKUP dengan nomor baris.',
        'Tahu kapan XLOOKUP atau INDEX dan MATCH lebih cocok.',
      ],
      sections: [
        {
          heading: 'Tabel mendatar',
          paragraphs: [
            'Kadang data tersusun ke samping: judul di baris pertama dan tiap kolom adalah satu hal, misalnya hari atau bulan. VLOOKUP mencari ke bawah di kolom pertama, sedangkan HLOOKUP mencari ke samping di baris pertama.',
            'HLOOKUP(kunci; tabel; nomor_baris; FALSE) mencari kunci di baris paling atas tabel, lalu mengambil hasilnya dari baris ke-nomor_baris pada kolom yang sama. FALSE berarti harus cocok persis, dan hampir selalu itu yang kamu mau.',
          ],
        },
        {
          heading: 'Pilihan lain',
          paragraphs: ['XLOOKUP dan INDEX-MATCH bisa mencari ke arah mana pun dan tidak memakai nomor baris yang bisa salah hitung. HLOOKUP tetap berguna karena banyak berkas lama masih memakainya.'],
        },
      ],
      syntax: {
        signature: '=HLOOKUP(kunci; tabel; nomor_baris; [FALSE])',
        params: [
          { name: 'kunci', description: 'Nilai yang dicari di baris pertama tabel.' },
          { name: 'tabel', description: 'Rentang tabel, baris pertama berisi kunci.' },
          { name: 'nomor_baris', description: 'Baris ke berapa (dihitung dari baris pertama tabel) yang hasilnya diambil.' },
          { name: 'FALSE', description: 'Cocok persis. Tanpa ini Excel mencari perkiraan.' },
        ],
      },
      example: {
        title: 'Realisasi per hari',
        description: 'Mengambil realisasi hari Selasa dari tabel mendatar.',
        table: [
          ['Hari', 'Senin', 'Selasa', 'Rabu'],
          ['Target', 100, 200, 300],
          ['Realisasi', 90, 210, 280],
        ],
        formula: '=HLOOKUP("Selasa";A1:D3;3;FALSE)',
        result: '210',
        walkthrough: 'Selasa ada di kolom C. Baris ke-3 tabel adalah Realisasi, jadi hasilnya 210.',
      },
      mistakes: [
        { title: 'Menghitung nomor baris dari nomor di sheet', detail: 'Nomor baris dihitung dari baris pertama tabel yang kamu pilih, bukan dari nomor baris di sheet.' },
        { title: 'Lupa FALSE', detail: 'Tanpa FALSE, Excel mencari perkiraan dan butuh baris pertama yang terurut naik. Hasilnya bisa salah tanpa tanda galat.' },
      ],
      quiz: [
        {
          question: 'Apa bedanya HLOOKUP dan VLOOKUP?',
          options: ['HLOOKUP mencari di baris pertama, VLOOKUP di kolom pertama', 'Sama saja', 'HLOOKUP hanya untuk angka', 'VLOOKUP hanya untuk teks'],
          answerIndex: 0,
          explanation: 'HLOOKUP mencari mendatar di baris pertama. VLOOKUP mencari ke bawah di kolom pertama.',
        },
        {
          question: 'Dalam =HLOOKUP("Rabu"; A1:D3; 3; FALSE), angka 3 berarti?',
          options: ['Kolom ketiga', 'Baris ketiga dari tabel', 'Rabu yang ketiga', 'Tiga hasil'],
          answerIndex: 1,
          explanation: 'Argumen ketiga adalah nomor baris tabel tempat hasil diambil.',
        },
      ],
    },
  },
  {
    slug: 'substitute-find',
    moduleSlug: 'teks-tanggal',
    title: 'SUBSTITUTE dan FIND: Mengganti dan Mencari Teks',
    summary: 'Ganti sebagian teks, cari posisinya, lalu potong bagian yang kamu butuhkan.',
    minutes: 9,
    sortOrder: 3,
    content: {
      objectives: [
        'Mengganti atau membuang bagian teks dengan SUBSTITUTE.',
        'Mencari posisi karakter dengan FIND.',
        'Memadukan FIND dengan LEFT, RIGHT, atau MID.',
      ],
      sections: [
        {
          heading: 'SUBSTITUTE',
          paragraphs: [
            'SUBSTITUTE(teks; lama; baru) mengganti semua kemunculan teks lama dengan yang baru. Cocok untuk membuang atau menukar tanda, misalnya mengubah "0812-3456-7890" menjadi "081234567890" dengan SUBSTITUTE(A2; "-"; "").',
            'Isi argumen keempat untuk mengganti hanya kemunculan ke-n. SUBSTITUTE membedakan huruf besar dan kecil.',
          ],
        },
        {
          heading: 'FIND',
          paragraphs: [
            'FIND(yang_dicari; teks) memberi posisi pertama tempat teks itu muncul. FIND membedakan huruf besar dan kecil, dan memberi #VALUE! bila tidak ketemu.',
            'FIND sering dipasangkan dengan LEFT, RIGHT, atau MID untuk memotong teks. Untuk mengambil bagian sebelum tanda hubung: LEFT(A2; FIND("-"; A2)-1).',
          ],
        },
      ],
      syntax: {
        signature: '=SUBSTITUTE(teks; teks_lama; teks_baru; [urutan])',
        params: [
          { name: 'teks', description: 'Teks atau sel yang diubah.' },
          { name: 'teks_lama', description: 'Bagian yang diganti.' },
          { name: 'teks_baru', description: 'Pengganti. Tulis "" untuk membuangnya.' },
          { name: 'urutan', description: 'Opsional: ganti hanya kemunculan ke-n.' },
        ],
        notes: ['FIND(yang_dicari; teks; [mulai_dari]) memberi posisi karakter, dihitung dari 1.'],
      },
      example: {
        title: 'Mengambil awalan kode',
        description: 'Awalan kode produk adalah bagian sebelum tanda hubung.',
        table: [
          ['Kode', 'Awalan'],
          ['BRS-001', '=LEFT(A2;FIND("-";A2)-1)'],
          ['GULA-014', '=LEFT(A3;FIND("-";A3)-1)'],
        ],
        formula: '=LEFT(A2;FIND("-";A2)-1)',
        result: 'BRS',
        walkthrough: 'FIND memberi 4 (posisi tanda hubung). Dikurangi 1 menjadi 3, jadi LEFT mengambil tiga karakter pertama: BRS.',
      },
      mistakes: [
        { title: 'Lupa -1 pada LEFT', detail: 'FIND memberi posisi tanda itu sendiri, jadi tanpa -1 tandanya ikut terambil.' },
        { title: 'Teks tidak ketemu karena beda huruf', detail: 'FIND("brs"; "BRS-001") memberi #VALUE! karena huruf kecil dan besar dianggap berbeda. Bungkus dengan IFERROR bila datanya tidak seragam.' },
      ],
      quiz: [
        {
          question: 'Apa hasil =SUBSTITUTE("a-b-c"; "-"; "")?',
          options: ['abc', 'a-b-c', 'a b c', '-'],
          answerIndex: 0,
          explanation: 'Semua tanda hubung diganti dengan teks kosong, sehingga yang tersisa abc.',
        },
        {
          question: 'Apa hasil =FIND("-"; "AB-12")?',
          options: ['2', '3', '4', '#VALUE!'],
          answerIndex: 1,
          explanation: 'Tanda hubung adalah karakter ketiga: A, B, lalu -.',
        },
      ],
    },
  },
  {
    slug: 'concat-textjoin-text',
    moduleSlug: 'teks-tanggal',
    title: 'CONCAT, TEXTJOIN, dan TEXT',
    summary: 'Gabungkan teks dari banyak sel dan tampilkan angka atau tanggal dengan format yang kamu mau.',
    minutes: 10,
    sortOrder: 4,
    content: {
      objectives: [
        'Menggabungkan banyak sel dengan CONCAT dan TEXTJOIN.',
        'Melewati sel kosong dengan TEXTJOIN.',
        'Menampilkan angka dan tanggal berformat dengan TEXT.',
      ],
      sections: [
        {
          heading: 'CONCAT dan TEXTJOIN',
          paragraphs: [
            'Tanda & menyambung dua teks. Untuk banyak sel, CONCAT menyambung seluruh isi sebuah rentang tanpa pemisah. TEXTJOIN menyambung dengan pemisah dan bisa melewati sel kosong: TEXTJOIN(", "; TRUE; A2:A6).',
            'Argumen kedua TEXTJOIN: TRUE melewati sel kosong, FALSE memasukkannya sehingga pemisah tampil ganda. CONCAT dan TEXTJOIN ada di Excel 2019 dan Microsoft 365. Di versi lama, pakai tanda &.',
          ],
        },
        {
          heading: 'TEXT: angka dan tanggal jadi teks berformat',
          paragraphs: [
            'Menyambung angka langsung ke teks sering tampil mentah: "Total: "&1500000 menjadi "Total: 1500000". TEXT mengatur tampilannya: "Total: "&TEXT(1500000; "#,##0") menjadi "Total: 1.500.000" di playground ini.',
            'Untuk tanggal, TEXT(A2; "dd mmmm yyyy") menjadi "5 Maret 2025". Nama bulan dan hari di playground berbahasa Indonesia.',
            'Format yang didukung di playground: 0, 0.00, #,##0, #,##0.00, 0%, 0.0%, serta kode tanggal dan jam seperti dd/mm/yyyy, dd mmmm yyyy, dddd, dan hh:mm.',
          ],
        },
      ],
      syntax: {
        signature: '=TEXT(nilai; format)',
        params: [
          { name: 'nilai', description: 'Angka atau tanggal yang ditampilkan.' },
          { name: 'format', description: 'Kode format dalam tanda kutip, misalnya "#,##0" atau "dd/mm/yyyy".' },
        ],
        notes: ['TEXTJOIN(pemisah; lewati_kosong; teks1; ...) menyambung teks dengan pemisah.'],
      },
      example: {
        title: 'Pesan tagihan',
        description: 'Kalimat tagihan dengan nominal yang rapi.',
        table: [
          ['Pelanggan', 'Tagihan', 'Pesan'],
          ['Bu Ani', 1500000, '="Halo "&A2&", tagihanmu Rp "&TEXT(B2;"#,##0")&"."'],
        ],
        formula: '="Halo "&A2&", tagihanmu Rp "&TEXT(B2;"#,##0")&"."',
        result: 'Halo Bu Ani, tagihanmu Rp 1.500.000.',
        walkthrough: 'TEXT mengubah 1500000 menjadi "1.500.000", lalu semua bagian disambung dengan &.',
      },
      mistakes: [
        { title: 'Menganggap hasil TEXT masih angka', detail: 'TEXT menghasilkan teks, jadi tidak bisa dijumlahkan lagi. Simpan angka aslinya di sel lain.' },
        { title: 'Kode format berbeda di komputer lain', detail: 'Excel dengan pengaturan regional berbeda membaca kode format dan pemisah secara berbeda. Uji dulu di komputer tempat berkasnya akan dipakai.' },
      ],
      playgroundNote: 'Playground memakai kode format berbahasa Inggris dan menampilkan pemisah ribuan titik serta desimal koma. Di Excel asli, hasil dan kode formatnya mengikuti pengaturan bahasa dan regional komputer.',
      quiz: [
        {
          question: 'Apa hasil =TEXTJOIN("-"; TRUE; "a"; ""; "b")?',
          options: ['a-b', 'a--b', 'ab', 'a-'],
          answerIndex: 0,
          explanation: 'TRUE melewati teks kosong, jadi hanya a dan b yang disambung dengan tanda hubung.',
        },
        {
          question: 'Mengapa memakai TEXT saat menyambung angka ke teks?',
          options: ['Agar angka tampil dengan format yang diinginkan', 'Agar angka dihitung ulang', 'Agar teks menjadi angka', 'Agar sel dikunci'],
          answerIndex: 0,
          explanation: 'TEXT mengatur tampilan angka atau tanggal sebelum disambung ke teks.',
        },
      ],
    },
  },
  {
    slug: 'tanggal-lanjutan',
    moduleSlug: 'teks-tanggal',
    title: 'DATEDIF, EOMONTH, NETWORKDAYS, dan NOW',
    summary: 'Hitung umur atau masa kerja, cari akhir bulan, dan hitung hari kerja.',
    minutes: 11,
    sortOrder: 5,
    content: {
      objectives: [
        'Menghitung selisih tahun dan bulan penuh dengan DATEDIF.',
        'Mencari tanggal terakhir bulan dengan EOMONTH.',
        'Menghitung hari kerja dengan NETWORKDAYS.',
      ],
      sections: [
        {
          heading: 'Selisih tanggal',
          paragraphs: [
            'Mengurangkan dua tanggal memberi jumlah hari. Untuk selisih dalam tahun atau bulan penuh, pakai DATEDIF(awal; akhir; satuan). Satuan "Y" untuk tahun penuh, "M" untuk bulan penuh, "YM" untuk sisa bulan setelah tahun penuh, dan "D" untuk hari.',
            'Masa kerja 4 tahun 11 bulan dihitung dengan DATEDIF(masuk; sekarang; "Y") dan DATEDIF(masuk; sekarang; "YM"). Tanggal awal tidak boleh lebih besar dari tanggal akhir, kalau tidak hasilnya #NUM!.',
            'DATEDIF ada di Excel tetapi tidak muncul di daftar saran saat kamu mengetik. Itu normal, tulis saja manual.',
          ],
        },
        {
          heading: 'Akhir bulan dan hari kerja',
          paragraphs: [
            'EOMONTH(tanggal; n) memberi tanggal terakhir bulan, n bulan dari tanggal itu. n = 0 untuk akhir bulan yang sama dan n = 1 untuk bulan berikutnya. Cocok untuk jatuh tempo "akhir bulan depan".',
            'NETWORKDAYS(awal; akhir; [libur]) menghitung hari kerja Senin sampai Jumat, termasuk hari awal dan akhir. Beri rentang tanggal libur sebagai argumen ketiga.',
            'NOW() memberi tanggal dan jam saat ini, sedangkan TODAY() hanya tanggalnya. Keduanya berubah setiap berkas dihitung ulang.',
          ],
        },
      ],
      syntax: {
        signature: '=DATEDIF(tanggal_awal; tanggal_akhir; satuan)',
        params: [
          { name: 'tanggal_awal', description: 'Tanggal yang lebih awal.' },
          { name: 'tanggal_akhir', description: 'Tanggal yang lebih akhir.' },
          { name: 'satuan', description: '"Y" tahun penuh, "M" bulan penuh, "YM" sisa bulan, "D" hari.' },
        ],
        notes: ['EOMONTH(tanggal; n) memberi akhir bulan.', 'NETWORKDAYS(awal; akhir; [libur]) menghitung hari kerja.'],
      },
      example: {
        title: 'Masa kerja',
        description: 'Berapa tahun penuh Ani sudah bekerja.',
        table: [
          ['Nama', 'Masuk', 'Acuan', 'Tahun penuh'],
          ['Ani', '=DATE(2020;3;15)', '=DATE(2025;3;14)', '=DATEDIF(B2;C2;"Y")'],
        ],
        formula: '=DATEDIF(B2;C2;"Y")',
        result: '4',
        walkthrough: 'Dari 15 Maret 2020 ke 14 Maret 2025 baru 4 tahun penuh. Tahun kelima baru genap pada 15 Maret 2025.',
      },
      mistakes: [
        { title: 'Tanggal awal lebih besar dari akhir', detail: 'DATEDIF menghasilkan #NUM! bila awal lebih besar. Tukar urutannya.' },
        { title: 'Mengira NETWORKDAYS tahu hari libur nasional', detail: 'Libur nasional dan cuti bersama harus kamu daftar sendiri sebagai argumen ketiga.' },
      ],
      playgroundNote: 'Playground belum memiliki format sel, sehingga tanggal tampil sebagai nomor serial. Latihan tetap menilai angka serialnya.',
      quiz: [
        {
          question: 'Apa hasil =EOMONTH(DATE(2025; 1; 15); 0)?',
          options: ['31 Januari 2025', '15 Januari 2025', '1 Februari 2025', '28 Februari 2025'],
          answerIndex: 0,
          explanation: 'n = 0 berarti bulan yang sama, dan tanggal terakhir Januari adalah 31.',
        },
        {
          question: 'NETWORKDAYS menghitung hari...',
          options: ['Senin sampai Jumat', 'Semua hari', 'Hanya Sabtu dan Minggu', 'Hanya hari libur'],
          answerIndex: 0,
          explanation: 'NETWORKDAYS hanya menghitung hari kerja Senin sampai Jumat, dan melewati libur yang kamu daftarkan.',
        },
      ],
    },
  },
];
