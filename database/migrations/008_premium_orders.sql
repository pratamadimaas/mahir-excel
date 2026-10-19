-- Pesanan Premium yang dibayar lewat QRIS (Xendit). Satu baris per kode QR yang dibuat.
CREATE TABLE premium_orders (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  reference           VARCHAR(64)  NOT NULL,
  amount              INT UNSIGNED NOT NULL,
  months              SMALLINT UNSIGNED NOT NULL,
  status              ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  qr_id               VARCHAR(100) NULL,
  qr_string           TEXT NULL,
  expires_at          DATETIME NOT NULL,
  paid_at             DATETIME NULL,
  provider_payment_id VARCHAR(100) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_premium_orders_reference (reference),
  KEY idx_premium_orders_user (user_id, status),
  CONSTRAINT fk_premium_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
