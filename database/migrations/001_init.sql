-- ExcelLab skema awal (MySQL 8). Dijalankan oleh `npm run db:migrate`.
-- Progres anonim tinggal di localStorage browser; tabel progres di bawah hanya untuk akun terdaftar.

CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(80)  NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE modules (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug       VARCHAR(80)  NOT NULL,
  title      VARCHAR(160) NOT NULL,
  summary    TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  published  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_modules_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE lessons (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  module_id  BIGINT UNSIGNED NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  title      VARCHAR(160) NOT NULL,
  summary    VARCHAR(300) NOT NULL,
  minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  published  TINYINT(1) NOT NULL DEFAULT 1,
  content    JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lessons_slug (slug),
  KEY idx_lessons_module (module_id, sort_order),
  CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE exercises (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id   BIGINT UNSIGNED NULL,
  topic       VARCHAR(80) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  title       VARCHAR(160) NOT NULL,
  description VARCHAR(300) NOT NULL,
  difficulty  ENUM('mudah','sedang','sulit') NOT NULL,
  points      SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  rows_count  TINYINT UNSIGNED NOT NULL,
  cols_count  TINYINT UNSIGNED NOT NULL,
  cells       JSON NOT NULL,
  editable    JSON NOT NULL,
  task        TEXT NOT NULL,
  hints       JSON NOT NULL,
  explanation TEXT NOT NULL,
  validation  JSON NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  published   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercises_slug (slug),
  KEY idx_exercises_filter (topic, difficulty),
  KEY idx_exercises_lesson (lesson_id),
  CONSTRAINT fk_exercises_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE lesson_progress (
  user_id      BIGINT UNSIGNED NOT NULL,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id),
  CONSTRAINT fk_lp_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_lp_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Log setiap percobaan (benar maupun salah). Poin TIDAK dihitung dari tabel ini.
CREATE TABLE exercise_attempts (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  correct     TINYINT(1) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  submitted   JSON NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempts_user_ex (user_id, exercise_id, created_at),
  CONSTRAINT fk_att_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_att_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Satu baris per (pengguna, latihan): kunci utama menjamin poin hanya diberikan sekali.
CREATE TABLE exercise_completions (
  user_id      BIGINT UNSIGNED NOT NULL,
  exercise_id  BIGINT UNSIGNED NOT NULL,
  points       SMALLINT UNSIGNED NOT NULL,
  attempts     INT UNSIGNED NOT NULL DEFAULT 1,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, exercise_id),
  CONSTRAINT fk_ec_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ec_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Jawaban salah terakhir yang belum diselesaikan (untuk fitur tinjau).
CREATE TABLE review_items (
  user_id     BIGINT UNSIGNED NOT NULL,
  exercise_id BIGINT UNSIGNED NOT NULL,
  message     VARCHAR(500) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, exercise_id),
  CONSTRAINT fk_ri_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ri_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Hari aktif belajar; streak dihitung dari tabel ini (zona waktu Asia/Jakarta).
CREATE TABLE learning_days (
  user_id BIGINT UNSIGNED NOT NULL,
  day     DATE NOT NULL,
  PRIMARY KEY (user_id, day),
  CONSTRAINT fk_ld_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shortcuts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(100) NOT NULL,
  action        VARCHAR(160) NOT NULL,
  keys_windows  VARCHAR(80) NULL,
  keys_mac      VARCHAR(80) NULL,
  category      ENUM('navigasi','edit-sel','format','seleksi','data','rumus','lembar-kerja') NOT NULL,
  explanation   TEXT NOT NULL,
  example       TEXT NULL,
  verification  VARCHAR(300) NOT NULL,
  published     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shortcuts_slug (slug),
  KEY idx_shortcuts_category (category)
) ENGINE=InnoDB;

CREATE TABLE worksheet_resources (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(100) NOT NULL,
  title         VARCHAR(160) NOT NULL,
  description   VARCHAR(400) NOT NULL,
  objective     VARCHAR(400) NOT NULL,
  difficulty    ENUM('mudah','sedang','sulit') NOT NULL,
  skills        JSON NOT NULL,
  instructions  JSON NOT NULL,
  file_name     VARCHAR(120) NOT NULL,
  key_file_name VARCHAR(120) NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  published     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_worksheets_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE admin_audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id    BIGINT UNSIGNED NULL,
  action      VARCHAR(20) NOT NULL,
  resource    VARCHAR(40) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
