-- Sprint 60 detik: permainan adu cepat dengan soal Excel yang dibuat server tanpa batas.
-- Sesi menyimpan keadaan permainan (soal aktif, skor). Skor masuk papan peringkat hanya setelah sesi selesai
-- dan pemain mengisi nama. Waktu disimpan sebagai milidetik epoch UTC supaya tidak bergantung zona waktu.
CREATE TABLE sprint_sessions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token        CHAR(48) NOT NULL,
  user_id      BIGINT UNSIGNED NULL,
  started_ms   BIGINT UNSIGNED NOT NULL,
  ends_ms      BIGINT UNSIGNED NOT NULL,
  issued_ms    BIGINT UNSIGNED NOT NULL,
  q_index      INT UNSIGNED NOT NULL DEFAULT 0,
  answer_idx   TINYINT UNSIGNED NULL,
  score        INT NOT NULL DEFAULT 0,
  correct      INT UNSIGNED NOT NULL DEFAULT 0,
  wrong        INT UNSIGNED NOT NULL DEFAULT 0,
  streak       INT UNSIGNED NOT NULL DEFAULT 0,
  finished     TINYINT(1) NOT NULL DEFAULT 0,
  submitted    TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_sprint_token (token),
  KEY idx_sprint_started (started_ms),
  CONSTRAINT fk_sprint_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sprint_scores (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NULL,
  name       VARCHAR(40) NOT NULL,
  score      INT NOT NULL,
  correct    INT UNSIGNED NOT NULL,
  wrong      INT UNSIGNED NOT NULL,
  hidden     TINYINT(1) NOT NULL DEFAULT 0,
  created_ms BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_sprint_score_session (session_id),
  KEY idx_sprint_rank (hidden, created_ms, score, correct),
  CONSTRAINT fk_sprint_score_session FOREIGN KEY (session_id) REFERENCES sprint_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sprint_score_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
