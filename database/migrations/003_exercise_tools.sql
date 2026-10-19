-- Alat bantu playground per latihan: sort dan filter pada rentang data tertentu.
-- Contoh: {"sort":{"range":"A1:C8"},"filter":{"range":"A1:C8"}}  (baris pertama rentang = judul kolom)
ALTER TABLE exercises ADD COLUMN tools JSON NULL;
