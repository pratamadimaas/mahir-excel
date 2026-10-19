-- Ulang terjadwal (spaced repetition), bagikan progres, sertifikat penyelesaian, dan verifikasi email.

ALTER TABLE users
  ADD COLUMN share_token CHAR(32) NULL,
  ADD UNIQUE KEY uq_users_share_token (share_token);

ALTER TABLE email_codes MODIFY purpose ENUM('login','reset','verify') NOT NULL;

-- Latihan yang pernah salah dijadwalkan ulang: box 0 = baru salah (jatuh tempo sekarang),
-- naik satu box tiap jawaban benar dengan jeda 1, 3, 7, 14, 30 hari.
CREATE TABLE review_schedule (
  user_id     BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  box         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  due_at      DATETIME NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, exercise_id),
  KEY idx_review_due (user_id, due_at),
  CONSTRAINT fk_rs_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_rs_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Sertifikat penyelesaian: satu per (pengguna, cakupan). Kode dipakai untuk verifikasi publik.
CREATE TABLE certificates (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id   BIGINT UNSIGNED NOT NULL,
  scope     VARCHAR(100) NOT NULL,
  code      CHAR(16) NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cert_code (code),
  UNIQUE KEY uq_cert_user_scope (user_id, scope),
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
