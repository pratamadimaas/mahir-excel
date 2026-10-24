-- Cicipan Premium: tiap akun gratis boleh membuka satu solusi latihan setiap 7 hari.
-- Laporan soal: pengguna melaporkan latihan yang tidak jelas, jawabannya meragukan, atau salah ketik.

CREATE TABLE solution_unlocks (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_su_user_exercise (user_id, exercise_id),
  KEY idx_su_user_time (user_id, unlocked_at),
  CONSTRAINT fk_su_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_su_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE exercise_reports (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  reason      ENUM('tidak-jelas','jawaban-meragukan','salah-ketik','lainnya') NOT NULL,
  note        VARCHAR(500) NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_er_status (resolved_at, created_at),
  KEY idx_er_exercise (exercise_id),
  KEY idx_er_user_time (user_id, created_at),
  CONSTRAINT fk_er_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_er_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;
