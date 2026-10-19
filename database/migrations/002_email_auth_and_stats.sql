-- Login lewat email (kode sekali pakai), reset kata sandi, dan statistik penggunaan yang ramah privasi.

ALTER TABLE users
  ADD COLUMN last_login_at     TIMESTAMP NULL,
  ADD COLUMN email_verified_at TIMESTAMP NULL,
  ADD COLUMN has_password      TINYINT(1) NOT NULL DEFAULT 1;

-- Kode 6 digit untuk login/reset. Hanya hash (HMAC) yang disimpan; kedaluwarsa 10 menit; maksimal 5 percobaan.
CREATE TABLE email_codes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  purpose    ENUM('login','reset') NOT NULL,
  code_hash  CHAR(64) NOT NULL,
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_codes_lookup (email, purpose, id)
) ENGINE=InnoDB;

-- Penghitung agregat harian. Tidak memuat data pribadi.
-- metric: pageview (item = rute), visitor (item = all), anon_attempt / anon_correct (item = slug latihan).
CREATE TABLE daily_stats (
  day    DATE NOT NULL,
  metric VARCHAR(30) NOT NULL,
  item   VARCHAR(100) NOT NULL,
  total  INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, item)
) ENGINE=InnoDB;

-- Pengunjung unik per hari tanpa cookie: hash(garam harian acak + IP + User-Agent).
-- Garam dan hash dihapus setelah 2 hari sehingga tidak dapat dilacak antar hari.
CREATE TABLE analytics_salts (
  day  DATE NOT NULL PRIMARY KEY,
  salt CHAR(32) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE visitor_hashes (
  day  DATE NOT NULL,
  hash CHAR(32) NOT NULL,
  PRIMARY KEY (day, hash)
) ENGINE=InnoDB;
