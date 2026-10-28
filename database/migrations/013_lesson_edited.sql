-- Pelajaran yang diubah lewat admin ditandai, supaya seed konten tidak menimpanya.
-- "Kembalikan ke bawaan" mengisi ulang dari kode dan menghapus tanda ini.
ALTER TABLE lessons ADD COLUMN edited TINYINT(1) NOT NULL DEFAULT 0;
