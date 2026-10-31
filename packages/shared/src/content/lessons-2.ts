import type { LessonDef } from '../types';

/** Modul 4-5: Logika dan Fungsi Bersyarat. */
export const lessonsPart2: LessonDef[] = [
  {
    slug: 'fungsi-if',
    moduleSlug: 'logika',
    title: 'IF: Mengambil Keputusan',
    summary: 'Menampilkan hasil berdasarkan suatu syarat.',
    minutes: 10,
    sortOrder: 1,
    content: {
      objectives: [
        'Menulis uji logika seperti B2>=70.',
        'Memakai IF dengan hasil benar dan hasil salah.',
        'Menulis teks hasil dalam tanda kutip.',
      ],
      sections: [
        {
          heading: 'Uji logika',
          paragraphs: [
            'Uji logika menghasilkan TRUE (benar) atau FALSE (salah). Contoh: B2>=70 memeriksa apakah nilai di B2 minimal 70. Operator pembanding: =, <>, <, >, <=, >=.',
          ],
        },
        {
          heading: 'Struktur IF',
          paragraphs: [
            'IF memeriksa uji logika. Jika hasilnya benar, IF menampilkan argumen kedua. Jika salah, IF menampilkan argumen ketiga. Teks harus diapit tanda kutip ganda, sedangkan angka dan referensi sel tidak.',
          ],
        },
      ],
      syntax: {
        signature: '=IF(uji_logika; nilai_jika_benar; [nilai_jika_salah])',
        params: [
          { name: 'uji_logika', description: 'Kondisi yang dicek, misalnya B2>=70.' },
          { name: 'nilai_jika_benar', description: 'Hasil yang ditampilkan jika kondisi terpenuhi.' },
          { name: 'nilai_jika_salah', description: 'Opsional. Hasil yang ditampilkan jika kondisi tidak terpenuhi. Jika dikosongkan, hasilnya FALSE.' },
        ],
      },
      example: {
        title: 'Status kelulusan',
        description: 'KKM 70. Nilai minimal 70 mendapat status Lulus, sedangkan nilai di bawah 70 mendapat status Remedial.',
        table: [
          ['Siswa', 'Nilai', 'Status'],
          ['Ani', 82, '=IF(B2>=70;"Lulus";"Remedial")'],
          ['Beni', 65, '=IF(B3>=70;"Lulus";"Remedial")'],
        ],
        formula: '=IF(B2>=70;"Lulus";"Remedial")',
        result: 'Lulus (untuk Ani), Remedial (untuk Beni)',
        walkthrough: '82 >= 70 benar sehingga Ani "Lulus". 65 >= 70 salah sehingga Beni "Remedial".',
      },
      mistakes: [
        { title: 'Teks tanpa tanda kutip', detail: 'Lulus tanpa kutip dianggap sebagai nama, bukan teks, sehingga menghasilkan #NAME?.' },
        { title: 'Memakai > padahal batasnya termasuk', detail: 'Nilai 70 juga harus lulus, jadi gunakan >=, bukan >.' },
        { title: 'Mengetik angka batas berulang kali', detail: 'Simpan KKM di satu sel, lalu kunci referensinya dengan $.' },
      ],
      quiz: [
        {
          question: 'Apa hasil =IF(5>10;"Ya";"Tidak")?',
          options: ['Ya', 'Tidak', 'TRUE', 'Galat'],
          answerIndex: 1,
          explanation: '5 tidak lebih besar dari 10, sehingga uji salah dan hasilnya argumen ketiga: Tidak.',
        },
      ],
    },
  },
  {
    slug: 'and-or-if-bertingkat',
    moduleSlug: 'logika',
    title: 'AND, OR, dan IF Bertingkat',
    summary: 'Gabungkan beberapa syarat, lalu susun IF di dalam IF dengan rapi.',
    minutes: 14,
    sortOrder: 2,
    content: {
      objectives: [
        'Menggabungkan syarat dengan AND dan OR.',
        'Menyusun IF bertingkat untuk lebih dari dua hasil.',
        'Memilih AND/OR/IF bertingkat sesuai kebutuhan.',
      ],
      sections: [
        {
          heading: 'AND dan OR',
          paragraphs: [
            'AND bernilai TRUE bila semua syarat terpenuhi. OR bernilai TRUE bila minimal satu syarat terpenuhi. Biasanya keduanya dipakai di dalam argumen pertama IF.',
            'Contoh: =IF(AND(B2>=85;C2>=90);"Ya";"Tidak").',
          ],
        },
        {
          heading: 'IF bertingkat',
          paragraphs: [
            'Gunakan IF bertingkat setelah IF sederhana terasa nyaman. IF kedua ditaruh di posisi "jika salah" dari IF pertama, untuk memeriksa kondisi berikutnya.',
            'Urutkan dari syarat paling ketat ke paling longgar: nilai 85 ke atas "A", 70 ke atas "B", selain itu "C". Jika urutannya terbalik, semua nilai akan jatuh di kategori pertama.',
            'Jangan membuat lebih dari 3-4 tingkat; jika makin panjang, pertimbangkan tabel acuan dan fungsi pencarian (modul lanjutan).',
          ],
        },
      ],
      syntax: {
        signature: '=AND(syarat1; [syarat2]; ...)   =OR(syarat1; [syarat2]; ...)',
        params: [{ name: 'syarat1, ...', description: 'Uji logika yang bernilai TRUE atau FALSE.' }],
      },
      example: {
        title: 'Grade bertingkat',
        description: 'A untuk 85 ke atas, B untuk 70 ke atas, selain itu C.',
        table: [
          ['Siswa', 'Nilai', 'Grade'],
          ['Ani', 90, '=IF(B2>=85;"A";IF(B2>=70;"B";"C"))'],
          ['Beni', 72, '=IF(B3>=85;"A";IF(B3>=70;"B";"C"))'],
        ],
        formula: '=IF(B2>=85;"A";IF(B2>=70;"B";"C"))',
        result: 'A (Ani), B (Beni)',
        walkthrough: 'Ani lolos syarat pertama. Beni gagal syarat pertama, lolos syarat kedua (72 >= 70), sehingga "B".',
      },
      mistakes: [
        { title: 'Syarat longgar ditulis lebih dulu', detail: 'Jika B2>=70 diperiksa pertama, nilai 90 ikut jadi "B".' },
        {
          title: 'Kurung penutup tidak seimbang',
          detail: 'Setiap IF membutuhkan ")" sendiri; IF bertingkat dua berarti dua kurung penutup di akhir.',
        },
        { title: 'Mengira AND bisa ditulis B2>=85 AND C2>=90', detail: 'Di Excel AND adalah fungsi: AND(B2>=85;C2>=90).' },
      ],
      quiz: [
        {
          question: 'Kapan OR(A1>5;B1>5) bernilai TRUE?',
          options: ['Hanya jika keduanya >5', 'Jika salah satu atau keduanya >5', 'Jika keduanya ≤5', 'Selalu'],
          answerIndex: 1,
          explanation: 'OR benar jika minimal satu syarat benar.',
        },
      ],
    },
  },
  {
    slug: 'fungsi-iferror',
    moduleSlug: 'logika',
    title: 'IFERROR: Menangani Galat',
    summary: 'Ganti pesan galat seperti #DIV/0! dengan hasil yang ramah.',
    minutes: 8,
    sortOrder: 3,
    content: {
      objectives: [
        'Mengenali galat umum: #DIV/0!, #VALUE!, #NAME?.',
        'Memakai IFERROR sebagai pengaman.',
        'Tahu kapan IFERROR menyembunyikan masalah.',
      ],
      sections: [
        {
          heading: 'Galat umum',
          paragraphs: [
            '#DIV/0! berarti dibagi nol atau sel kosong. #VALUE! berarti tipe data salah, misalnya menjumlah teks. #NAME? berarti nama fungsi atau referensi tidak dikenal. #REF! berarti referensi tidak valid.',
          ],
        },
        {
          heading: 'IFERROR',
          paragraphs: [
            'IFERROR(nilai; jika_galat) menampilkan nilai bila tidak ada galat, dan argumen kedua bila ada galat apa pun.',
            'Hati-hati: IFERROR menutupi semua galat, termasuk kesalahan ketik rumus. Pakai untuk kasus yang memang wajar, misalnya pembagi yang bisa nol, bukan untuk membungkus semua rumus.',
          ],
        },
      ],
      syntax: {
        signature: '=IFERROR(nilai; nilai_jika_galat)',
        params: [
          { name: 'nilai', description: 'Rumus atau nilai yang dicek.' },
          { name: 'nilai_jika_galat', description: 'Hasil yang ditampilkan bila nilai berupa galat.' },
        ],
      },
      example: {
        title: 'Rata-rata harga per unit',
        description: 'Total dibagi unit; unit bisa nol.',
        table: [
          ['Produk', 'Total', 'Unit', 'Per unit'],
          ['Pulpen', 50000, 10, '=IFERROR(B2/C2;"-")'],
          ['Buku', 30000, 0, '=IFERROR(B3/C3;"-")'],
        ],
        formula: '=IFERROR(B3/C3;"-")',
        result: '-',
        walkthrough: '30000/0 menghasilkan #DIV/0!, maka IFERROR menampilkan tanda "-".',
      },
      mistakes: [
        { title: 'Menutupi kesalahan sendiri', detail: 'Rumus yang salah ketik juga jadi "-" sehingga kesalahan tidak terlihat.' },
        { title: 'Mengira IFERROR memperbaiki data', detail: 'IFERROR hanya mengganti tampilan; data bermasalah tetap ada.' },
      ],
      quiz: [
        {
          question: 'Apa hasil =IFERROR(10/0;"Nol")?',
          options: ['#DIV/0!', '0', 'Nol', '10'],
          answerIndex: 2,
          explanation: '10/0 galat, sehingga IFERROR menampilkan argumen kedua: Nol.',
        },
      ],
    },
  },
  {
    slug: 'countif-countifs',
    moduleSlug: 'fungsi-bersyarat',
    title: 'COUNTIF dan COUNTIFS',
    summary: 'Menghitung data yang memenuhi satu atau beberapa syarat.',
    minutes: 12,
    sortOrder: 1,
    content: {
      objectives: [
        'Menghitung data dengan satu syarat memakai COUNTIF.',
        'Menghitung dengan beberapa syarat memakai COUNTIFS.',
        'Menulis kriteria teks dan perbandingan, misalnya ">50".',
      ],
      sections: [
        {
          heading: 'Hitung dengan syarat',
          paragraphs: [
            'COUNTIF menghitung sel yang memenuhi satu kriteria. Kriteria teks ditulis dalam tanda kutip, misalnya "Lunas". Kriteria perbandingan juga ditulis dalam tanda kutip: ">50", "<=20", "<>Lunas".',
            'COUNTIFS menerima beberapa pasangan (rentang; kriteria). Fungsi ini hanya menghitung baris yang memenuhi semua kriteria (logika DAN). Ukuran semua rentang harus sama.',
            'Pencocokan teks tidak membedakan huruf besar dan kecil. "lunas" sama dengan "Lunas". Karakter * dan ? juga bisa dipakai sebagai wildcard.',
          ],
        },
      ],
      syntax: {
        signature: '=COUNTIF(rentang; kriteria)   =COUNTIFS(rentang1; kriteria1; [rentang2; kriteria2]; ...)',
        params: [
          { name: 'rentang', description: 'Sel yang akan diperiksa, misalnya C2:C8.' },
          { name: 'kriteria', description: 'Syarat yang digunakan, berupa angka, teks, atau perbandingan seperti ">50".' },
        ],
        notes: ['Pada COUNTIFS, jumlah argumen selalu genap (pasangan rentang-kriteria).'],
      },
      example: {
        title: 'Status pembayaran',
        description: 'Hitung jumlah transaksi berstatus Lunas.',
        table: [
          ['Pelanggan', 'Total', 'Status'],
          ['Ani', 50000, 'Lunas'],
          ['Beni', 70000, 'Belum'],
          ['Citra', 30000, 'Lunas'],
        ],
        formula: '=COUNTIF(C2:C4;"Lunas")',
        result: '2',
        walkthrough: 'Dua dari tiga sel di C2:C4 berisi "Lunas".',
      },
      mistakes: [
        { title: 'Kriteria teks tanpa kutip', detail: 'Lunas tanpa tanda kutip akan menghasilkan #NAME?.' },
        { title: 'Ukuran rentang berbeda di COUNTIFS', detail: 'C2:C8 dan B2:B7 tidak sama panjang, sehingga menghasilkan #VALUE!.' },
        { title: 'Salah menulis operator', detail: 'Tulis ">50" dengan tanda kutip. Tanpa tanda kutip, rumus tidak valid.' },
      ],
      quiz: [
        {
          question: 'Rumus untuk menghitung nilai di atas 50 pada B2:B10:',
          options: ['=COUNTIF(B2:B10;>50)', '=COUNTIF(B2:B10;">50")', '=COUNT(B2:B10>50)', '=COUNTIF(">50";B2:B10)'],
          answerIndex: 1,
          explanation: 'Kriteria perbandingan ditulis sebagai teks dalam kutip, dan urutannya (rentang; kriteria).',
        },
      ],
    },
  },
  {
    slug: 'sumif-sumifs',
    moduleSlug: 'fungsi-bersyarat',
    title: 'SUMIF dan SUMIFS',
    summary: 'Jumlahkan angka hanya untuk baris yang memenuhi syarat.',
    minutes: 12,
    sortOrder: 2,
    content: {
      objectives: [
        'Menjumlahkan dengan satu syarat memakai SUMIF.',
        'Menjumlahkan dengan beberapa syarat memakai SUMIFS.',
        'Membedakan urutan argumen SUMIF dan SUMIFS.',
      ],
      sections: [
        {
          heading: 'Jumlahkan sebagian data',
          paragraphs: [
            'SUMIF menjumlahkan angka dari rentang jumlah, hanya untuk baris yang kriterianya cocok. SUMIFS melakukan hal serupa dengan banyak syarat sekaligus.',
            'Urutan argumen berbeda! SUMIF: (rentang_kriteria; kriteria; rentang_jumlah). SUMIFS: (rentang_jumlah; rentang_kriteria1; kriteria1; ...). Rentang jumlah pindah ke depan.',
          ],
        },
      ],
      syntax: {
        signature: '=SUMIF(rentang; kriteria; [rentang_jumlah])   =SUMIFS(rentang_jumlah; rentang_kriteria1; kriteria1; ...)',
        params: [
          { name: 'rentang', description: 'Sel yang diperiksa dengan kriteria.' },
          { name: 'kriteria', description: 'Syarat, misalnya "Makanan" atau ">100000".' },
          { name: 'rentang_jumlah', description: 'Sel yang dijumlahkan. Pada SUMIF boleh dikosongkan (rentang kriteria dijumlahkan).' },
        ],
      },
      example: {
        title: 'Total per kategori',
        description: 'Jumlah penjualan kategori Makanan.',
        table: [
          ['Kategori', 'Produk', 'Penjualan'],
          ['Makanan', 'Beras', 300000],
          ['Minuman', 'Teh', 120000],
          ['Makanan', 'Mie', 80000],
        ],
        formula: '=SUMIF(A2:A4;"Makanan";C2:C4)',
        result: '380000',
        walkthrough: 'Baris 2 dan 4 berkategori Makanan, jadi 300000 + 80000.',
      },
      mistakes: [
        { title: 'Tertukar urutan SUMIF dan SUMIFS', detail: 'Pada SUMIFS, rentang yang dijumlahkan ditulis pertama.' },
        { title: 'Ukuran rentang tidak sama', detail: 'Pada SUMIFS semua rentang harus berukuran sama, jika tidak hasilnya #VALUE!.' },
        { title: 'Angka disimpan sebagai teks', detail: 'Penjualan berbentuk teks tidak ikut dijumlahkan.' },
      ],
      quiz: [
        {
          question: 'Pada =SUMIFS(C2:C9;A2:A9;"Makanan";B2:B9;"Jakarta"), rentang yang dijumlahkan adalah…',
          options: ['A2:A9', 'B2:B9', 'C2:C9', 'Semua'],
          answerIndex: 2,
          explanation: 'Argumen pertama SUMIFS adalah rentang yang dijumlahkan, yaitu C2:C9.',
        },
      ],
    },
  },
];
