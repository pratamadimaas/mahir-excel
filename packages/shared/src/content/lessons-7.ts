import type { LessonDef } from '../types';

/** Pelajaran tambahan di modul yang sudah ada: pemeriksa data, MAXIFS/MINIFS, serta EDATE dan WEEKDAY. */
export const lessonsPart7: LessonDef[] = [
  {
    slug: 'pemeriksa-data',
    moduleSlug: 'mengolah-data',
    title: 'Memeriksa Data: ISBLANK, ISNUMBER, ISTEXT, dan VALUE',
    summary: 'Temukan sel kosong dan angka yang tersimpan sebagai teks, lalu ubah ke bentuk yang benar.',
    minutes: 11,
    sortOrder: 3,
    content: {
      objectives: [
        'Memeriksa isi sel dengan ISBLANK, ISNUMBER, dan ISTEXT.',
        'Mengenali angka yang tersimpan sebagai teks.',
        'Mengambil angka dari kode teks dengan VALUE.',
      ],
      sections: [
        {
          heading: 'Fungsi pemeriksa',
          paragraphs: [
            'ISBLANK(sel) bernilai TRUE bila sel benar-benar kosong. ISNUMBER(sel) TRUE bila isinya angka (tanggal juga angka), dan ISTEXT(sel) TRUE bila isinya teks. Ketiganya tidak pernah menghasilkan galat, jadi aman dipakai untuk memeriksa data yang berantakan.',
            'Gabungkan dengan IF untuk membuat kolom pemeriksa: =IF(ISBLANK(B2);"Kosong";IF(ISNUMBER(B2);"OK";"Perlu dirapikan")). Kolom seperti ini cepat menunjukkan baris mana yang harus diperbaiki.',
          ],
        },
        {
          heading: 'Angka yang tersimpan sebagai teks',
          paragraphs: [
            'Angka berformat teks biasanya rata kiri dan sel diberi segitiga hijau di pojok. SUM mengabaikannya, sehingga total terlihat kurang tanpa ada pesan galat. Periksa dengan ISNUMBER: hasil FALSE untuk sel yang tampak seperti angka berarti isinya teks.',
            'Untuk mengubahnya, pakai VALUE(sel). Pada data dari sistem lain, teks sering membawa spasi atau awalan seperti "KRY-017". Ambil angkanya dulu dengan RIGHT atau MID, lalu bungkus dengan VALUE: =VALUE(RIGHT(A2;3)) menghasilkan 17.',
          ],
        },
        {
          heading: 'Kapan jangan diubah',
          paragraphs: [
            'Nomor yang tidak dihitung, seperti NIK, kode pos, dan nomor telepon, sebaiknya tetap teks agar angka nol di depannya tidak hilang. Ubah ke angka hanya data yang memang akan dijumlah atau dibandingkan.',
          ],
        },
      ],
      syntax: {
        signature: '=ISNUMBER(nilai)',
        params: [{ name: 'nilai', description: 'Sel atau ekspresi yang diperiksa. Hasilnya TRUE atau FALSE.' }],
        notes: ['ISBLANK(sel) TRUE bila sel kosong.', 'ISTEXT(sel) TRUE bila isinya teks.', 'VALUE(teks) mengubah teks angka menjadi angka.'],
      },
      example: {
        title: 'Memeriksa kolom gaji',
        description: 'Kolom C memberi status tiap baris, kolom D mengambil nomor urut dari kode karyawan.',
        table: [
          ['Kode', 'Gaji', 'Status', 'No. urut'],
          ['KRY-017', 5000000, '=IF(ISBLANK(B2);"Kosong";IF(ISNUMBER(B2);"OK";"Perlu dirapikan"))', '=VALUE(RIGHT(A2;3))'],
          ['KRY-018', '', '=IF(ISBLANK(B3);"Kosong";IF(ISNUMBER(B3);"OK";"Perlu dirapikan"))', '=VALUE(RIGHT(A3;3))'],
          ['KRY-019', 'lima juta', '=IF(ISBLANK(B4);"Kosong";IF(ISNUMBER(B4);"OK";"Perlu dirapikan"))', '=VALUE(RIGHT(A4;3))'],
        ],
        formula: '=IF(ISBLANK(B2);"Kosong";IF(ISNUMBER(B2);"OK";"Perlu dirapikan"))',
        result: 'OK, Kosong, Perlu dirapikan',
        walkthrough: 'Baris 2 berisi angka, baris 3 kosong, dan baris 4 berisi teks "lima juta" yang tidak bisa dihitung.',
      },
      mistakes: [
        { title: 'Mengira sel tampak kosong pasti kosong', detail: 'Sel berisi spasi atau teks kosong dari rumus bukan sel kosong. ISBLANK akan FALSE; bersihkan dengan TRIM.' },
        { title: 'SUM menghasilkan total terlalu kecil', detail: 'Angka tersimpan sebagai teks diabaikan SUM. Periksa dengan ISNUMBER dan ubah dengan VALUE.' },
        { title: 'Mengubah NIK menjadi angka', detail: 'Angka nol di depan hilang. Biarkan nomor identitas sebagai teks.' },
      ],
      playgroundNote: 'Angka yang diketik langsung di playground selalu terbaca sebagai angka, jadi contoh teks dibuat dari kode atau kata, bukan angka berformat teks.',
      quiz: [
        {
          question: 'SUM menghasilkan total lebih kecil dari yang seharusnya, tanpa pesan galat. Pemeriksaan pertama yang paling tepat adalah…',
          options: [
            'Memakai ISNUMBER pada sel yang dijumlah',
            'Mengganti SUM dengan COUNTBLANK',
            'Menghapus filter',
            'Mengubah format sel menjadi Percentage',
          ],
          answerIndex: 0,
          explanation: 'Angka yang tersimpan sebagai teks diabaikan SUM. ISNUMBER FALSE menunjukkan sel mana yang bermasalah.',
        },
      ],
    },
  },
  {
    slug: 'maxifs-minifs',
    moduleSlug: 'fungsi-bersyarat',
    title: 'MAXIFS dan MINIFS: Nilai Tertinggi dan Terendah dengan Syarat',
    summary: 'Cari gaji tertinggi atau terendah per divisi tanpa menyaring tabel.',
    minutes: 10,
    sortOrder: 4,
    content: {
      objectives: [
        'Menulis MAXIFS dan MINIFS dengan satu atau beberapa syarat.',
        'Mengingat urutan argumen: rentang nilai lebih dulu, lalu pasangan syarat.',
        'Menjelaskan perbedaan dengan SUMIFS dan MAX biasa.',
      ],
      sections: [
        {
          heading: 'Bentuk rumus',
          paragraphs: [
            'MAXIFS(rentang_nilai; rentang_syarat1; syarat1; ...) mengambil nilai terbesar dari rentang_nilai pada baris yang memenuhi semua syarat. MINIFS sama, tetapi mengambil yang terkecil. Urutannya sama dengan SUMIFS: rentang yang dihitung ditulis pertama.',
            'Contoh gaji tertinggi di divisi Admin: =MAXIFS(C2:C8;B2:B8;"Admin"). Syarat boleh lebih dari satu: tambahkan pasangan rentang dan syarat berikutnya, misalnya status karyawan "Tetap".',
          ],
        },
        {
          heading: 'Syarat dan hasil kosong',
          paragraphs: [
            'Syarat angka bisa memakai operator dalam tanda kutip, misalnya ">=5000000". Semua rentang harus berukuran sama, kalau tidak hasilnya #VALUE!.',
            'Bila tidak ada baris yang cocok, hasilnya 0, bukan galat. Periksa dulu dengan COUNTIFS bila 0 bisa membingungkan.',
          ],
        },
        {
          heading: 'Ketersediaan',
          paragraphs: [
            'MAXIFS dan MINIFS ada di Excel 2019 dan Microsoft 365. Excel 2016 versi non-365 tidak memilikinya. Bila file harus dibuka di Excel lama, gunakan MAX dengan IF sebagai rumus array, atau saring tabel dengan SUBTOTAL(4; ...).',
          ],
        },
      ],
      syntax: {
        signature: '=MAXIFS(rentang_nilai; rentang_syarat1; syarat1; [rentang_syarat2; syarat2]; ...)',
        params: [
          { name: 'rentang_nilai', description: 'Rentang angka yang dicari nilai terbesar atau terkecilnya.' },
          { name: 'rentang_syarat', description: 'Rentang yang diperiksa terhadap syarat. Ukurannya harus sama dengan rentang_nilai.' },
          { name: 'syarat', description: 'Nilai atau ekspresi dalam tanda kutip, misalnya "Admin" atau ">=5000000".' },
        ],
        notes: ['MINIFS memiliki argumen yang sama dan mengambil nilai terkecil.'],
      },
      example: {
        title: 'Gaji tertinggi dan terendah per divisi',
        description: 'Kolom E dan F mencari gaji tertinggi dan terendah untuk divisi yang tertulis di kolom D.',
        table: [
          ['Nama', 'Divisi', 'Gaji', 'Divisi', 'Tertinggi', 'Terendah'],
          ['Ani', 'Admin', 5000000, 'Admin', '=MAXIFS($C$2:$C$5;$B$2:$B$5;D2)', '=MINIFS($C$2:$C$5;$B$2:$B$5;D2)'],
          ['Budi', 'Gudang', 4000000, 'Gudang', '=MAXIFS($C$2:$C$5;$B$2:$B$5;D3)', '=MINIFS($C$2:$C$5;$B$2:$B$5;D3)'],
          ['Citra', 'Admin', 6000000],
          ['Dedi', 'Gudang', 4500000],
        ],
        formula: '=MAXIFS($C$2:$C$5;$B$2:$B$5;D2)',
        result: '6000000 untuk Admin',
        walkthrough: 'Hanya baris Admin (Ani dan Citra) yang dipertimbangkan, lalu diambil gaji terbesarnya, yaitu 6.000.000.',
      },
      mistakes: [
        { title: 'Urutan argumen terbalik', detail: 'Rentang nilai harus pertama, baru pasangan rentang syarat dan syarat. Terbalik membuat hasil salah atau #VALUE!.' },
        { title: 'Rentang berbeda ukuran', detail: 'Semua rentang harus punya jumlah baris yang sama.' },
        { title: 'Mengira hasil 0 berarti ada gaji 0', detail: 'Hasil 0 juga muncul bila tidak ada baris yang cocok. Pastikan teks syarat persis sama.' },
      ],
      playgroundNote: 'Playground mendukung MAXIFS dan MINIFS dengan beberapa syarat. Bila tidak ada yang cocok hasilnya 0, seperti di Excel.',
      quiz: [
        {
          question: 'Argumen pertama MAXIFS adalah…',
          options: ['Rentang angka yang dicari nilai terbesarnya', 'Syarat pertama', 'Nama kolom', 'Rentang syarat'],
          answerIndex: 0,
          explanation: 'Seperti SUMIFS, rentang yang dihitung ditulis lebih dulu, lalu pasangan rentang syarat dan syarat.',
        },
      ],
    },
  },
  {
    slug: 'edate-weekday',
    moduleSlug: 'teks-tanggal',
    title: 'EDATE dan WEEKDAY: Kontrak dan Hari Kerja',
    summary: 'Hitung tanggal kontrak berakhir dan periksa apakah sebuah tanggal jatuh di akhir pekan.',
    minutes: 10,
    sortOrder: 6,
    content: {
      objectives: [
        'Menambah bulan ke tanggal dengan EDATE.',
        'Menghitung tanggal berakhir kontrak yang benar.',
        'Mengetahui hari dalam seminggu dengan WEEKDAY.',
      ],
      sections: [
        {
          heading: 'EDATE: maju atau mundur beberapa bulan',
          paragraphs: [
            'EDATE(tanggal; bulan) menggeser tanggal sebanyak bulan yang kamu tulis. Angka positif maju, negatif mundur. Bila tanggal tujuan tidak ada, misalnya 31 Januari ditambah satu bulan, hasilnya jatuh di akhir bulan, yaitu 28 atau 29 Februari.',
            'Untuk kontrak 12 bulan yang mulai 1 Oktober 2026, tanggal berakhirnya adalah =EDATE(B2;12)-1, yaitu 30 September 2027. Dikurangi 1 karena hari terakhir kontrak adalah sehari sebelum ulang tahun kontrak.',
          ],
        },
        {
          heading: 'WEEKDAY: hari dalam seminggu',
          paragraphs: [
            'WEEKDAY(tanggal) memberi angka 1 untuk Minggu sampai 7 untuk Sabtu. Pakai WEEKDAY(tanggal; 2) bila kamu ingin Senin = 1 sampai Minggu = 7, sehingga Sabtu dan Minggu bernilai lebih dari 5.',
            'Contoh penanda akhir pekan: =IF(WEEKDAY(A2;2)>5;"Libur";"Kerja"). Untuk hitungan hari kerja sebenarnya, pakai NETWORKDAYS dari pelajaran sebelumnya.',
          ],
        },
        {
          heading: 'Format hasilnya',
          paragraphs: [
            'EDATE menghasilkan nomor serial, bukan tampilan tanggal. Di Excel, ubah format sel menjadi Short Date atau Long Date supaya terbaca sebagai tanggal. Nilai di baliknya tetap angka yang bisa dibandingkan dan dihitung.',
          ],
        },
      ],
      syntax: {
        signature: '=EDATE(tanggal_awal; bulan)',
        params: [
          { name: 'tanggal_awal', description: 'Tanggal asli atau hasil fungsi tanggal. Teks yang tampak seperti tanggal bisa memberi #VALUE!.' },
          { name: 'bulan', description: 'Jumlah bulan, positif untuk maju dan negatif untuk mundur.' },
        ],
        notes: ['WEEKDAY(tanggal; [jenis]) jenis 1: Minggu = 1. Jenis 2: Senin = 1. Jenis 3: Senin = 0.'],
      },
      example: {
        title: 'Tanggal berakhir kontrak',
        description: 'Tanggal mulai dan lama kontrak dalam bulan, lalu hari terakhir kontrak.',
        table: [
          ['Nama', 'Mulai', 'Bulan', 'Berakhir'],
          ['Ani', '=DATE(2026;10;1)', 12, '=EDATE(B2;C2)-1'],
          ['Budi', '=DATE(2026;1;31)', 1, '=EDATE(B3;C3)-1'],
        ],
        formula: '=EDATE(B2;C2)-1',
        result: '30 September 2027 untuk Ani',
        walkthrough: 'EDATE menggeser 1 Oktober 2026 menjadi 1 Oktober 2027, lalu dikurangi satu hari menjadi 30 September 2027.',
      },
      mistakes: [
        { title: 'Lupa mengurangi satu hari', detail: 'Kontrak 12 bulan yang mulai 1 Oktober berakhir 30 September tahun berikutnya, bukan 1 Oktober.' },
        { title: 'Mengira EDATE menambah 30 hari', detail: 'EDATE menambah bulan kalender. Menambah angka 30 ke tanggal menambah hari, dan itu beda.' },
        { title: 'Tanggal berupa teks', detail: 'Tanggal yang diketik sebagai teks tidak dikenali dan memberi #VALUE!. Pastikan selnya tanggal asli.' },
      ],
      playgroundNote: 'Playground belum memiliki format sel, jadi tanggal tampil sebagai nomor serial. Latihan menilai nomor serialnya.',
      quiz: [
        {
          question: 'Apa hasil =EDATE(DATE(2026;1;31);1)?',
          options: ['28 Februari 2026', '31 Februari 2026', '3 Maret 2026', '1 Februari 2026'],
          answerIndex: 0,
          explanation: 'Tanggal 31 tidak ada di Februari, jadi EDATE memakai tanggal terakhir bulan itu, yaitu 28 Februari 2026.',
        },
      ],
    },
  },
];
