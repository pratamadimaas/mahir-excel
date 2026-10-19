# Mesin rumus Mahir Excel

Paket `@excellab/spreadsheet-engine` (tanpa dependensi, tanpa `eval()`/`Function()`).

Alur: **tokenizer → parser rekursif-turun → AST → evaluator berbasis cache**. Fungsi tambahan (teks, tanggal, pencarian) ada di `extra.ts`, utilitas isi otomatis di `fill.ts`, pemformatan tampilan di `format.ts`, dan validasi latihan terpisah di `packages/shared/src/validate.ts`.

## Yang didukung

- Nilai: angka (`3.5`), teks (`"Lunas"`), `TRUE`/`FALSE`.
- Referensi: `A1`, `$A$1`, `A$1`, `$A1`, rentang `A1:B5` (kolom sampai `ZZ`, baris sampai 1000).
- Operator: `+ - * / ^ & %` (postfix), perbandingan `= <> < > <= >=`, tanda kurung, unary `-`/`+`.
- Pemisah argumen `,` atau `;`. Desimal dalam rumus memakai titik.
- **33 fungsi** (allowlist di `functions-meta.ts`):

| Kelompok   | Fungsi                                       |
| ---------- | -------------------------------------------- |
| Agregat    | `SUM AVERAGE MIN MAX COUNT COUNTA`           |
| Logika     | `IF AND OR IFERROR IFNA`                     |
| Bersyarat  | `COUNTIF COUNTIFS SUMIF SUMIFS`              |
| Pembulatan | `ROUND`                                      |
| Teks       | `LEFT RIGHT MID LEN TRIM UPPER LOWER PROPER` |
| Tanggal    | `DATE YEAR MONTH DAY TODAY`                  |
| Pencarian  | `VLOOKUP XLOOKUP INDEX MATCH`                |

- Kriteria COUNTIF/SUMIF: angka, teks (tidak peka huruf besar-kecil), `">50"`, `"<=20"`, `"<>x"`, wildcard `*` dan `?`.
- **Isi otomatis** (`shiftFormula`): menggeser referensi relatif seperti fill handle Excel; `$` mengunci kolom/baris; teks dalam tanda kutip tidak diubah.

## Galat

| Kode      | Arti                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `#ERROR!` | sintaks salah, jumlah argumen salah, argumen kosong                                                                  |
| `#NAME?`  | fungsi/nama tidak dikenal atau tidak didukung                                                                        |
| `#VALUE!` | tipe salah (teks dalam aritmetika, rentang berbeda ukuran, rentang sebagai nilai tunggal, mode XLOOKUP tak didukung) |
| `#REF!`   | referensi di luar grid; nomor kolom VLOOKUP atau baris/kolom INDEX melebihi ukuran                                   |
| `#DIV/0!` | pembagian nol, `AVERAGE` tanpa angka                                                                                 |
| `#NUM!`   | perpangkatan tidak valid, `ROUND` digit di luar ±15, tanggal di luar rentang                                         |
| `#N/A`    | nilai pencarian tidak ditemukan (`VLOOKUP`, `XLOOKUP`, `MATCH`); `IFNA` dan `IFERROR` menangkapnya                   |
| `#CIRC!`  | referensi melingkar (langsung maupun tidak langsung)                                                                 |
| `#LIMIT!` | melewati batas sumber daya                                                                                           |

Batas (`LIMITS` di `types.ts`): panjang rumus 1000, kedalaman parse 40, argumen 64, rentang 10.000 sel, kedalaman rantai referensi 120, langkah evaluasi 200.000 per sheet. `IFERROR` tidak menutupi `#LIMIT!`.

## Perbedaan dengan Microsoft Excel

Daftar perbedaan yang kami ketahui; bukan klaim kompatibilitas penuh.

- Hanya 33 fungsi di atas. Tidak ada array dinamis, `LET`, `LAMBDA`, nama terdefinisi, referensi antar-sheet, tabel terstruktur, atau argumen kosong (`IF(A1,,2)`). Fungsi lain seperti `HLOOKUP`, `SUMPRODUCT`, `TEXT`, `SUBSTITUTE`, `FIND`, dan `EOMONTH` menghasilkan `#NAME?`.
- Referensi melingkar menghasilkan `#CIRC!` (Excel menampilkan peringatan dan biasanya 0).
- Rentang di konteks nilai tunggal (`=B1:B3+1`) menghasilkan `#VALUE!`; Excel 365 akan "menumpahkan" hasil array.
- `XLOOKUP` mengembalikan satu sel; mode pencocokan yang didukung 0, -1, 1, 2 dan mode pencarian 1 atau -1 (pencarian biner tidak ada). `XLOOKUP` ada di Microsoft 365 dan Excel 2021 ke atas, tidak di Excel 2019 dan sebelumnya.
- `INDEX` dengan nomor baris/kolom 0 (mengambil seluruh baris/kolom) menghasilkan `#VALUE!`.
- Angka di sel diketik dengan titik desimal (`1.5`). Masukan `1,5` atau `1.500` (ribuan) **tidak** diurai sebagai angka Indonesia (`1.500` dibaca 1,5).
- Tanggal adalah nomor serial (sistem 1900). Tidak ada format tanggal di playground, jadi hasil tampil sebagai angka. `TODAY()` memakai tanggal WIB.
- `TRIM` hanya membuang spasi biasa, bukan semua jenis spasi Unicode.
- Perbandingan teks tidak peka huruf besar-kecil; urutan tipe: angka < teks < boolean (seperti Excel).
- `AND`/`OR` mengabaikan teks/sel kosong dalam rentang; bila tidak ada nilai logika → `#VALUE!` (sama seperti Excel).
- Hasil dibulatkan ke 15 digit signifikan untuk menyembunyikan derau floating point (`0.1+0.2` = `0.3`).
- Tampilan angka mengikuti format Indonesia (`15.000,5`), tetapi angka di bawah 10.000 tampil tanpa pemisah ribuan agar tahun 2026 tidak menjadi "2.026". Ini hanya tampilan, bukan nilai.
- Tidak ada format sel atau waktu di playground.

## Menambah fungsi dengan aman

1. Tambahkan nama dan batas argumen di `functions-meta.ts` (allowlist; parser menolak nama lain dengan `#NAME?`).
2. Implementasikan di `evaluator.ts` pada `call()` atau, untuk fungsi non-inti, di `extra.ts` (`callExtra`). Fungsi yang butuh evaluasi malas (seperti `IF`, `IFNA`) mengevaluasi argumennya sendiri.
3. Pastikan semua perulangan melewati `tick()` (anggaran langkah) dan tidak membuat rekursi baru tanpa batas kedalaman.
4. Tambahkan tes di `engine.test.ts` atau `functions-extra.test.ts`: fungsi valid, argumen salah, sel kosong/teks, galat, dan batas sumber daya.
5. Dokumentasikan perbedaan dengan Excel di berkas ini dan perbarui daftar fungsi di README dan halaman Tentang.
6. Verifikasi perilaku terhadap dokumentasi resmi Microsoft atau Excel asli sebelum mengklaim kompatibilitas.
