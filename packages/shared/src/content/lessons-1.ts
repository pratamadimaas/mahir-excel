import type { LessonDef } from '../types';

/** Modul 1-3. Isi ditulis orisinal untuk Mahir Excel. Perilaku Excel dijelaskan secara umum; periksa tampilan menu pada versi Excel Anda. */
export const lessonsPart1: LessonDef[] = [
  {
    slug: 'sel-baris-kolom-rentang',
    moduleSlug: 'mengenal-excel',
    title: 'Sel, Baris, Kolom, dan Rentang',
    summary: 'Mengenal bagian lembar kerja dan cara memasukkan data.',
    minutes: 10,
    sortOrder: 1,
    content: {
      objectives: [
        'Membedakan workbook, worksheet, baris, kolom, dan sel.',
        'Menulis alamat sel (A1, B3) dan rentang (B2:B6).',
        'Memasukkan teks dan angka, serta paham perbedaan keduanya.',
      ],
      sections: [
        {
          heading: 'Workbook dan worksheet',
          paragraphs: [
            'Satu file Excel disebut workbook. Di dalamnya ada satu atau lebih worksheet (lembar kerja) yang tampil sebagai tab di bagian bawah, misalnya "Sheet1".',
            'Worksheet berbentuk tabel. Kolom diberi huruf (A, B, C…), sedangkan baris diberi angka (1, 2, 3…).',
          ],
        },
        {
          heading: 'Sel dan alamat sel',
          paragraphs: [
            'Pertemuan kolom dan baris disebut sel. Alamat sel ditulis dengan huruf kolom lebih dulu, lalu nomor baris. B3 berarti kolom B, baris 3. Kotak di kiri atas (Name Box) menunjukkan alamat sel yang sedang dipilih.',
            'Sekumpulan sel yang berdekatan disebut rentang (range). B2:B6 mencakup semua sel dari B2 sampai B6. A1:C3 mencakup 3 kolom × 3 baris.',
          ],
        },
        {
          heading: 'Memasukkan data',
          paragraphs: [
            'Pilih sel, ketik isinya, lalu tekan Enter. Excel mengenali angka (15000) dan teks (Beras) secara otomatis. Angka biasanya rata kanan, sedangkan teks rata kiri.',
            'Angka yang disertai huruf, seperti "Rp 15000" atau "15 ribu", dianggap teks dan tidak bisa dijumlahkan. Ketik angkanya saja, lalu atur tampilan Rp lewat format sel.',
            'Format sel (angka, mata uang, tanggal, teks) hanya mengubah tampilan. Nilai di dalam sel tetap sama. Di Excel, buka format lewat Ctrl + 1 (Windows).',
          ],
        },
      ],
      example: {
        title: 'Daftar harga warung',
        description: 'Tabel kecil dengan dua kolom. Sel A2 berisi teks "Beras", sel B2 berisi angka 15000.',
        table: [
          ['Barang', 'Harga'],
          ['Beras', 15000],
          ['Gula', 14000],
        ],
        formula: 'B2:B3',
        result: 'Rentang berisi dua angka: 15000 dan 14000',
        walkthrough: 'B2:B3 mencakup dua sel di kolom B. Rentang seperti ini bisa dipakai dalam rumus SUM.',
      },
      mistakes: [
        {
          title: 'Menulis satuan di dalam sel angka',
          detail: '"15000 rupiah" dianggap teks. Ketik 15000 saja, lalu gunakan format sel untuk menampilkan Rp.',
        },
        { title: 'Urutan alamat sel terbalik', detail: 'Tulis kolom lebih dulu, baru baris. Contohnya B3, bukan 3B.' },
        {
          title: 'Spasi tambahan',
          detail: 'Teks "Beras " (dengan spasi di akhir) berbeda dari "Beras" saat dicari atau dihitung.',
        },
      ],
      playgroundNote:
        'Playground Mahir Excel hanya menyimulasikan isi sel dan rumus. Pengaturan format sel (Rp, tanggal) tidak ada di playground, tetapi angka ditampilkan dengan pemisah ribuan Indonesia.',
      quiz: [
        {
          question: 'Alamat sel di kolom C, baris 5 adalah…',
          options: ['5C', 'C5', 'C:5', 'R5C3'],
          answerIndex: 1,
          explanation: 'Alamat sel ditulis huruf kolom lalu nomor baris: C5.',
        },
        {
          question: 'Isi sel manakah yang akan dianggap teks oleh Excel?',
          options: ['15000', '0.5', 'Rp 15000', '-20'],
          answerIndex: 2,
          explanation: '"Rp 15000" mengandung huruf sehingga dianggap teks. Tiga lainnya adalah angka.',
        },
      ],
    },
  },
  {
    slug: 'referensi-sel-dasar',
    moduleSlug: 'mengenal-excel',
    title: 'Rumus Pertama dan Referensi Sel',
    summary: 'Tulis rumus yang memakai alamat sel, bukan angka yang diketik ulang.',
    minutes: 10,
    sortOrder: 2,
    content: {
      objectives: [
        'Menulis rumus diawali tanda sama dengan (=).',
        'Memakai referensi sel di dalam rumus.',
        'Menjelaskan mengapa referensi lebih baik daripada mengetik angka langsung.',
      ],
      sections: [
        {
          heading: 'Rumus selalu diawali "="',
          paragraphs: [
            'Tanda sama dengan memberi tahu Excel bahwa isi sel adalah perhitungan. =2+3 menghasilkan 5. Tanpa tanda "=", Excel menyimpannya sebagai teks.',
            'Operator dasar: + (tambah), - (kurang), * (kali), / (bagi), ^ (pangkat). Perkalian dan pembagian dihitung lebih dulu daripada penjumlahan dan pengurangan; gunakan tanda kurung untuk mengatur urutan.',
          ],
        },
        {
          heading: 'Memakai referensi sel',
          paragraphs: [
            'Alih-alih mengetik =15000*3, tulis =B2*C2. Excel mengambil nilai terbaru dari B2 dan C2. Bila harga atau jumlah berubah, hasil ikut berubah otomatis.',
            'Inilah kekuatan utama spreadsheet: data dan perhitungan dipisah, sehingga mudah diperbarui dan diperiksa.',
          ],
        },
      ],
      syntax: {
        signature: '=sel1 operator sel2',
        params: [
          { name: 'sel1, sel2', description: 'Alamat sel yang nilainya dipakai, misalnya B2.' },
          { name: 'operator', description: '+, -, *, /, atau ^.' },
        ],
      },
      example: {
        title: 'Total harga barang',
        description: 'Kolom D menghitung total = harga × jumlah.',
        table: [
          ['Barang', 'Harga', 'Jumlah', 'Total'],
          ['Beras', 15000, 2, '=B2*C2'],
          ['Gula', 14000, 3, '=B3*C3'],
        ],
        formula: '=B2*C2',
        result: '30000',
        walkthrough: 'Excel mengambil 15000 dari B2 dan 2 dari C2, mengalikannya, dan menampilkan 30000 di D2.',
      },
      mistakes: [
        { title: 'Lupa tanda "="', detail: 'B2*C2 tanpa "=" hanya menjadi teks biasa, tidak dihitung.' },
        {
          title: 'Mengetik angka langsung',
          detail: '=15000*2 benar hasilnya hari ini, tetapi tidak ikut berubah saat harga di B2 diubah.',
        },
        { title: 'Salah memilih sel', detail: 'Rumus di baris 3 harus merujuk ke B3 dan C3, bukan B2 dan C2.' },
      ],
      quiz: [
        {
          question: 'Rumus yang tepat untuk mengalikan isi B2 dan C2 adalah…',
          options: ['B2*C2', '=B2*C2', '="B2*C2"', '=B2xC2'],
          answerIndex: 1,
          explanation: 'Rumus harus diawali "=" dan memakai * untuk perkalian.',
        },
      ],
    },
  },
  {
    slug: 'mengurutkan-menyaring-tabel',
    moduleSlug: 'mengolah-data',
    title: 'Mengurutkan, Menyaring, dan Merapikan Tabel',
    summary: 'Urutkan, filter, bekukan baris judul, dan format tabel agar data mudah dibaca.',
    minutes: 12,
    sortOrder: 1,
    content: {
      objectives: [
        'Menjelaskan fungsi sort dan filter pada data tabel.',
        'Mengetahui kapan memakai Freeze Panes dan Format as Table.',
        'Membaca hasil data yang sudah diurutkan atau difilter.',
      ],
      sections: [
        {
          heading: 'Persiapan data',
          paragraphs: [
            'Data yang rapi: baris pertama berisi judul kolom, setiap kolom berisi satu jenis data, tidak ada baris atau kolom kosong di tengah tabel.',
          ],
        },
        {
          heading: 'Sort (urutkan)',
          paragraphs: [
            'Pilih satu sel di dalam tabel, lalu buka tab Data dan pilih Sort. Pilih kolom yang jadi acuan dan arah urutan (A ke Z, terkecil ke terbesar, atau sebaliknya).',
            'Excel mengurutkan seluruh baris sekaligus sehingga data satu baris tidak terpisah. Jangan memilih satu kolom saja kecuali kamu memang ingin kolom lain tidak ikut berpindah.',
          ],
        },
        {
          heading: 'Filter (saring)',
          paragraphs: [
            'Aktifkan Filter di tab Data (di Windows: Ctrl + Shift + L). Muncul tombol panah di judul kolom; pilih nilai yang ingin ditampilkan. Baris lain hanya disembunyikan, tidak dihapus.',
            'Nomor baris yang tampil berwarna biru menandakan filter aktif. Hapus filter untuk melihat semua data lagi.',
          ],
        },
        {
          heading: 'Freeze Panes dan Format as Table',
          paragraphs: [
            'Freeze Panes (tab View) menjaga baris judul tetap terlihat saat menggulir data panjang.',
            'Format as Table (tab Home) memberi warna selang-seling, tombol filter otomatis, dan rumus yang menyesuaikan saat data bertambah.',
          ],
        },
      ],
      example: {
        title: 'Penjualan per sales',
        description: 'Setelah diurutkan dari penjualan terbesar ke terkecil, baris pertama adalah sales dengan angka tertinggi.',
        table: [
          ['Sales', 'Penjualan'],
          ['Sari', 9200000],
          ['Budi', 7500000],
          ['Dewi', 5100000],
        ],
        formula: 'Sort: Penjualan, terbesar ke terkecil',
        result: 'Sari berada di baris pertama',
        walkthrough: 'Sort tidak mengubah isi data; hanya urutan barisnya. Filter hanya menampilkan sebagian baris.',
      },
      mistakes: [
        {
          title: 'Mengurutkan satu kolom saja',
          detail: 'Nama dan angkanya jadi tidak cocok lagi. Pilih seluruh tabel atau cukup satu sel di dalamnya.',
        },
        {
          title: 'Ada baris kosong di tengah data',
          detail: 'Excel mengira tabel berakhir di baris kosong, sehingga sort/filter hanya berlaku sebagian.',
        },
        {
          title: 'Mengira filter menghapus data',
          detail: 'Filter hanya menyembunyikan. Rumus seperti SUM tetap menghitung sel tersembunyi.',
        },
      ],
      playgroundNote:
        'Playground tidak punya tombol Sort atau Filter. Latihan di bagian ini meminta kamu membaca data seolah-olah sudah diurutkan atau disaring, lalu mengetik hasilnya.',
      quiz: [
        {
          question: 'Apa yang terjadi pada baris yang tidak lolos filter?',
          options: ['Dihapus permanen', 'Disembunyikan', 'Dipindah ke lembar baru', 'Diubah jadi nol'],
          answerIndex: 1,
          explanation: 'Filter hanya menyembunyikan baris. Datanya tetap ada.',
        },
      ],
    },
  },
  {
    slug: 'data-tidak-konsisten',
    moduleSlug: 'mengolah-data',
    title: 'Merapikan Data yang Tidak Konsisten',
    summary: 'Kenali angka yang tersimpan sebagai teks, ejaan beragam, dan spasi tersembunyi.',
    minutes: 10,
    sortOrder: 2,
    content: {
      objectives: [
        'Mengenali tanda-tanda data tidak konsisten.',
        'Memperbaiki angka yang tersimpan sebagai teks.',
        'Menyeragamkan penulisan teks agar bisa dihitung dan dicari.',
      ],
      sections: [
        {
          heading: 'Mengapa konsistensi penting',
          paragraphs: [
            'Excel membandingkan isi sel apa adanya. "Jakarta", "jakarta", dan "Jakarta " (dengan spasi di akhir) mungkin tampak sama bagi mata, padahal bisa dianggap berbeda oleh alat tertentu.',
            'Angka yang tersimpan sebagai teks (misalnya "Rp 17000") tidak ikut dijumlahkan oleh SUM sehingga total tampak lebih kecil dari seharusnya, tanpa pesan galat.',
          ],
        },
        {
          heading: 'Tanda-tanda yang perlu dicurigai',
          paragraphs: [
            'Angka rata kiri padahal harusnya rata kanan; segitiga hijau kecil di pojok sel (di Excel); jumlah total tidak masuk akal; filter menampilkan pilihan yang mirip, seperti "Jakarta" dan "jakarta" sebagai dua item.',
          ],
        },
        {
          heading: 'Cara memperbaiki',
          paragraphs: [
            'Untuk data kecil, perbaiki langsung di sel. Untuk data besar Excel punya Find & Replace (Ctrl + H), Text to Columns, serta fungsi TRIM dan VALUE (belum tersedia di playground Mahir Excel).',
            'Cegah masalah sejak awal dengan Data Validation, misalnya daftar pilihan kota, sehingga orang tidak mengetik bebas.',
          ],
        },
      ],
      example: {
        title: 'Harga yang salah tulis',
        description: 'Satu harga tertulis "Rp 17000" sehingga dianggap teks.',
        table: [
          ['Barang', 'Harga'],
          ['Beras', 15000],
          ['Telur', 'Rp 17000'],
          ['Gula', 14000],
        ],
        formula: '=SUM(B2:B4)',
        result: '29000 (bukan 46000)',
        walkthrough: 'SUM mengabaikan teks "Rp 17000". Setelah diganti angka 17000, hasilnya menjadi 46000.',
      },
      mistakes: [
        {
          title: 'Percaya total tanpa memeriksa',
          detail: 'Bandingkan total dengan perkiraan kasar. Total yang terlalu kecil sering berarti ada angka berbentuk teks.',
        },
        { title: 'Menyeragamkan hanya yang tampak', detail: 'Spasi di akhir tidak terlihat. Klik sel dan periksa isinya di formula bar.' },
      ],
      quiz: [
        {
          question: 'SUM mengabaikan sel berisi "Rp 17000" karena…',
          options: ['Terlalu besar', 'Dianggap teks', 'Memakai huruf kapital', 'Sel berwarna'],
          answerIndex: 1,
          explanation: 'Sel yang mengandung huruf dianggap teks, dan teks dalam rentang diabaikan oleh SUM.',
        },
      ],
    },
  },
  {
    slug: 'fungsi-sum',
    moduleSlug: 'rumus-dasar',
    title: 'SUM: Menjumlahkan Angka',
    summary: 'Menjumlahkan angka dalam rentang sel dengan SUM.',
    minutes: 8,
    sortOrder: 1,
    content: {
      objectives: [
        'Menulis SUM dengan rentang sel.',
        'Menjumlahkan lebih dari satu rentang.',
        'Memahami bahwa teks dan sel kosong diabaikan.',
      ],
      sections: [
        {
          heading: 'Mengapa SUM',
          paragraphs: [
            '=B2+B3+B4+B5+B6 benar tetapi panjang dan mudah terlewat. =SUM(B2:B6) lebih ringkas dan otomatis mencakup semua sel di rentang.',
            'SUM hanya menjumlahkan angka. Teks, sel kosong, serta nilai TRUE/FALSE dalam rentang tidak ikut dihitung.',
          ],
        },
      ],
      syntax: {
        signature: '=SUM(angka1; [angka2]; ...)',
        params: [
          { name: 'angka1', description: 'Wajib. Rentang, sel, atau angka yang akan dijumlahkan, misalnya B2:B6.' },
          { name: 'angka2, ...', description: 'Opsional. Rentang atau angka tambahan yang dipisahkan dengan koma atau titik koma.' },
        ],
        notes: [
          'Pemisah argumen tergantung pengaturan regional Excel: koma (,) atau titik koma (;). Playground Mahir Excel menerima keduanya.',
        ],
      },
      example: {
        title: 'Pengeluaran mingguan',
        description: 'Menjumlahkan tiga pengeluaran.',
        table: [
          ['Pos', 'Biaya'],
          ['Makan', 350000],
          ['Transport', 120000],
          ['Pulsa', 50000],
        ],
        formula: '=SUM(B2:B4)',
        result: '520000',
        walkthrough: 'B2:B4 mencakup tiga sel. SUM menjumlahkan 350000 + 120000 + 50000.',
      },
      mistakes: [
        { title: 'Rentang kurang satu baris', detail: 'SUM(B2:B5) padahal data sampai B6. Periksa sel pertama dan terakhir dalam rentang.' },
        {
          title: 'Ikut menjumlahkan baris total',
          detail: 'Jika total berada di B7, jangan menulis SUM(B2:B7) di sel B7 karena akan menghasilkan referensi melingkar.',
        },
        { title: 'Angka tersimpan sebagai teks', detail: 'Angka yang rata kiri biasanya berupa teks, sehingga tidak ikut dijumlahkan.' },
      ],
      quiz: [
        {
          question: 'A1 berisi 10, A2 berisi 20, A3 berisi teks "abc". Berapa hasil =SUM(A1:A3)?',
          options: ['Galat #VALUE!', '30, karena teks diabaikan', '0', '10'],
          answerIndex: 1,
          explanation: 'Teks di dalam rentang diabaikan oleh SUM, sehingga hanya angka yang dijumlahkan.',
        },
      ],
    },
  },
  {
    slug: 'average-min-max',
    moduleSlug: 'rumus-dasar',
    title: 'AVERAGE, MIN, dan MAX',
    summary: 'Cari rata-rata, nilai terkecil, dan nilai terbesar dalam data.',
    minutes: 8,
    sortOrder: 2,
    content: {
      objectives: [
        'Menghitung rata-rata dengan AVERAGE.',
        'Mencari nilai terkecil dan terbesar dengan MIN dan MAX.',
        'Membaca hasil ringkasan data nilai atau penjualan.',
      ],
      sections: [
        {
          heading: 'Ringkasan cepat',
          paragraphs: [
            'AVERAGE membagi jumlah angka dengan banyaknya angka. MIN dan MAX mengembalikan nilai terkecil dan terbesar. Ketiganya mengabaikan teks dan sel kosong di dalam rentang.',
            'Perhatikan: sel kosong tidak dihitung sebagai nol oleh AVERAGE, tetapi angka 0 yang diketik dihitung.',
          ],
        },
      ],
      syntax: {
        signature: '=AVERAGE(angka1; [angka2]; ...)   =MIN(...)   =MAX(...)',
        params: [{ name: 'angka1, ...', description: 'Rentang atau angka yang akan diringkas.' }],
        notes: ['Jika rentang tidak berisi angka sama sekali, AVERAGE menghasilkan galat #DIV/0!.'],
      },
      example: {
        title: 'Nilai ujian',
        description: 'Ringkas nilai lima siswa.',
        table: [
          ['Siswa', 'Nilai'],
          ['Ani', 80],
          ['Beni', 70],
          ['Citra', 90],
        ],
        formula: '=AVERAGE(B2:B4)',
        result: '80',
        walkthrough: '(80 + 70 + 90) / 3 = 80. MIN-nya 70 dan MAX-nya 90.',
      },
      mistakes: [
        { title: 'Mengira AVERAGE menghitung sel kosong', detail: 'Sel kosong dilewati. Jika ingin dihitung sebagai 0, isi angka 0.' },
        { title: 'Memakai MAX untuk mencari nama', detail: 'MAX mengembalikan angka, bukan nama pemilik angka itu.' },
      ],
      quiz: [
        {
          question: 'Nilai: 60, 80, (kosong), 100. Berapa AVERAGE-nya?',
          options: ['60', '80', '90', '240'],
          answerIndex: 1,
          explanation: 'Sel kosong dilewati: (60 + 80 + 100) / 3 = 80.',
        },
      ],
    },
  },
  {
    slug: 'count-counta',
    moduleSlug: 'rumus-dasar',
    title: 'COUNT dan COUNTA',
    summary: 'Hitung banyaknya angka dan banyaknya sel yang terisi.',
    minutes: 8,
    sortOrder: 3,
    content: {
      objectives: ['Membedakan COUNT dan COUNTA.', 'Menghitung jumlah data dalam daftar.', 'Memilih fungsi sesuai tipe data.'],
      sections: [
        {
          heading: 'Dua cara menghitung',
          paragraphs: [
            'COUNT menghitung sel yang berisi angka. COUNTA menghitung sel yang tidak kosong, apa pun isinya (angka, teks, bahkan hasil galat).',
            'Contoh: untuk mengetahui berapa siswa terdaftar, hitung kolom nama dengan COUNTA. Untuk mengetahui berapa siswa yang sudah punya nilai, hitung kolom nilai dengan COUNT.',
          ],
        },
      ],
      syntax: {
        signature: '=COUNT(nilai1; [nilai2]; ...)   =COUNTA(nilai1; [nilai2]; ...)',
        params: [{ name: 'nilai1, ...', description: 'Rentang atau sel yang akan dihitung.' }],
      },
      example: {
        title: 'Daftar nilai',
        description: 'Satu siswa belum punya nilai (kosong), satu lagi tertulis "Absen".',
        table: [
          ['Siswa', 'Nilai'],
          ['Ani', 80],
          ['Beni', 'Absen'],
          ['Citra', ''],
          ['Dedi', 75],
        ],
        formula: '=COUNT(B2:B5)',
        result: '2',
        walkthrough: 'Hanya B2 dan B5 yang angka. =COUNTA(B2:B5) menghasilkan 3 karena "Absen" juga terisi.',
      },
      mistakes: [
        { title: 'Memakai COUNT untuk menghitung nama', detail: 'COUNT mengabaikan teks. Untuk nama gunakan COUNTA.' },
        { title: 'Sel berisi spasi dianggap terisi', detail: 'Sel yang tampak kosong tetapi berisi spasi tetap dihitung COUNTA.' },
      ],
      quiz: [
        {
          question: 'Untuk menghitung jumlah nama di kolom A (teks), gunakan…',
          options: ['COUNT', 'COUNTA', 'SUM', 'MAX'],
          answerIndex: 1,
          explanation: 'COUNTA menghitung semua sel yang tidak kosong, termasuk teks.',
        },
      ],
    },
  },
  {
    slug: 'referensi-relatif-absolut',
    moduleSlug: 'rumus-dasar',
    title: 'Referensi Relatif dan Absolut',
    summary: 'Kunci sel dengan tanda $ supaya rumus tetap benar saat disalin.',
    minutes: 12,
    sortOrder: 4,
    content: {
      objectives: [
        'Menjelaskan perbedaan referensi relatif dan absolut.',
        'Memakai $ untuk mengunci kolom, baris, atau keduanya.',
        'Menulis rumus yang aman disalin ke bawah.',
      ],
      sections: [
        {
          heading: 'Relatif: ikut bergeser',
          paragraphs: [
            'Saat rumus disalin, referensi biasa (relatif) ikut bergeser. =B2*C2 di baris 2, bila disalin ke baris 3, otomatis menjadi =B3*C3. Itu yang kita inginkan untuk data per baris.',
          ],
        },
        {
          heading: 'Absolut: dikunci dengan $',
          paragraphs: [
            'Kadang satu sel harus tetap, misalnya tarif pajak di E1. Tulis $E$1 supaya saat disalin tetap menunjuk E1. Tanda $ di depan huruf mengunci kolom; di depan angka mengunci baris.',
            'Di Excel Windows, tekan F4 saat kursor berada pada referensi untuk berganti antara E1, $E$1, E$1, dan $E1.',
          ],
        },
        {
          heading: 'Bentuk campuran',
          paragraphs: [
            '$E1 mengunci kolom saja, E$1 mengunci baris saja. Berguna untuk tabel dua arah, tetapi mulailah dengan referensi absolut penuh.',
          ],
        },
      ],
      syntax: {
        signature: 'E1 (relatif)   $E$1 (absolut)   $E1 / E$1 (campuran)',
        params: [{ name: '$', description: 'Mengunci bagian alamat yang ada di sebelah kanannya.' }],
      },
      example: {
        title: 'Pajak dari tarif tetap',
        description: 'Tarif ada di E1 dan dipakai oleh semua baris.',
        table: [
          ['Barang', 'Harga', 'Pajak'],
          ['Beras', 15000, '=B2*$E$1'],
          ['Gula', 14000, '=B3*$E$1'],
        ],
        formula: '=B2*$E$1',
        result: 'Pajak = harga × tarif di E1',
        walkthrough: 'B2 bergeser menjadi B3 saat disalin ke bawah, sedangkan $E$1 tetap E1 sehingga semua baris memakai tarif yang sama.',
      },
      mistakes: [
        {
          title: 'Lupa mengunci tarif',
          detail: 'Jika ditulis =B2*E1 lalu disalin, baris berikutnya memakai E2, E3, … yang kosong, sehingga hasilnya 0.',
        },
        { title: 'Mengunci semuanya', detail: '=$B$2*$E$1 membuat setiap baris menghitung harga baris 2 saja.' },
      ],
      playgroundNote:
        'Playground tidak memiliki fitur salin-tarik (fill handle). Kamu menulis rumus tiap baris sendiri; tujuannya melatih menulis referensi yang benar agar aman disalin di Excel asli.',
      quiz: [
        {
          question: 'Rumus di C2 adalah =B2*$E$1. Setelah disalin ke C3 menjadi…',
          options: ['=B3*$E$1', '=B3*$E$2', '=B2*$E$1', '=B3*E2'],
          answerIndex: 0,
          explanation: 'B2 relatif sehingga menjadi B3, sedangkan $E$1 dikunci dan tidak berubah.',
        },
      ],
    },
  },
];
