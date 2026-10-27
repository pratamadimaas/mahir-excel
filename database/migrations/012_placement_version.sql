-- Versi tes penempatan: 1 = tes lama (12 soal, semua dijawab), 2 = tes bertingkat (berhenti lebih awal bila satu tingkat tidak lulus).
-- Admin memakai kolom ini untuk menandai hasil lama; tingkat kemampuannya tetap dihitung ulang dari jawaban.
ALTER TABLE placement_results ADD COLUMN version TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER answers;
