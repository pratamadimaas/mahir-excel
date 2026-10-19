# Catatan konten internal

## Sumber dan status verifikasi

- Seluruh teks pelajaran, latihan, dan worksheet ditulis orisinal untuk Mahir Excel. Tidak ada materi kursus berhak cipta yang disalin dan tidak ada kutipan dokumentasi Microsoft.
- **Shortcut**: kombinasi tombol ditulis dari pengetahuan umum tentang Excel desktop dan daftar pintasan dukungan Microsoft. **Belum dicocokkan satu per satu di aplikasi** untuk semua versi (Excel 2016/2019/2021/Microsoft 365), sistem operasi, atau tata letak keyboard. Kolom `verification` pada tiap entri menyatakan status itu: "Pintasan umum Excel desktop" (diyakini stabil), "Windows: pintasan umum. Mac: bisa berbeda…" (sisi Mac kurang pasti, terutama kombinasi dengan tombol Fn), atau "Hanya Excel desktop Windows". Sebelum menyebut sebuah shortcut _terverifikasi_, uji di Excel asli dan perbarui kolom itu.
- **Perilaku fungsi** pada pelajaran dijelaskan secara umum dan konsisten dengan perilaku mesin Mahir Excel yang diuji (`engine.test.ts`). Perbedaan dengan Excel asli ada di `FORMULA-ENGINE.md`.
- **Langkah menu Excel** (Sort, Filter, Freeze Panes, Format as Table) ditulis berdasarkan antarmuka Excel desktop berbahasa Inggris. Nama menu dapat berbeda pada versi atau bahasa lain.
- Pemisah argumen (`,` vs `;`) bergantung pengaturan regional Excel; pelajaran menyebut keduanya.

## Kurikulum saat ini

5 modul, 13 pelajaran, 24 latihan. Modul 2 (Mengolah Data) tidak punya fitur sort/filter di playground; latihannya meminta pembacaan hasil dan perbaikan data, dan pelajarannya menyatakan hal itu.

## Kebijakan petunjuk

Setiap latihan punya ≥ 3 petunjuk. Petunjuk terakhir hampir selalu memuat jawaban dan **tidak dikirim ke browser** (`toPublicExercise`); jawaban acuan hanya dikirim setelah jawaban benar atau lewat "Lihat solusi". Ini integritas edukasi, bukan keamanan: apa pun yang dikirim ke browser dapat diperiksa pengguna.
