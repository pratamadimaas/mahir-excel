-- Catatan pembayaran Premium yang diterima di luar aplikasi (mis. lewat WhatsApp), diisi manual oleh admin.
-- user_id boleh kosong: pembayar bisa dicatat dengan nama saja, dan baris tetap ada bila akun dihapus.
CREATE TABLE manual_payments (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NULL,
  payer      VARCHAR(255) NOT NULL,
  amount     INT UNSIGNED NOT NULL,
  months     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  paid_on    DATE NOT NULL,
  note       VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_manual_payments_paid (paid_on, id),
  KEY idx_manual_payments_user (user_id),
  CONSTRAINT fk_manual_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_manual_payments_admin FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
