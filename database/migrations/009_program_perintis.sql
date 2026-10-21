-- Program Perintis: sertifikat gratis untuk N pengguna pertama yang menyelesaikan syarat.
-- Satu baris per pengguna yang berhasil klaim; slot berurutan 1..N dan unik, jadi kuota tidak bisa terlampaui.
CREATE TABLE program_claims (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  slot       SMALLINT UNSIGNED NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_program_claims_user (user_id),
  UNIQUE KEY uq_program_claims_slot (slot),
  CONSTRAINT fk_program_claims_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
