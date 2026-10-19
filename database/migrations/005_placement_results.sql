-- Hasil tes penempatan. Tes ini terbuka tanpa akun, jadi user_id boleh kosong.
-- Pengunjung tanpa akun disimpan tanpa nama, IP, atau User-Agent: hanya skor dan jawabannya.
CREATE TABLE placement_results (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  score        TINYINT UNSIGNED NOT NULL,
  total        TINYINT UNSIGNED NOT NULL,
  start_module VARCHAR(100) NULL,
  per_module   JSON NOT NULL,
  answers      JSON NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_placement_created (created_at),
  KEY idx_placement_user (user_id),
  CONSTRAINT fk_placement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
