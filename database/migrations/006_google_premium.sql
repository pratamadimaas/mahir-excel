-- Login dengan Google (akun ditautkan lewat ID unik Google) dan paket premium (aktivasi manual oleh admin).
ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(64) NULL,
  ADD COLUMN premium_until DATETIME NULL,
  ADD UNIQUE KEY uq_users_google_sub (google_sub);
