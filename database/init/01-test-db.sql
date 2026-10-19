-- Database terpisah untuk tes API agar data pengembangan tidak tersentuh.
CREATE DATABASE IF NOT EXISTS excellab_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON excellab_test.* TO 'excellab'@'%';
FLUSH PRIVILEGES;
