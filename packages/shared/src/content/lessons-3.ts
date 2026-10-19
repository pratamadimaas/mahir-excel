import type { LessonDef } from '../types';

/** Pelajaran tambahan: ROUND (modul 3), modul 6 (pencarian), modul 7 (teks dan tanggal), modul 8 (rapi, aman, ringkas). */
export const lessonsPart3: LessonDef[] = [
  {
    slug: 'round-pembulatan',
    moduleSlug: 'rumus-dasar',
    title: 'ROUND: Membulatkan Angka',
    summary: 'Bulatkan hasil hitungan ke desimal, satuan, ribuan, atau puluhan ribu.',
    minutes: 8,
    sortOrder: 5,
    content: {
      objectives: [
        'Menulis ROUND dengan jumlah digit positif, nol, dan negatif.',
        'Membedakan pembulatan nilai (ROUND) dengan sekadar format tampilan.',
        'Tahu kapan sebaiknya membulatkan: di hasil akhir, bukan di tengah perhitungan.',
      ],
      sections: [
        {
          heading: 'Tampilan vs nilai',
          paragraphs: [
            'Format sel hanya mengubah tampilan: 84,333 bisa tampil 84,3 padahal nilai di dalam sel tetap 84,333…. ROUND benar-benar mengubah nilainya. Gunakan ROUND bila angka hasil akan dipakai lagi, misalnya untuk menghitung total atau harga yang harus bulat.',
          ],
        },
        {
          heading: 'Arti jumlah digit',
          paragraphs: [
            'Digit positif membulatkan desimal: ROUND(3,14159; 2) menjadi 3,14. Digit 0 membulatkan ke bilangan bulat. Digit negatif membulatkan ke kiri titik desimal: -1 ke puluhan, -2 ke ratusan, -3 ke ribuan.',
            'ROUND membulatkan setengah ke atas (menjauhi nol): 2,5 menjadi 3 dan -2,5 menjadi -3.',
          ],
        },
      ],
      syntax: {
        signature: '=ROUND(angka; [jumlah_digit])',
        params: [
          { name: 'angka', description: 'Angka atau rumus yang dibulatkan.' },
          {
            name: 'jumlah_digit',
            description: 'Opsional, bawaan 0. Positif untuk desimal, 0 untuk bulat, negatif untuk puluhan/ratusan/ribuan.',
          },
        ],
      },
      example: {
        title: 'Harga dibulatkan ke ribuan',
        description: 'Harga hasil hitungan dibulatkan ke ribuan terdekat.',
        table: [
          ['Barang', 'Harga', 'Harga bulat'],
          ['Beras', 15250, '=ROUND(B2,-3)'],
          ['Minyak', 18999, '=ROUND(B3,-3)'],
        ],
        formula: '=ROUND(B3,-3)',
        result: '19000',
        walkthrough: '18999 dibulatkan ke ribuan terdekat menjadi 19000. 15250 menjadi 15000 karena sisa 250 kurang dari 500.',
      },
      mistakes: [
        {
          title: 'Mengira format angka sama dengan ROUND',
          detail:
            'Format hanya mengubah tampilan. Total dari angka yang tampil bulat bisa tampak "meleset" karena nilai aslinya tidak bulat.',
        },
        { title: 'Membulatkan di setiap langkah', detail: 'Pembulatan berulang mengumpulkan selisih. Bulatkan di hasil akhir saja.' },
        {
          title: 'Lupa tanda minus untuk ribuan',
          detail: 'ROUND(B2;3) membulatkan ke tiga desimal, bukan ke ribuan. Untuk ribuan tulis -3.',
        },
      ],
      quiz: [
        {
          question: 'Berapa hasil =ROUND(1234,567; -2)?',
          options: ['1234,57', '1235', '1200', '1230'],
          answerIndex: 2,
          explanation: 'Digit -2 membulatkan ke ratusan terdekat: 1234,567 menjadi 1200.',
        },
        {
          question: 'Apa hasil =ROUND(-2,5; 0)?',
          options: ['-2', '-3', '2', '-2,5'],
          answerIndex: 1,
          explanation: 'ROUND membulatkan setengah menjauhi nol, jadi -2,5 menjadi -3.',
        },
      ],
    },
  },
  {
    slug: 'vlookup-dasar',
    moduleSlug: 'fungsi-pencarian',
    title: 'VLOOKUP: Mengambil Data dari Tabel Acuan',
    summary: 'Cari kode di tabel harga dan ambil nama atau harganya otomatis.',
    minutes: 14,
    sortOrder: 1,
    content: {
      objectives: [
        'Menjelaskan fungsi tabel acuan dan kolom kunci.',
        'Menulis VLOOKUP dengan pencocokan persis (FALSE) dan perkiraan (TRUE).',
        'Mengunci tabel acuan dengan $ dan menangani #N/A dengan IFERROR.',
      ],
      sections: [
        {
          heading: 'Tabel acuan',
          paragraphs: [
            'Banyak pekerjaan Excel berupa menyalin data dari tabel lain: kode barang menjadi nama dan harga, nilai menjadi grade. Alih-alih mengetik ulang, VLOOKUP mencari nilai di kolom paling kiri tabel acuan lalu mengambil isi kolom lain di baris yang sama.',
            'Syarat penting: nilai yang dicari harus berada di kolom pertama tabel acuan.',
          ],
        },
        {
          heading: 'Persis atau perkiraan',
          paragraphs: [
            'Argumen terakhir menentukan cara mencocokkan. FALSE (atau 0) berarti harus persis sama, dan jika tidak ada hasilnya #N/A. TRUE (atau dikosongkan) berarti perkiraan: dicari nilai terbesar yang tidak melebihi nilai yang dicari. Mode perkiraan hanya benar bila kolom pertama diurutkan naik, dan cocok untuk tabel batas seperti grade atau tarif bertingkat.',
            'Hampir selalu pakai FALSE untuk kode atau nama. Lupa mengisinya adalah sumber salah hasil yang paling sering.',
          ],
        },
        {
          heading: 'Kunci tabel dengan $',
          paragraphs: [
            'Tabel acuan tidak boleh ikut bergeser saat rumus disalin ke bawah, jadi tulis $F$2:$H$6. Alamat nilai yang dicari (A2) tetap relatif.',
          ],
        },
      ],
      syntax: {
        signature: '=VLOOKUP(nilai_dicari; tabel; nomor_kolom; [jenis_cocok])',
        params: [
          { name: 'nilai_dicari', description: 'Kunci yang dicari, biasanya referensi sel seperti A2.' },
          { name: 'tabel', description: 'Tabel acuan, kolom pertama berisi kunci. Kunci dengan $.' },
          { name: 'nomor_kolom', description: 'Kolom ke berapa (dihitung dari kolom pertama tabel) yang diambil.' },
          { name: 'jenis_cocok', description: 'FALSE untuk persis. TRUE atau kosong untuk perkiraan pada data terurut naik.' },
        ],
        notes: ['Jika kunci tidak ditemukan hasilnya #N/A. Bungkus dengan IFERROR atau IFNA untuk pesan yang ramah.'],
      },
      example: {
        title: 'Harga dari kode barang',
        description: 'Tabel acuan di F1:H3. Kode di kolom A diganti dengan harganya.',
        table: [
          ['Kode', 'Jumlah', 'Harga', '', 'Kode', 'Nama', 'Harga'],
          ['GLA', 10, '=VLOOKUP(A2,$E$2:$G$3,3,FALSE)', '', 'BRS', 'Beras', 68000],
          ['BRS', 2, '=VLOOKUP(A3,$E$2:$G$3,3,FALSE)', '', 'GLA', 'Gula', 16000],
        ],
        formula: '=VLOOKUP(A2,$E$2:$G$3,3,FALSE)',
        result: '16000',
        walkthrough: 'GLA dicari di kolom pertama E2:E3, ditemukan di baris kedua, lalu diambil kolom ke-3 (Harga): 16000.',
      },
      mistakes: [
        {
          title: 'Lupa FALSE',
          detail: 'Tanpa FALSE, Excel memakai pencocokan perkiraan dan bisa mengembalikan baris yang salah tanpa pesan galat.',
        },
        {
          title: 'Tabel tidak dikunci',
          detail: 'Setelah disalin ke bawah, rentang tabel bergeser dan beberapa baris menjadi #N/A. Gunakan $.',
        },
        {
          title: 'Kunci tidak di kolom pertama',
          detail: 'VLOOKUP hanya mencari di kolom paling kiri tabel. Untuk mencari ke kiri gunakan XLOOKUP atau INDEX-MATCH.',
        },
        { title: 'Angka vs teks', detail: 'Angka 5 dan teks "5" dianggap berbeda. Seragamkan tipe data kunci.' },
      ],
      playgroundNote:
        'Playground mendukung pencocokan persis dan perkiraan dengan wildcard * dan ? pada teks. Perilaku pada data yang tidak terurut untuk pencocokan perkiraan sama seperti Excel: tidak terjamin.',
      quiz: [
        {
          question: 'Agar VLOOKUP hanya menerima kecocokan persis, argumen terakhir diisi…',
          options: ['TRUE', 'FALSE', '1', 'dikosongkan'],
          answerIndex: 1,
          explanation: 'FALSE (atau 0) memaksa pencocokan persis. TRUE atau kosong memakai pencocokan perkiraan.',
        },
        {
          question: 'Pada =VLOOKUP(A2;$E$2:$G$3;3;FALSE), angka 3 berarti…',
          options: ['Baris ke-3', 'Kolom ke-3 dari tabel', 'Kolom C', 'Cari 3 kali'],
          answerIndex: 1,
          explanation: 'Nomor kolom dihitung dari kolom pertama tabel acuan, bukan dari kolom A lembar kerja.',
        },
      ],
    },
  },
  {
    slug: 'xlookup-fleksibel',
    moduleSlug: 'fungsi-pencarian',
    title: 'XLOOKUP: Pencarian yang Lebih Fleksibel',
    summary: 'Cari ke arah mana pun dan tentukan pesan bila data tidak ada.',
    minutes: 12,
    sortOrder: 2,
    content: {
      objectives: [
        'Menulis XLOOKUP dengan rentang pencarian dan rentang hasil terpisah.',
        'Menetapkan nilai pengganti bila data tidak ditemukan.',
        'Mengetahui ketersediaan XLOOKUP pada versi Excel.',
      ],
      sections: [
        {
          heading: 'Dua rentang, bukan satu tabel',
          paragraphs: [
            'XLOOKUP menerima rentang tempat mencari dan rentang tempat mengambil hasil. Keduanya terpisah, jadi hasil boleh berada di kiri maupun kanan kunci, dan tidak perlu menghitung nomor kolom.',
            'Pencocokan bawaannya sudah persis, sehingga tidak ada risiko lupa FALSE seperti pada VLOOKUP.',
          ],
        },
        {
          heading: 'Jika tidak ditemukan',
          paragraphs: [
            'Argumen keempat adalah pesan atau nilai pengganti bila kunci tidak ada, misalnya "Tidak ada". Tanpa itu hasilnya #N/A.',
          ],
        },
        {
          heading: 'Ketersediaan',
          paragraphs: [
            'XLOOKUP tersedia di Microsoft 365, Excel 2021 dan yang lebih baru, serta Excel untuk web. Excel 2019 dan yang lebih lama tidak memilikinya; gunakan VLOOKUP atau INDEX-MATCH di sana.',
          ],
        },
      ],
      syntax: {
        signature: '=XLOOKUP(dicari; rentang_cari; rentang_hasil; [jika_tidak_ada]; [mode_cocok]; [mode_cari])',
        params: [
          { name: 'dicari', description: 'Nilai yang dicari.' },
          { name: 'rentang_cari', description: 'Satu baris atau satu kolom tempat mencari.' },
          { name: 'rentang_hasil', description: 'Rentang dengan panjang sama yang berisi hasil.' },
          { name: 'jika_tidak_ada', description: 'Opsional. Hasil bila tidak ditemukan.' },
          {
            name: 'mode_cocok',
            description:
              'Opsional. 0 persis (bawaan), -1 persis atau terkecil berikutnya yang lebih kecil, 1 persis atau yang lebih besar, 2 wildcard.',
          },
          { name: 'mode_cari', description: 'Opsional. 1 dari awal (bawaan), -1 dari akhir.' },
        ],
      },
      example: {
        title: 'Stok dari kode',
        description: 'Cari kode di A2:A4 dan ambil stok dari B2:B4. Kode yang tidak ada diberi pesan.',
        table: [
          ['Kode', 'Stok', '', 'Dicari', 'Stok'],
          ['BRS', 40, '', 'GLA', '=XLOOKUP(D2,A2:A4,B2:B4,"Tidak ada")'],
          ['GLA', 25, '', 'XYZ', '=XLOOKUP(D3,A2:A4,B2:B4,"Tidak ada")'],
          ['TLR', 12],
        ],
        formula: '=XLOOKUP(D3,A2:A4,B2:B4,"Tidak ada")',
        result: 'Tidak ada',
        walkthrough: 'GLA ditemukan sehingga stoknya (25) tampil. XYZ tidak ada di A2:A4, sehingga tampil pesan pengganti.',
      },
      mistakes: [
        { title: 'Rentang beda panjang', detail: 'Rentang pencarian dan hasil harus sama panjang, jika tidak hasilnya #VALUE!.' },
        {
          title: 'Memakai XLOOKUP di Excel lama',
          detail: 'File dengan XLOOKUP akan menampilkan #NAME? di Excel 2019 ke bawah. Periksa versi pengguna lain.',
        },
        {
          title: 'Memilih seluruh tabel sebagai rentang hasil',
          detail: 'Di Excel 365 hasil dua kolom "tumpah" ke beberapa sel. Playground hanya mendukung satu sel hasil.',
        },
      ],
      playgroundNote:
        'Playground mendukung rentang satu baris atau satu kolom, mode cocok 0, -1, 1, 2 dan mode cari 1 atau -1. Pencarian biner dan hasil yang tumpah ke beberapa sel belum didukung.',
      quiz: [
        {
          question: 'Keunggulan XLOOKUP dibanding VLOOKUP adalah…',
          options: [
            'Hanya bisa mencari angka',
            'Bisa mengambil hasil di kiri kunci dan punya pesan bila tidak ada',
            'Selalu lebih cepat',
            'Tidak butuh rentang',
          ],
          answerIndex: 1,
          explanation: 'XLOOKUP memisahkan rentang cari dan hasil, jadi bebas arah, dan punya argumen jika_tidak_ada.',
        },
      ],
    },
  },
  {
    slug: 'index-match',
    moduleSlug: 'fungsi-pencarian',
    title: 'INDEX dan MATCH',
    summary: 'Gabungan klasik untuk mencari ke kiri dan bekerja di semua versi Excel.',
    minutes: 14,
    sortOrder: 3,
    content: {
      objectives: [
        'Menjelaskan peran MATCH (mencari posisi) dan INDEX (mengambil isi berdasarkan posisi).',
        'Menggabungkan keduanya untuk mengambil data dari kolom di kiri kunci.',
        'Memakai MATCH dengan tipe 0 untuk pencocokan persis.',
      ],
      sections: [
        {
          heading: 'Dua fungsi kecil yang saling melengkapi',
          paragraphs: [
            'MATCH menjawab "di urutan ke berapa nilai ini berada dalam daftar?". INDEX menjawab "apa isi sel di urutan ke-n pada rentang ini?". Digabung, MATCH menemukan posisinya dan INDEX mengambil isi pada posisi itu.',
          ],
        },
        {
          heading: 'Kenapa dipakai',
          paragraphs: [
            'Rentang hasil dan rentang pencarian terpisah, jadi hasil boleh berada di kiri kunci (hal yang tidak bisa dilakukan VLOOKUP). Menyisipkan kolom di tabel juga tidak merusak rumus. INDEX-MATCH berjalan di semua versi Excel, termasuk yang tidak punya XLOOKUP.',
          ],
        },
      ],
      syntax: {
        signature: '=MATCH(dicari; rentang; [tipe])   =INDEX(rentang; nomor_baris; [nomor_kolom])',
        params: [
          {
            name: 'tipe (MATCH)',
            description:
              '0 persis (hampir selalu ini), 1 terbesar yang tidak melebihi (data naik), -1 terkecil yang tidak kurang (data turun).',
          },
          { name: 'nomor_baris (INDEX)', description: 'Baris ke berapa dalam rentang. Pada rentang satu kolom ini sudah cukup.' },
        ],
        notes: ['Pola umum: =INDEX(rentang_hasil; MATCH(dicari; rentang_cari; 0))'],
      },
      example: {
        title: 'Harga dari kode, harga di kiri',
        description: 'Harga ada di kolom A dan kode di kolom B. VLOOKUP tidak bisa melihat ke kiri, INDEX-MATCH bisa.',
        table: [
          ['Harga', 'Kode', '', 'Dicari', 'Harga'],
          [68000, 'BRS', '', 'GLA', '=INDEX(A2:A4,MATCH(D2,B2:B4,0))'],
          [16000, 'GLA'],
          [28000, 'TLR'],
        ],
        formula: '=INDEX(A2:A4,MATCH(D2,B2:B4,0))',
        result: '16000',
        walkthrough: 'MATCH("GLA";B2:B4;0) menghasilkan 2 (urutan kedua). INDEX(A2:A4;2) mengambil sel kedua di kolom harga: 16000.',
      },
      mistakes: [
        {
          title: 'Lupa tipe 0',
          detail: 'Tanpa 0 MATCH memakai pencocokan perkiraan dan bisa menghasilkan posisi yang salah pada data tidak terurut.',
        },
        { title: 'Rentang tidak sejajar', detail: 'Rentang di INDEX dan di MATCH harus dimulai dari baris yang sama dan sama panjang.' },
        {
          title: 'Memakai nomor 0 pada INDEX',
          detail: 'Di Excel, nomor 0 mengambil satu baris/kolom penuh. Playground belum mendukung itu dan menampilkan galat.',
        },
      ],
      playgroundNote:
        'MATCH di playground memerlukan rentang satu baris atau satu kolom. INDEX dengan nomor baris atau kolom 0 belum didukung.',
      quiz: [
        {
          question: 'MATCH("TLR"; B2:B4; 0) menghasilkan 3 bila "TLR" ada di B4. Artinya…',
          options: ['Sel B3', 'Posisi ke-3 dalam rentang', 'Nilai 3 di sel', 'Harga 3'],
          answerIndex: 1,
          explanation: 'MATCH mengembalikan nomor urut posisi dalam rentang, bukan isi sel.',
        },
      ],
    },
  },
  {
    slug: 'fungsi-teks',
    moduleSlug: 'teks-tanggal',
    title: 'Fungsi Teks: Merapikan dan Memotong Teks',
    summary: 'LEFT, RIGHT, MID, LEN, TRIM, UPPER, LOWER, dan PROPER untuk data yang berantakan.',
    minutes: 12,
    sortOrder: 1,
    content: {
      objectives: [
        'Memotong teks dengan LEFT, RIGHT, dan MID.',
        'Merapikan spasi dan huruf besar-kecil dengan TRIM, UPPER, LOWER, dan PROPER.',
        'Menggabungkan fungsi teks dan operator & untuk membentuk teks baru.',
      ],
      sections: [
        {
          heading: 'Memotong teks',
          paragraphs: [
            'LEFT(teks; n) mengambil n karakter dari kiri, RIGHT dari kanan, dan MID(teks; awal; panjang) dari posisi tertentu (posisi pertama adalah 1). LEN menghitung jumlah karakter, termasuk spasi.',
            'Contoh: dari kode BRS-2025-001, LEFT(A2;3) = BRS, MID(A2;5;4) = 2025, RIGHT(A2;3) = 001. Hasilnya berupa teks, bahkan bila tampak seperti angka.',
          ],
        },
        {
          heading: 'Merapikan teks',
          paragraphs: [
            'TRIM membuang spasi di awal dan akhir serta menyisakan satu spasi di antara kata. UPPER membuat huruf besar semua, LOWER huruf kecil semua, dan PROPER huruf besar di awal tiap kata. Kombinasi PROPER(TRIM(A2)) adalah resep standar merapikan nama.',
          ],
        },
        {
          heading: 'Menyambung teks',
          paragraphs: ['Operator & menyambung teks: =LEFT(A2;3)&"-"&RIGHT(A2;3). Teks literal harus berada di antara tanda kutip.'],
        },
      ],
      syntax: {
        signature: '=LEFT(teks; [n])   =RIGHT(teks; [n])   =MID(teks; awal; panjang)   =LEN(teks)   =TRIM(teks)   =PROPER(teks)',
        params: [
          { name: 'teks', description: 'Teks atau sel yang diolah.' },
          { name: 'n', description: 'Jumlah karakter. Bila dikosongkan, 1.' },
        ],
      },
      example: {
        title: 'Merapikan nama',
        description: 'Nama dari formulir sering berspasi ganda dan huruf besar-kecil acak.',
        table: [
          ['Nama mentah', 'Nama rapi'],
          ['  budi   SANTOSO ', '=PROPER(TRIM(A2))'],
          ['siti aminah', '=PROPER(TRIM(A3))'],
        ],
        formula: '=PROPER(TRIM(A2))',
        result: 'Budi Santoso',
        walkthrough:
          'TRIM membuang spasi berlebih menjadi "budi SANTOSO", lalu PROPER membuat huruf pertama tiap kata besar dan sisanya kecil.',
      },
      mistakes: [
        {
          title: 'Mengira hasil LEFT/MID berupa angka',
          detail:
            'MID("2025-001";1;4) menghasilkan teks "2025". Untuk menghitung dengan hasilnya, ubah dulu menjadi angka (misalnya dengan mengalikan 1).',
        },
        { title: 'Posisi awal 0 pada MID', detail: 'Posisi dihitung dari 1. MID(teks;0;3) menghasilkan #VALUE!.' },
        { title: 'Menghapus spasi manual', detail: 'Spasi tak terlihat di akhir teks merusak pencarian. Pakai TRIM, jangan menebak.' },
      ],
      playgroundNote:
        'Angka diubah menjadi teks dengan titik desimal (3.5), sedangkan Excel mengikuti pengaturan regional. Fungsi teks lain seperti TEXT, SUBSTITUTE, dan FIND belum didukung.',
      quiz: [
        {
          question: 'Apa hasil =LEN(TRIM("  Jakarta  Selatan "))?',
          options: ['19', '16', '15', '14'],
          answerIndex: 2,
          explanation: 'TRIM menghasilkan "Jakarta Selatan" (spasi ganda jadi satu), yaitu 15 karakter.',
        },
      ],
    },
  },
  {
    slug: 'fungsi-tanggal',
    moduleSlug: 'teks-tanggal',
    title: 'Fungsi Tanggal: DATE, YEAR, MONTH, DAY',
    summary: 'Hitung selisih hari, ambil tahun dan bulan, dan susun tanggal dari potongan.',
    minutes: 12,
    sortOrder: 2,
    content: {
      objectives: [
        'Menjelaskan bahwa tanggal di Excel adalah angka urut (serial).',
        'Memakai DATE, YEAR, MONTH, dan DAY.',
        'Menghitung selisih hari dan tanggal jatuh tempo dengan operator + dan -.',
      ],
      sections: [
        {
          heading: 'Tanggal adalah angka',
          paragraphs: [
            'Excel menyimpan tanggal sebagai nomor urut hari sejak 1 Januari 1900. Karena itu tanggal bisa dijumlah dan dikurangi: tanggal ditambah 30 adalah 30 hari kemudian, dan selisih dua tanggal adalah jumlah harinya.',
            'Bila hasil perhitungan tanggal tampil sebagai angka lima digit (misalnya 46312), ubah format selnya menjadi Tanggal. Angkanya sendiri sudah benar.',
          ],
        },
        {
          heading: 'Membongkar dan menyusun',
          paragraphs: [
            'YEAR, MONTH, dan DAY mengambil bagian tanggal. DATE(tahun; bulan; hari) menyusunnya kembali, dan otomatis menggeser bulan atau hari yang berlebih: DATE(2026;14;1) menjadi Februari 2027.',
            'TODAY() menghasilkan tanggal hari ini dan berubah setiap hari saat file dibuka. Jangan memakainya untuk tanggal yang harus tetap.',
          ],
        },
      ],
      syntax: {
        signature: '=DATE(tahun; bulan; hari)   =YEAR(tanggal)   =MONTH(tanggal)   =DAY(tanggal)   =TODAY()',
        params: [{ name: 'tanggal', description: 'Sel berisi tanggal (angka serial) atau hasil DATE.' }],
      },
      example: {
        title: 'Jatuh tempo 30 hari',
        description: 'Tanggal faktur ditambah 30 hari memberi tanggal jatuh tempo. Selisih tanggal memberi lama dalam hari.',
        table: [
          ['Tahun', 'Bulan', 'Hari', 'Faktur', 'Jatuh tempo'],
          [2026, 10, 17, '=DATE(A2,B2,C2)', '=D2+30'],
        ],
        formula: '=D2+30',
        result: '46342 (tampil 16 November 2026 bila diformat sebagai tanggal)',
        walkthrough: 'DATE(2026;10;17) menghasilkan 46312. Ditambah 30 menjadi 46342, yaitu 16 November 2026.',
      },
      mistakes: [
        {
          title: 'Mengetik tanggal sebagai teks',
          detail: 'Teks "17/10/2026" belum tentu dikenali sebagai tanggal; hasilnya tergantung pengaturan regional. Susun dengan DATE.',
        },
        {
          title: 'Memakai TODAY untuk catatan tetap',
          detail: 'TODAY ikut berubah. Untuk tanggal catatan, ketik tanggalnya atau gunakan Ctrl+;.',
        },
        {
          title: 'Lupa mengubah format hasil',
          detail: 'Hasil tanggal yang tampil seperti angka biasa adalah normal sampai selnya diformat sebagai tanggal.',
        },
      ],
      playgroundNote:
        'Playground belum memiliki format sel, sehingga tanggal tampil sebagai nomor serial. Latihan tetap menilai angka serialnya. DATEDIF, EDATE, dan EOMONTH belum didukung.',
      quiz: [
        {
          question: 'Bagaimana menghitung jumlah hari dari tanggal di A2 sampai tanggal di B2?',
          options: ['=A2+B2', '=B2-A2', '=DAY(B2)', '=DATE(A2;B2)'],
          answerIndex: 1,
          explanation: 'Tanggal adalah angka, jadi cukup dikurangkan: tanggal akhir dikurangi tanggal awal.',
        },
      ],
    },
  },
  {
    slug: 'data-validation',
    moduleSlug: 'rapi-dan-aman',
    title: 'Data Validation: Mencegah Data Salah',
    summary: 'Batasi isi sel dan pahami aturan sebagai rumus yang bernilai benar atau salah.',
    minutes: 12,
    sortOrder: 1,
    content: {
      objectives: [
        'Menjelaskan tujuan Data Validation dan jenis aturannya.',
        'Menulis aturan khusus sebagai rumus yang menghasilkan TRUE atau FALSE.',
        'Mengetahui batas Data Validation (mis. tempel data bisa melewatinya).',
      ],
      sections: [
        {
          heading: 'Mencegah lebih baik daripada merapikan',
          paragraphs: [
            'Banyak data berantakan berawal dari isian bebas. Data Validation (tab Data) membatasi apa yang boleh diketik: daftar pilihan (misalnya kota), angka bulat atau desimal dalam rentang, tanggal, panjang teks, atau aturan khusus berupa rumus.',
            'Pesan input memberi petunjuk saat sel dipilih, dan pesan galat muncul bila isian ditolak. Fitur "Circle Invalid Data" menandai data lama yang melanggar aturan.',
          ],
        },
        {
          heading: 'Aturan khusus adalah rumus',
          paragraphs: [
            'Pada pilihan Custom, kamu menulis rumus yang bernilai TRUE bila isian valid. Rumus ditulis untuk sel kiri atas rentang, dan referensi relatifnya otomatis menyesuaikan untuk sel lain. Contoh: umur peserta harus 17 sampai 60 memakai =AND(B2>=17;B2<=60).',
            'Cara terbaik berlatih adalah menulis rumus aturannya di kolom bantu dan melihat hasil TRUE atau FALSE. Itulah yang dilakukan latihan di bawah.',
          ],
        },
        {
          heading: 'Batasannya',
          paragraphs: [
            'Menempel (paste) data dari tempat lain dapat melewati aturan validasi. Validasi juga tidak memeriksa data yang sudah ada sebelumnya kecuali kamu menjalankan Circle Invalid Data.',
          ],
        },
      ],
      example: {
        title: 'Aturan umur peserta',
        description: 'Kolom C memperlihatkan hasil aturan: TRUE bila umur valid.',
        table: [
          ['Nama', 'Umur', 'Valid?'],
          ['Ani', 17, '=AND(B2>=17,B2<=60)'],
          ['Beni', 15, '=AND(B3>=17,B3<=60)'],
        ],
        formula: '=AND(B2>=17,B2<=60)',
        result: 'TRUE untuk Ani, FALSE untuk Beni',
        walkthrough: 'Aturan yang sama dipakai di Data Validation (Custom) untuk menolak umur 15 saat diketik.',
      },
      mistakes: [
        {
          title: 'Aturan ditulis untuk sel yang salah',
          detail: 'Rumus Custom ditulis relatif terhadap sel kiri atas rentang yang dipilih. Pilih rentang dulu, baru tulis aturan.',
        },
        {
          title: 'Mengandalkan validasi untuk data tempelan',
          detail: 'Tempel bisa melewati aturan. Untuk data penting tambahkan pemeriksaan dengan rumus.',
        },
        { title: 'Pesan galat tidak menjelaskan', detail: 'Tulis pesan yang menyebut batas yang berlaku, bukan sekadar "Salah".' },
      ],
      playgroundNote:
        'Playground tidak memiliki menu Data Validation. Kamu berlatih bagian yang paling penting: menulis rumus aturan yang menghasilkan TRUE atau FALSE.',
      quiz: [
        {
          question: 'Pada aturan Custom Data Validation, isian dianggap valid bila rumus menghasilkan…',
          options: ['0', 'FALSE', 'TRUE', 'teks kosong'],
          answerIndex: 2,
          explanation: 'Rumus aturan khusus harus bernilai TRUE agar isian diterima.',
        },
      ],
    },
  },
  {
    slug: 'conditional-formatting',
    moduleSlug: 'rapi-dan-aman',
    title: 'Conditional Formatting: Menandai Sel Otomatis',
    summary: 'Warnai data bermasalah dengan aturan berbentuk rumus.',
    minutes: 12,
    sortOrder: 2,
    content: {
      objectives: [
        'Menjelaskan fungsi Conditional Formatting.',
        'Menulis aturan berbasis rumus untuk stok rendah dan data ganda.',
        'Memakai referensi campuran ($) agar satu aturan mewarnai seluruh baris.',
      ],
      sections: [
        {
          heading: 'Warna yang mengikuti data',
          paragraphs: [
            'Conditional Formatting (tab Home) mengubah tampilan sel secara otomatis bila syarat terpenuhi: warna latar, huruf, atau ikon. Saat data berubah, tandanya ikut berubah, jadi tidak perlu mewarnai manual.',
            'Aturan bawaan mencakup nilai di atas/di bawah angka tertentu, duplikat, dan skala warna. Untuk kebutuhan sendiri pakai "Use a formula to determine which cells to format".',
          ],
        },
        {
          heading: 'Aturan berbentuk rumus',
          paragraphs: [
            'Rumus aturan harus menghasilkan TRUE untuk sel yang akan ditandai, dan ditulis untuk sel kiri atas rentang. Contoh stok rendah: =B2<C2 (stok kurang dari minimum). Contoh data ganda: =COUNTIF($A$2:$A$7;A2)>1.',
            'Untuk menandai satu baris penuh berdasarkan satu kolom, kunci kolomnya dengan $: =$B2<$C2. Tanpa $, warna bergeser ke kolom lain.',
          ],
        },
        {
          heading: 'Jangan hanya warna',
          paragraphs: [
            'Sebagian orang tidak membedakan warna dengan baik. Tambahkan petunjuk lain seperti teks "Restok" atau ikon agar informasi tidak bergantung pada warna saja.',
          ],
        },
      ],
      example: {
        title: 'Aturan stok rendah',
        description: 'Kolom D menampilkan hasil aturan: TRUE untuk barang yang perlu restok.',
        table: [
          ['Barang', 'Stok', 'Minimum', 'Restok?'],
          ['Beras', 8, 10, '=B2<C2'],
          ['Gula', 30, 20, '=B3<C3'],
        ],
        formula: '=B2<C2',
        result: 'TRUE untuk Beras, FALSE untuk Gula',
        walkthrough: 'Aturan yang sama dipasang sebagai Conditional Formatting pada B2:B3 sehingga Beras diwarnai.',
      },
      mistakes: [
        { title: 'Lupa mengunci kolom/baris', detail: 'Aturan untuk satu baris penuh perlu $ pada kolom pembanding, misalnya =$B2<$C2.' },
        { title: 'Aturan menumpuk', detail: 'Banyak aturan pada rentang yang sama saling menimpa. Periksa di Manage Rules.' },
        { title: 'Mengandalkan warna saja', detail: 'Pasangkan dengan teks atau ikon untuk aksesibilitas.' },
      ],
      playgroundNote:
        'Playground tidak mewarnai sel. Kamu berlatih menulis rumus aturannya, yang sama persis dengan yang diketik di Excel.',
      quiz: [
        {
          question: 'Rumus aturan untuk menandai nilai ganda pada A2:A7 yang tepat adalah…',
          options: ['=COUNTIF(A2:A7;A2)', '=COUNTIF($A$2:$A$7;A2)>1', '=A2=A3', '=SUM(A2:A7)>1'],
          answerIndex: 1,
          explanation: 'Rentang dikunci dengan $, A2 relatif, dan >1 membuat hasilnya TRUE bila muncul lebih dari sekali.',
        },
      ],
    },
  },
  {
    slug: 'pivottable-grafik',
    moduleSlug: 'rapi-dan-aman',
    title: 'PivotTable dan Grafik: Meringkas Data',
    summary: 'Pahami cara kerja PivotTable dan bangun ringkasan setara dengan SUMIFS.',
    minutes: 14,
    sortOrder: 3,
    content: {
      objectives: [
        'Menjelaskan area Rows, Columns, dan Values pada PivotTable.',
        'Membangun tabel ringkasan setara PivotTable dengan SUMIFS dan referensi campuran.',
        'Memilih jenis grafik yang sesuai dengan pertanyaan yang dijawab.',
      ],
      sections: [
        {
          heading: 'Apa itu PivotTable',
          paragraphs: [
            'PivotTable meringkas data mentah tanpa rumus: pilih kolom untuk baris (misalnya Wilayah), kolom (Kategori), dan nilai yang dijumlahkan (Penjualan). Buat lewat Insert > PivotTable, lalu seret kolom ke area yang diinginkan. Bila data sumber berubah, klik Refresh.',
            'Kelebihannya cepat dan mudah diubah susunannya. Kekurangannya: tidak otomatis menyesuaikan tanpa Refresh, dan susunannya tidak bisa dibuat serumit rumus buatan sendiri.',
          ],
        },
        {
          heading: 'Ringkasan dengan rumus',
          paragraphs: [
            'Ringkasan serupa bisa dibuat dengan SUMIFS: =SUMIFS($C$2:$C$9;$A$2:$A$9;$E2;$B$2:$B$9;F$1). Di sini $E2 mengunci kolom judul baris dan F$1 mengunci baris judul kolom, sehingga satu rumus dapat disalin ke seluruh tabel. Referensi campuran ini adalah kunci menulis tabel dua arah.',
          ],
        },
        {
          heading: 'Memilih grafik',
          paragraphs: [
            'Grafik kolom membandingkan nilai antar kategori. Grafik garis menunjukkan tren dari waktu ke waktu. Grafik pai hanya untuk proporsi dari sedikit kategori (maksimal sekitar lima). Beri judul, label sumbu, dan mulai sumbu nilai dari nol agar perbandingan tidak menipu.',
          ],
        },
      ],
      example: {
        title: 'Ringkasan penjualan per wilayah dan kategori',
        description: 'Tabel ringkasan di E1:G3 dihitung dari data mentah di A1:C5.',
        table: [
          ['Wilayah', 'Kategori', 'Penjualan', '', '', 'Makanan', 'Minuman'],
          [
            'Jakarta',
            'Makanan',
            300000,
            '',
            'Jakarta',
            '=SUMIFS($C$2:$C$5,$A$2:$A$5,$E2,$B$2:$B$5,F$1)',
            '=SUMIFS($C$2:$C$5,$A$2:$A$5,$E2,$B$2:$B$5,G$1)',
          ],
          [
            'Jakarta',
            'Minuman',
            150000,
            '',
            'Bandung',
            '=SUMIFS($C$2:$C$5,$A$2:$A$5,$E3,$B$2:$B$5,F$1)',
            '=SUMIFS($C$2:$C$5,$A$2:$A$5,$E3,$B$2:$B$5,G$1)',
          ],
          ['Bandung', 'Makanan', 80000],
          ['Bandung', 'Minuman', 120000],
        ],
        formula: '=SUMIFS($C$2:$C$5,$A$2:$A$5,$E2,$B$2:$B$5,F$1)',
        result: '300000 (Jakarta, Makanan)',
        walkthrough:
          'Rumus menjumlahkan Penjualan untuk baris yang Wilayahnya sama dengan judul baris ($E2) dan Kategorinya sama dengan judul kolom (F$1).',
      },
      mistakes: [
        { title: 'Lupa Refresh', detail: 'PivotTable tidak berubah otomatis saat data sumber berubah. Klik Refresh (atau Alt+F5).' },
        {
          title: 'Sumber data berspasi/berisi sel kosong',
          detail: 'Judul kolom harus unik dan tidak kosong, dan tidak boleh ada baris kosong di tengah data.',
        },
        { title: 'Grafik pai untuk banyak kategori', detail: 'Lebih dari lima irisan sulit dibaca. Pakai grafik batang.' },
      ],
      playgroundNote:
        'Playground tidak memiliki PivotTable dan grafik. Latihan memintamu membangun ringkasan yang sama dengan SUMIFS, yang juga cara memahami apa yang dilakukan PivotTable.',
      quiz: [
        {
          question: 'Pada F$1, tanda $ berarti…',
          options: ['Baris 1 dikunci, kolom bisa bergeser', 'Kolom F dikunci', 'Mata uang', 'Sel tersembunyi'],
          answerIndex: 0,
          explanation:
            'Tanda $ di depan angka mengunci baris. Saat disalin ke kanan, kolomnya berubah (F, G, …) tetapi tetap membaca baris 1.',
        },
      ],
    },
  },
];
