import type { LessonDef } from '../types';

/**
 * Pelajaran tambahan: tiga lanjutan PivotTable di modul "Rapi, Aman, dan Ringkas" dan modul "Persiapan Tes Kerja Admin".
 * Pelajaran bertanda `guide` berisi langkah di menu Excel yang tidak bisa disimulasikan di playground; isinya dinilai lewat kuis.
 */
export const lessonsPart6: LessonDef[] = [
  // ------------------------------------------------------------------ lanjutan PivotTable
  {
    slug: 'pivot-hitung-persen',
    moduleSlug: 'rapi-dan-aman',
    title: 'PivotTable: Jumlah, Hitung, Rata-rata, dan Persen',
    summary: 'Ganti cara PivotTable meringkas nilai, tampilkan persen dari total, dan hitung hasil yang sama dengan rumus.',
    minutes: 12,
    sortOrder: 4,
    content: {
      objectives: [
        'Memilih Sum, Count, atau Average di Value Field Settings sesuai pertanyaan yang dijawab.',
        'Menampilkan nilai sebagai persen dari total lewat Show Values As.',
        'Menghitung persen per kategori dengan SUMIF dan referensi absolut.',
      ],
      sections: [
        {
          heading: 'Jumlah, hitung, atau rata-rata',
          paragraphs: [
            'Secara bawaan PivotTable menjumlahkan kolom angka dan menghitung kolom yang berisi teks. Klik kanan sebuah angka di area Values, pilih Value Field Settings, lalu pilih Sum, Count, Average, Max, atau Min.',
            'Kolom angka yang di dalamnya ada sel teks atau sel kosong sering otomatis menjadi Count. Tandanya: totalnya jauh lebih kecil dari yang kamu duga dan judul kolomnya berbunyi "Count of ...". Ganti ke Sum, lalu rapikan datanya.',
            'Pakai Sum untuk uang dan jumlah barang, Count untuk banyaknya transaksi atau orang, dan Average untuk rata-rata per baris. Kolom yang sama boleh ditaruh dua kali di Values bila kamu ingin melihat jumlah dan banyaknya sekaligus.',
          ],
        },
        {
          heading: 'Menampilkan persen',
          paragraphs: [
            'Di jendela Value Field Settings yang sama, buka tab Show Values As. Pilih % of Grand Total untuk porsi terhadap seluruh total, % of Column Total untuk porsi dalam satu kolom, atau % of Row Total untuk porsi dalam satu baris.',
            'Persen dari total menjawab pertanyaan "kategori mana yang paling besar kontribusinya". Periksa hasilnya: semua persen di arah yang kamu pilih harus berjumlah 100%.',
          ],
        },
        {
          heading: 'Persen dengan rumus',
          paragraphs: [
            'Hasil yang sama bisa dihitung dengan rumus: =E2/SUM($E$2:$E$3) untuk porsi tiap kategori. Tanda $ mengunci rentang total supaya rumus bisa disalin ke bawah.',
            'Keunggulan rumus: hasilnya langsung ikut berubah saat data berubah, tanpa klik Refresh. Kelemahannya: kamu sendiri yang menyusun tabel kategorinya.',
          ],
        },
      ],
      example: {
        title: 'Porsi penjualan per kategori',
        description: 'Kolom E menjumlahkan penjualan tiap kategori, kolom F menghitung porsinya terhadap total.',
        table: [
          ['Kategori', 'Penjualan', '', 'Kategori', 'Total', 'Porsi'],
          ['Makanan', 300000, '', 'Makanan', '=SUMIF($A$2:$A$5;D2;$B$2:$B$5)', '=E2/SUM($E$2:$E$3)'],
          ['Minuman', 150000, '', 'Minuman', '=SUMIF($A$2:$A$5;D3;$B$2:$B$5)', '=E3/SUM($E$2:$E$3)'],
          ['Makanan', 100000],
          ['Minuman', 50000],
        ],
        formula: '=E2/SUM($E$2:$E$3)',
        result: '0,727 (72,7%) untuk Makanan',
        walkthrough: 'Makanan 400.000 dari total 550.000 adalah 72,7%. Di Excel, ubah format sel menjadi Percentage supaya tampil 72,7%.',
      },
      mistakes: [
        { title: 'Kolom angka terbaca Count', detail: 'Ada sel teks atau kosong di kolom nilai. Rapikan datanya, lalu ganti Count menjadi Sum.' },
        { title: 'Lupa mengunci total', detail: 'Tulis SUM($E$2:$E$3), bukan SUM(E2:E3). Tanpa $ rentang bergeser saat rumus disalin dan persennya salah.' },
        { title: 'Salah memilih jenis persen', detail: '% of Grand Total dan % of Column Total berbeda bila ada beberapa kolom. Pilih yang sesuai pertanyaan.' },
      ],
      playgroundNote: 'Playground tidak punya PivotTable. Kamu melatih versi rumusnya, yang hasilnya sama dengan pilihan Show Values As.',
      quiz: [
        {
          question: 'Total di PivotTable jauh lebih kecil dari yang diharapkan dan judulnya "Count of Penjualan". Apa yang paling mungkin terjadi?',
          options: [
            'Kolom Penjualan berisi sel teks atau kosong sehingga terbaca Count',
            'PivotTable perlu di-Refresh dua kali',
            'Datanya terlalu banyak',
            'Kolom itu terkunci',
          ],
          answerIndex: 0,
          explanation: 'PivotTable memakai Count untuk kolom yang tidak seluruhnya angka. Rapikan datanya, lalu ganti ke Sum.',
        },
      ],
    },
  },
  {
    slug: 'pivot-tanggal-slicer',
    moduleSlug: 'rapi-dan-aman',
    title: 'PivotTable: Mengelompokkan Tanggal dan Memakai Slicer',
    summary: 'Rekap per bulan atau tahun dari kolom tanggal, dan saring PivotTable dengan tombol yang bisa diklik.',
    minutes: 12,
    sortOrder: 5,
    content: {
      objectives: [
        'Mengelompokkan tanggal menjadi bulan, kuartal, atau tahun di PivotTable.',
        'Menyaring PivotTable dengan Slicer.',
        'Membuat rekap per bulan dengan kolom bantu MONTH dan SUMIF.',
      ],
      sections: [
        {
          heading: 'Mengelompokkan tanggal',
          paragraphs: [
            'Taruh kolom tanggal di area Rows. Excel versi baru biasanya langsung mengelompokkannya menjadi Tahun dan Bulan. Kalau belum, klik kanan salah satu tanggal, pilih Group, lalu pilih Months, Quarters, atau Years. Pilih lebih dari satu satuan bila kamu ingin rekap per bulan dalam tiap tahun.',
            'Syaratnya: semua isi kolom tanggal harus tanggal asli. Satu sel teks atau sel kosong membuat Excel menolak dengan pesan "Cannot group that selection". Periksa dulu dengan ISNUMBER, lalu perbaiki sel yang bermasalah dan klik Refresh.',
          ],
        },
        {
          heading: 'Menyaring dengan Slicer',
          paragraphs: [
            'Slicer adalah deretan tombol filter yang bisa diklik. Klik di dalam PivotTable, buka PivotTable Analyze, pilih Insert Slicer, lalu centang kolom yang ingin dipakai, misalnya Wilayah.',
            'Klik satu tombol untuk menampilkan hanya data itu. Tahan Ctrl untuk memilih beberapa tombol. Ikon corong dengan tanda silang di pojok slicer menghapus filter. Satu slicer bisa dihubungkan ke beberapa PivotTable lewat Report Connections.',
          ],
        },
        {
          heading: 'Rekap per bulan dengan rumus',
          paragraphs: [
            'Tanpa PivotTable: tambahkan kolom bantu =MONTH(A2) di samping data, lalu jumlahkan tiap bulan dengan =SUMIF($C$2:$C$7;E2;$B$2:$B$7). Kolom bantu mudah diperiksa, dan hasilnya ikut berubah otomatis.',
            'Untuk data beberapa tahun, buat dua kolom bantu (YEAR dan MONTH) lalu pakai SUMIFS dengan dua syarat, supaya Januari 2025 tidak bercampur dengan Januari 2026.',
          ],
        },
      ],
      example: {
        title: 'Penjualan per bulan',
        description: 'Kolom C mengambil nomor bulan dari tanggal, kolom F menjumlahkan penjualan tiap bulan.',
        table: [
          ['Tanggal', 'Penjualan', 'Bulan', '', 'Bulan', 'Total'],
          ['=DATE(2026;1;5)', 200000, '=MONTH(A2)', '', 1, '=SUMIF($C$2:$C$5;E2;$B$2:$B$5)'],
          ['=DATE(2026;1;20)', 150000, '=MONTH(A3)', '', 2, '=SUMIF($C$2:$C$5;E3;$B$2:$B$5)'],
          ['=DATE(2026;2;3)', 300000, '=MONTH(A4)'],
          ['=DATE(2026;2;18)', 100000, '=MONTH(A5)'],
        ],
        formula: '=SUMIF($C$2:$C$5;E2;$B$2:$B$5)',
        result: '350000 untuk bulan 1',
        walkthrough: 'Dua penjualan Januari (200.000 dan 150.000) dijumlahkan karena kolom bantu bernilai 1 untuk keduanya.',
      },
      mistakes: [
        { title: 'Tanggal tersimpan sebagai teks', detail: 'Group gagal dan bulan tidak terbaca. Periksa dengan ISNUMBER, lalu ubah ke tanggal asli.' },
        { title: 'Lupa Refresh', detail: 'Data sumber baru tidak muncul di PivotTable sampai kamu klik kanan lalu Refresh.' },
        { title: 'Beberapa tahun dalam satu bulan', detail: 'Rekap per nomor bulan saja mencampur tahun yang berbeda. Tambahkan syarat tahun.' },
      ],
      playgroundNote: 'Playground tidak punya PivotTable atau Slicer. Kamu berlatih versi rumusnya, dan tanggal tampil sebagai nomor serial.',
      quiz: [
        {
          question: 'Excel menolak mengelompokkan tanggal dengan pesan "Cannot group that selection". Penyebab yang paling mungkin?',
          options: [
            'Ada sel di kolom tanggal yang berisi teks atau kosong',
            'Slicer belum dipasang',
            'Tanggalnya terlalu baru',
            'PivotTable harus dihapus dulu',
          ],
          answerIndex: 0,
          explanation: 'Group hanya bekerja bila seluruh isi kolom adalah tanggal asli. Perbaiki sel yang bermasalah lalu Refresh.',
        },
      ],
    },
  },
  {
    slug: 'pivot-grafik',
    moduleSlug: 'rapi-dan-aman',
    title: 'Grafik dari PivotTable: Memilih yang Tepat',
    summary: 'Buat grafik yang ikut berubah dengan PivotTable, dan pilih jenis grafik sesuai pertanyaan.',
    minutes: 10,
    sortOrder: 6,
    content: {
      guide: true,
      objectives: [
        'Membuat PivotChart dari PivotTable.',
        'Memilih grafik kolom, garis, atau pai sesuai pertanyaan.',
        'Menghindari grafik yang menyesatkan.',
      ],
      sections: [
        {
          heading: 'Membuat PivotChart',
          paragraphs: [
            'Klik di dalam PivotTable, buka PivotTable Analyze, lalu pilih PivotChart. Pilih jenis grafiknya dan klik OK. Grafik ini terhubung ke PivotTable: saat kamu menyaring, mengurutkan, atau mengubah susunan PivotTable, grafiknya ikut berubah.',
            'Tombol filter yang muncul di grafik bisa disembunyikan lewat klik kanan, Hide All Field Buttons on Chart, supaya tampilan lebih bersih untuk laporan.',
          ],
        },
        {
          heading: 'Memilih jenis grafik',
          paragraphs: [
            'Grafik kolom membandingkan nilai antar kategori, misalnya penjualan per wilayah. Grafik batang (horizontal) lebih nyaman bila nama kategorinya panjang. Grafik garis menunjukkan tren dari waktu ke waktu, misalnya penjualan per bulan.',
            'Grafik pai hanya untuk porsi dari seluruhnya dan hanya bila kategorinya sedikit, maksimal sekitar lima. Bila hanya satu kategori yang ingin kamu tonjolkan, tidak perlu grafik, cukup tulis angkanya besar-besar.',
          ],
        },
        {
          heading: 'Grafik yang jujur',
          paragraphs: [
            'Mulai sumbu nilai dari nol pada grafik kolom, karena sumbu yang dipotong membuat selisih kecil tampak besar. Beri judul yang menyatakan temuan, label sumbu, dan satuan. Satu grafik menjawab satu pertanyaan.',
            'Urutkan kategori dari terbesar ke terkecil kecuali urutannya memang bermakna, seperti bulan. Hindari efek 3D dan terlalu banyak warna.',
          ],
        },
      ],
      example: {
        title: 'Memilih grafik',
        description: 'Tiga pertanyaan yang sama-sama memakai data penjualan, masing-masing cocok dengan jenis grafik yang berbeda.',
        table: [
          ['Pertanyaan', 'Grafik yang cocok'],
          ['Wilayah mana yang paling laku?', 'Kolom atau batang, diurutkan'],
          ['Bagaimana tren penjualan tiap bulan?', 'Garis'],
          ['Berapa porsi tiap kategori produk?', 'Pai bila kurang dari enam kategori'],
        ],
        formula: 'PivotTable Analyze > PivotChart',
        result: 'Grafik yang ikut berubah mengikuti PivotTable',
        walkthrough: 'Pilih grafik dari pertanyaan yang ingin dijawab, bukan dari jenis yang tampak paling menarik.',
      },
      mistakes: [
        { title: 'Pai untuk banyak kategori', detail: 'Irisan kecil tidak terbaca. Pakai batang yang diurutkan.' },
        { title: 'Sumbu tidak mulai dari nol', detail: 'Selisih kecil tampak besar. Pada grafik kolom, mulai dari nol.' },
        { title: 'Grafik tidak ikut berubah', detail: 'Grafik biasa tidak terhubung ke PivotTable. Pakai PivotChart, dan klik Refresh bila data sumber berubah.' },
      ],
      playgroundNote: 'Grafik tidak ada di playground. Pelajaran ini dikerjakan langsung di Excel-mu.',
      quiz: [
        {
          question: 'Untuk melihat tren penjualan dari Januari sampai Desember, grafik yang paling cocok adalah…',
          options: ['Garis', 'Pai', 'Batang bertumpuk 3D', 'Tidak perlu grafik'],
          answerIndex: 0,
          explanation: 'Grafik garis menunjukkan perubahan dari waktu ke waktu dengan paling jelas.',
        },
      ],
    },
  },

  // ------------------------------------------------------------------ modul Persiapan Tes Kerja Admin
  {
    slug: 'hapus-duplikat',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'Menghapus dan Menandai Data Ganda',
    summary: 'Pakai Remove Duplicates dengan aman, dan tandai data ganda dengan COUNTIF sebelum menghapusnya.',
    minutes: 10,
    sortOrder: 1,
    content: {
      objectives: [
        'Menghapus baris ganda dengan Data > Remove Duplicates.',
        'Menandai data ganda dengan COUNTIF yang rentangnya bertambah.',
        'Menyiapkan data supaya duplikat benar-benar terdeteksi.',
      ],
      sections: [
        {
          heading: 'Remove Duplicates',
          paragraphs: [
            'Klik di dalam daftar, buka tab Data, lalu pilih Remove Duplicates. Centang My data has headers bila baris pertama adalah judul. Pilih kolom yang dipakai untuk menentukan "sama": jika kamu hanya mencentang Nama, dua baris dengan nama sama dianggap ganda walau kolom lain berbeda.',
            'Excel menyimpan baris pertama dan menghapus baris berikutnya yang sama, lalu menampilkan berapa yang dihapus dan berapa yang tersisa. Penghapusan ini permanen. Kerjakan di salinan sheet, atau tekan Ctrl+Z bila hasilnya tidak sesuai.',
          ],
        },
        {
          heading: 'Menandai dulu, menghapus kemudian',
          paragraphs: [
            'Sebelum menghapus, tandai baris ganda supaya bisa diperiksa. Di B2 tulis =IF(COUNTIF($A$2:A2;A2)>1;"Ganda";"Unik"). Ujung atas rentang dikunci ($A$2) tetapi ujung bawah ikut bergeser (A2), jadi tiap baris hanya menghitung kemunculan sampai dirinya sendiri. Kemunculan pertama selalu "Unik", kemunculan berikutnya "Ganda".',
            'Setelah ditandai, saring kolom B dengan "Ganda", periksa barisnya, lalu hapus. Cara ini aman bila dua baris bernama sama ternyata orang yang berbeda.',
          ],
        },
        {
          heading: 'Data harus seragam dulu',
          paragraphs: [
            'Remove Duplicates dan COUNTIF tidak peka huruf besar-kecil, jadi "Budi" dan "budi" dianggap sama. Namun spasi tambahan membuat "Budi" dan "Budi " dianggap berbeda. Bersihkan dulu dengan TRIM.',
            'Untuk sekadar melihat duplikat tanpa rumus, pakai Conditional Formatting: Highlight Cells Rules > Duplicate Values.',
          ],
        },
      ],
      example: {
        title: 'Menandai nama ganda',
        description: 'Kolom B menandai kemunculan kedua dan seterusnya dari nama yang sama.',
        table: [
          ['Nama', 'Status'],
          ['Ani', '=IF(COUNTIF($A$2:A2;A2)>1;"Ganda";"Unik")'],
          ['Budi', '=IF(COUNTIF($A$2:A3;A3)>1;"Ganda";"Unik")'],
          ['Ani', '=IF(COUNTIF($A$2:A4;A4)>1;"Ganda";"Unik")'],
        ],
        formula: '=IF(COUNTIF($A$2:A4;A4)>1;"Ganda";"Unik")',
        result: 'Ganda (untuk Ani yang kedua)',
        walkthrough: 'Sampai baris 4, nama Ani muncul dua kali, jadi COUNTIF bernilai 2 dan lebih dari 1.',
      },
      mistakes: [
        { title: 'Menghapus tanpa memeriksa', detail: 'Dua orang bisa bernama sama. Tandai dan periksa dulu, atau kerjakan di salinan.' },
        { title: 'Mencentang semua kolom', detail: 'Baris hanya dianggap ganda bila semua kolom yang dicentang sama. Pilih kolom yang benar-benar menentukan "sama".' },
        { title: 'Spasi tambahan', detail: '"Budi" dan "Budi " dianggap berbeda. Bersihkan dengan TRIM sebelum mencari duplikat.' },
      ],
      playgroundNote: 'Playground tidak punya tombol Remove Duplicates. Kamu berlatih menandai data ganda dengan rumus, langkah yang sama sebelum menghapus di Excel.',
      quiz: [
        {
          question: 'Pada =COUNTIF($A$2:A2;A2)>1, kenapa ujung bawah rentang tidak dikunci?',
          options: [
            'Supaya tiap baris hanya menghitung kemunculan sampai dirinya sendiri',
            'Supaya rumus tidak bisa disalin',
            'Supaya semua baris dihitung sekaligus',
            'Karena COUNTIF tidak mendukung $',
          ],
          answerIndex: 0,
          explanation: 'Rentang yang bertambah membuat kemunculan pertama bernilai 1 dan baru yang kedua dan seterusnya bernilai lebih dari 1.',
        },
      ],
    },
  },
  {
    slug: 'tabel-ctrl-t',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'Mengubah Data Menjadi Tabel (Ctrl+T)',
    summary: 'Buat Table supaya filter, warna selang-seling, dan rumus ikut melebar saat data bertambah.',
    minutes: 9,
    sortOrder: 2,
    content: {
      guide: true,
      objectives: [
        'Mengubah daftar menjadi Table dengan Ctrl+T.',
        'Menjelaskan manfaat Table dibanding rentang biasa.',
        'Membaca referensi terstruktur seperti Penjualan[Total].',
      ],
      sections: [
        {
          heading: 'Membuat Table',
          paragraphs: [
            'Klik satu sel di dalam daftar, lalu tekan Ctrl+T. Pastikan rentangnya benar dan My table has headers tercentang, lalu klik OK. Daftar langsung bergaya, setiap judul kolom mendapat tombol filter, dan muncul tab Table Design.',
            'Beri nama yang bermakna di Table Design > Table Name, misalnya Penjualan, supaya mudah dirujuk dari rumus.',
          ],
        },
        {
          heading: 'Apa untungnya',
          paragraphs: [
            'Table otomatis melebar saat kamu mengetik di baris tepat di bawahnya, dan rumus kolom serta format ikut disalin. Rumus yang merujuk Table tidak perlu diperbarui ketika data bertambah.',
            'Centang Total Row di Table Design untuk menambah baris total di bawah. Baris itu memakai SUBTOTAL, sehingga ikut menyesuaikan saat tabel difilter. Kamu juga bisa menambahkan Slicer ke Table.',
          ],
        },
        {
          heading: 'Referensi terstruktur',
          paragraphs: [
            'Di dalam Table, rumus memakai nama kolom: =SUM(Penjualan[Total]) menjumlahkan kolom Total, dan =[@Harga]*[@Jumlah] menghitung baris yang sedang dihitung. Nama ini lebih mudah dibaca daripada alamat sel seperti D2:D50.',
            'Untuk kembali ke rentang biasa, pilih Table Design > Convert to Range. Gaya tetap ada tetapi fitur Table hilang.',
          ],
        },
      ],
      example: {
        title: 'Baris baru ikut terhitung',
        description: 'Daftar kecil yang akan dijadikan Table. Rumus Total ditulis sekali, lalu Table menyalinnya ke baris baru.',
        table: [
          ['Barang', 'Harga', 'Jumlah', 'Total'],
          ['Beras', 15000, 2, '=B2*C2'],
          ['Gula', 14000, 3, '=B3*C3'],
        ],
        formula: '=[@Harga]*[@Jumlah]',
        result: 'Setiap baris baru langsung memakai rumus Total yang sama',
        walkthrough: 'Di Table, rumus ditulis dengan nama kolom. Saat baris ketiga diketik, kolom Total terisi dan Table melebar sendiri.',
      },
      mistakes: [
        { title: 'Judul kolom kosong atau kembar', detail: 'Table memberi nama Column1 atau menambah angka di judul kembar. Beri nama yang unik pada tiap kolom sebelum Ctrl+T.' },
        { title: 'Ada baris atau kolom kosong di tengah data', detail: 'Rentang yang terdeteksi terpotong. Hapus baris kosong dulu atau pilih rentangnya sendiri.' },
        { title: 'Sel gabungan di dalam data', detail: 'Table tidak bisa memuat sel yang digabung. Lepas gabungannya.' },
      ],
      playgroundNote: 'Table dan referensi terstruktur tidak ada di playground. Kamu mencobanya langsung di Excel-mu.',
      quiz: [
        {
          question: 'Keuntungan utama mengubah daftar menjadi Table adalah…',
          options: [
            'Filter, format, dan rumus kolom ikut melebar saat baris bertambah',
            'Datanya otomatis dihapus bila ganda',
            'File menjadi lebih kecil',
            'Rumus tidak bisa salah',
          ],
          answerIndex: 0,
          explanation: 'Table tumbuh bersama datanya, jadi rumus dan tampilan tidak perlu diperbaiki setiap ada baris baru.',
        },
      ],
    },
  },
  {
    slug: 'paste-special',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'Paste Special: Tempel Nilai, Format, dan Transpose',
    summary: 'Tempel hanya yang kamu butuh: hasil rumus sebagai angka, format saja, atau data yang diputar.',
    minutes: 9,
    sortOrder: 3,
    content: {
      guide: true,
      objectives: [
        'Menempel hasil rumus sebagai nilai tetap dengan Paste Values.',
        'Memakai Transpose dan operasi Multiply di Paste Special.',
        'Menghafal Ctrl+Alt+V.',
      ],
      sections: [
        {
          heading: 'Membuka Paste Special',
          paragraphs: [
            'Salin sel dengan Ctrl+C, lalu tekan Ctrl+Alt+V atau buka Home > Paste > Paste Special. Pilihan yang paling sering dipakai: Values (hasil rumus menjadi angka biasa), Formats (hanya tampilan), Formulas (rumus tanpa format), dan Column widths.',
            'Cara cepat tempel nilai: Ctrl+Alt+V, tekan V, lalu Enter. Berguna sebelum mengirim file agar rumus dan referensi ke file lain tidak ikut.',
          ],
        },
        {
          heading: 'Transpose dan Operations',
          paragraphs: [
            'Transpose memutar data: baris menjadi kolom dan sebaliknya. Cocok bila tabel perlu dibalik tanpa mengetik ulang.',
            'Di bagian Operation kamu bisa menambah, mengurangi, mengalikan, atau membagi seluruh rentang dengan satu angka. Contoh menaikkan semua harga 10%: ketik 1,1 di sel kosong, salin, pilih kolom harga, buka Paste Special, pilih Multiply, lalu OK.',
          ],
        },
        {
          heading: 'Hati-hati dengan Values',
          paragraphs: [
            'Setelah menempel nilai, sel tidak lagi berubah mengikuti data asalnya. Simpan salinan file bila kamu masih membutuhkan rumusnya.',
            'Paste Values tidak membawa format angka. Pilih Values & Number Formatting atau Values & Source Formatting bila tampilan harus ikut.',
          ],
        },
      ],
      example: {
        title: 'Rumus menjadi nilai',
        description: 'Kolom B berisi rumus. Setelah Paste Values, selnya berisi angka tetap yang tidak berubah lagi.',
        table: [
          ['Harga', 'Harga naik 10%'],
          [10000, '=A2*1.1'],
          [20000, '=A3*1.1'],
        ],
        formula: 'Ctrl+C, Ctrl+Alt+V, V, Enter',
        result: '11000 dan 22000 sebagai angka tetap',
        walkthrough: 'Sel yang sebelumnya berisi =A2*1.1 sekarang berisi angka 11000 saja.',
      },
      mistakes: [
        { title: 'Menempel nilai lalu data asal berubah', detail: 'Hasil tempelan tidak ikut berubah. Tempel nilai hanya bila datanya sudah final.' },
        { title: 'Lupa menekan Esc', detail: 'Garis putus-putus di sel salinan menandakan mode salin masih aktif. Tekan Esc setelah selesai.' },
        { title: 'Menempel di atas rentang yang salah', detail: 'Paste Special menimpa isi sel tujuan. Periksa sel yang kamu pilih sebelum menekan OK.' },
      ],
      playgroundNote: 'Paste Special tidak ada di playground. Kamu mencobanya di Excel-mu.',
      quiz: [
        {
          question: 'Cara menaikkan semua harga di kolom B sebesar 10% tanpa mengetik rumus adalah…',
          options: [
            'Salin sel berisi 1,1 lalu Paste Special > Multiply ke kolom harga',
            'Paste Special > Transpose',
            'Paste Special > Formats',
            'Ctrl+T pada kolom harga',
          ],
          answerIndex: 0,
          explanation: 'Operasi Multiply mengalikan setiap sel tujuan dengan angka yang disalin.',
        },
      ],
    },
  },
  {
    slug: 'cari-ganti-isi-cepat',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'Find and Replace, Flash Fill, dan Text to Columns',
    summary: 'Rapikan dan pecah teks dalam jumlah besar tanpa menulis rumus satu per satu.',
    minutes: 10,
    sortOrder: 4,
    content: {
      guide: true,
      objectives: [
        'Mengganti teks sekaligus dengan Ctrl+H.',
        'Memisah atau menggabung teks dengan Flash Fill (Ctrl+E).',
        'Memecah satu kolom menjadi beberapa dengan Text to Columns.',
      ],
      sections: [
        {
          heading: 'Find and Replace',
          paragraphs: [
            'Tekan Ctrl+H, isi Find what dan Replace with. Klik Options untuk memilih Match case, Match entire cell contents, dan apakah pencarian di sheet atau seluruh workbook. Tanpa Match entire cell contents, mengganti "Jkt" juga mengubah bagian dari kata lain.',
            'Tanda * mewakili sejumlah karakter dan ? mewakili satu karakter. Untuk mencari tanda * atau ? itu sendiri, tulis ~* atau ~?. Pilih sel atau kolom dulu supaya penggantian hanya terjadi di sana, dan periksa dengan Find All sebelum Replace All.',
          ],
        },
        {
          heading: 'Flash Fill',
          paragraphs: [
            'Ketik contoh hasil di kolom sebelah baris pertama, misalnya "Budi" di samping "Budi Santoso", lalu tekan Ctrl+E atau pilih Data > Flash Fill. Excel mengenali pola dan mengisi sisanya.',
            'Hasil Flash Fill berupa nilai tetap, bukan rumus, jadi tidak ikut berubah bila data asli diubah. Bila polanya tidak terbaca, beri satu atau dua contoh lagi lalu ulangi.',
          ],
        },
        {
          heading: 'Text to Columns',
          paragraphs: [
            'Pilih kolom, buka Data > Text to Columns, pilih Delimited, lalu centang pemisahnya: koma, titik koma, spasi, atau lainnya. Pada langkah terakhir, atur kolom berisi kode berawalan nol menjadi Text supaya nolnya tidak hilang.',
            'Hasilnya menimpa kolom di sebelah kanan, jadi pastikan kolom itu kosong atau ubah Destination. Untuk pemecahan yang harus tetap otomatis, pakai rumus LEFT, MID, dan FIND dari pelajaran teks.',
          ],
        },
      ],
      example: {
        title: 'Memecah nama dan divisi',
        description: 'Satu kolom berisi "nama - divisi". Text to Columns dengan pemisah " - " memecahnya menjadi dua kolom.',
        table: [
          ['Data', 'Nama', 'Divisi'],
          ['Budi Santoso - Admin', 'Budi Santoso', 'Admin'],
          ['Citra Dewi - Gudang', 'Citra Dewi', 'Gudang'],
        ],
        formula: 'Data > Text to Columns > Delimited',
        result: 'Nama dan Divisi terpisah di dua kolom',
        walkthrough: 'Pilih kolom Data, pakai pemisah Other dengan isian " - ", lalu atur tujuan ke kolom kosong.',
      },
      mistakes: [
        { title: 'Replace All tanpa memeriksa', detail: 'Penggantian bisa mengenai teks yang tidak dimaksud. Cek dengan Find All dulu.' },
        { title: 'Mengira Flash Fill adalah rumus', detail: 'Hasilnya nilai tetap. Bila data asal berubah, ulangi Flash Fill.' },
        { title: 'Text to Columns menimpa data di sebelah kanan', detail: 'Kosongkan kolom tujuan atau ubah Destination sebelum menekan Finish.' },
      ],
      playgroundNote: 'Fitur menu seperti ini tidak ada di playground. Untuk versi rumusnya, lihat pelajaran fungsi teks dan SUBSTITUTE.',
      quiz: [
        {
          question: 'Sifat hasil Flash Fill yang perlu kamu ingat adalah…',
          options: [
            'Berupa nilai tetap, tidak ikut berubah bila data asal diubah',
            'Berupa rumus yang selalu diperbarui',
            'Hanya bekerja untuk angka',
            'Menghapus kolom asal',
          ],
          answerIndex: 0,
          explanation: 'Flash Fill menulis nilai, bukan rumus. Untuk hasil yang otomatis, pakai rumus teks.',
        },
      ],
    },
  },
  {
    slug: 'siap-cetak',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'Menyiapkan Lembar Kerja untuk Dicetak',
    summary: 'Atur area cetak, orientasi, judul berulang, dan nomor halaman supaya hasil cetak rapi.',
    minutes: 9,
    sortOrder: 6,
    content: {
      guide: true,
      objectives: [
        'Menentukan Print Area dan orientasi kertas.',
        'Membuat judul kolom tercetak di setiap halaman.',
        'Mengecilkan tabel agar lebar muat satu halaman.',
      ],
      sections: [
        {
          heading: 'Area dan orientasi',
          paragraphs: [
            'Pilih rentang yang ingin dicetak, buka Page Layout > Print Area > Set Print Area. Atur Orientation menjadi Landscape untuk tabel yang lebar, dan Size menjadi A4. Tekan Ctrl+P untuk melihat pratinjau sebelum mencetak.',
            'Pakai View > Page Break Preview untuk melihat garis pemisah halaman. Garis biru bisa diseret agar halaman terpotong di tempat yang tepat.',
          ],
        },
        {
          heading: 'Judul berulang dan muat satu halaman',
          paragraphs: [
            'Untuk daftar yang panjang, pilih Page Layout > Print Titles, lalu isi Rows to repeat at top dengan $1:$1. Judul kolom kini tercetak di setiap halaman.',
            'Di bagian Scale to Fit, atur Width menjadi 1 page dan Height menjadi Automatic. Dengan begitu lebar tabel muat satu halaman dan tingginya mengalir ke halaman berikutnya. Jangan membatasi Height menjadi 1 page untuk daftar panjang karena hurufnya jadi sangat kecil.',
          ],
        },
        {
          heading: 'Header, footer, dan pemeriksaan akhir',
          paragraphs: [
            'Buka Insert > Header & Footer untuk menambah judul laporan, tanggal, dan nomor halaman. Excel menyediakan kode seperti Page &[Page] of &[Pages].',
            'Sebelum mencetak: periksa pratinjau, pastikan tidak ada kolom yang terpotong, dan ingat bahwa baris atau kolom yang disembunyikan tidak ikut tercetak. Kotak Print di Sheet Options menentukan apakah garis kisi dicetak.',
          ],
        },
      ],
      example: {
        title: 'Daftar panjang yang siap cetak',
        description: 'Pengaturan yang biasa diminta dalam tes: judul berulang, muat satu halaman lebarnya, dan nomor halaman.',
        table: [
          ['Pengaturan', 'Nilai'],
          ['Orientation', 'Landscape'],
          ['Rows to repeat at top', '$1:$1'],
          ['Scale to Fit', 'Width 1 page, Height Automatic'],
          ['Footer', 'Page &[Page] of &[Pages]'],
        ],
        formula: 'Page Layout > Print Titles',
        result: 'Setiap halaman memuat judul kolom dan nomor halaman',
        walkthrough: 'Pengaturan ini berlaku per sheet dan tersimpan di file.',
      },
      mistakes: [
        { title: 'Tidak melihat pratinjau', detail: 'Kolom terakhir sering terpotong ke halaman lain. Selalu cek Ctrl+P sebelum mencetak.' },
        { title: 'Print Area lama masih aktif', detail: 'Area cetak yang tidak lagi sesuai membuat data baru tidak tercetak. Pilih Clear Print Area bila perlu.' },
        { title: 'Height diatur 1 page', detail: 'Daftar panjang dipaksa muat satu halaman dan hurufnya jadi tidak terbaca. Biarkan Height Automatic.' },
      ],
      playgroundNote: 'Pengaturan cetak tidak ada di playground. Pelajaran ini dikerjakan langsung di Excel-mu.',
      quiz: [
        {
          question: 'Agar judul kolom muncul di setiap halaman cetak, kamu mengisi…',
          options: [
            'Print Titles > Rows to repeat at top',
            'Print Area',
            'Margins',
            'Page Break Preview',
          ],
          answerIndex: 0,
          explanation: 'Rows to repeat at top mengulang baris judul di setiap halaman, misalnya $1:$1.',
        },
      ],
    },
  },
  {
    slug: 'subtotal-countblank',
    moduleSlug: 'persiapan-tes-kerja',
    title: 'SUBTOTAL dan COUNTBLANK: Total yang Ikut Filter',
    summary: 'Hitung total hanya dari baris yang terlihat setelah difilter, dan hitung sel yang belum diisi.',
    minutes: 11,
    sortOrder: 5,
    content: {
      objectives: [
        'Memakai SUBTOTAL supaya total mengikuti filter.',
        'Membedakan SUBTOTAL dan SUM.',
        'Menghitung sel kosong dengan COUNTBLANK.',
      ],
      sections: [
        {
          heading: 'SUBTOTAL: total yang mengikuti filter',
          paragraphs: [
            'SUM selalu menjumlahkan semua sel, termasuk baris yang sedang disembunyikan filter. SUBTOTAL(9; B2:B8) menjumlahkan hanya baris yang terlihat. Saat kamu menyaring Divisi = Admin, totalnya langsung menjadi total gaji divisi Admin saja.',
            'Angka pertama menentukan fungsinya: 9 untuk jumlah, 1 rata-rata, 2 hitung angka, 3 hitung isi, 4 maksimum, 5 minimum, dan 6 perkalian. Kode 101 sampai 111 sama, tetapi juga melewati baris yang disembunyikan manual.',
            'SUBTOTAL mengabaikan sel lain yang juga berisi SUBTOTAL di dalam rentang. Karena itu baris total tidak ikut terhitung dua kali bila rentangnya kebetulan mencakup subtotal lain.',
          ],
        },
        {
          heading: 'COUNTBLANK',
          paragraphs: [
            'COUNTBLANK(B2:B9) menghitung sel kosong. Sel yang berisi teks kosong dari rumus (="") juga terhitung kosong, sedangkan angka 0 tidak. Pasangannya, COUNTA, menghitung sel yang terisi.',
            'Berguna untuk memeriksa kelengkapan data: berapa karyawan yang belum punya NIK, atau berapa tanggal masuk yang belum diisi.',
          ],
        },
        {
          heading: 'Mencobanya di playground',
          paragraphs: [
            'Di latihan, kamu bisa menyalakan filter lewat panah di judul kolom. Setelah memasang SUBTOTAL, saring satu divisi dan lihat totalnya berubah, sedangkan rumus SUM di sebelahnya tetap sama.',
          ],
        },
      ],
      syntax: {
        signature: '=SUBTOTAL(nomor_fungsi; rentang1; [rentang2]; ...)',
        params: [
          { name: 'nomor_fungsi', description: '9 jumlah, 1 rata-rata, 2 hitung angka, 3 hitung isi, 4 maks, 5 min, 6 kali. Tambah 100 untuk melewati baris tersembunyi manual.' },
          { name: 'rentang', description: 'Referensi sel atau rentang yang dijumlah. Angka langsung tidak diterima.' },
        ],
        notes: ['COUNTBLANK(rentang) menghitung sel kosong.'],
      },
      example: {
        title: 'Total gaji yang mengikuti filter',
        description: 'Total pertama memakai SUM (tidak peduli filter), total kedua memakai SUBTOTAL (hanya baris terlihat).',
        table: [
          ['Nama', 'Divisi', 'Gaji', '', 'Jenis total', 'Hasil'],
          ['Ani', 'Admin', 5000000, '', 'SUM', '=SUM(C2:C4)'],
          ['Budi', 'Gudang', 4000000, '', 'SUBTOTAL', '=SUBTOTAL(9;C2:C4)'],
          ['Citra', 'Admin', 6000000],
        ],
        formula: '=SUBTOTAL(9;C2:C4)',
        result: '15000000 tanpa filter, 11000000 bila difilter Divisi = Admin',
        walkthrough: 'Tanpa filter keduanya sama. Setelah difilter, SUM tetap 15.000.000 tetapi SUBTOTAL menjadi 11.000.000 (Ani dan Citra).',
      },
      mistakes: [
        { title: 'Memakai SUM untuk total yang difilter', detail: 'SUM menghitung baris yang tersembunyi juga. Pakai SUBTOTAL bila totalnya harus mengikuti filter.' },
        { title: 'Memberi angka langsung ke SUBTOTAL', detail: 'Argumen setelah nomor fungsi harus referensi sel atau rentang, bukan angka yang diketik.' },
        { title: 'Mengira COUNTBLANK menghitung 0', detail: 'Angka 0 adalah isi sel, bukan kosong. COUNTBLANK hanya menghitung sel kosong dan teks kosong.' },
      ],
      playgroundNote: 'Playground mendukung nomor fungsi 1 sampai 6 dan 9 (serta 101 sampai 106 dan 109) dan melewati baris yang kamu saring.',
      quiz: [
        {
          question: 'Tabel gaji difilter hanya menampilkan divisi Admin. Rumus yang menampilkan total gaji Admin saja adalah…',
          options: ['=SUBTOTAL(9;C2:C50)', '=SUM(C2:C50)', '=COUNTA(C2:C50)', '=COUNTBLANK(C2:C50)'],
          answerIndex: 0,
          explanation: 'SUBTOTAL melewati baris yang disembunyikan filter, sedangkan SUM menjumlahkan semuanya.',
        },
      ],
    },
  },
];
