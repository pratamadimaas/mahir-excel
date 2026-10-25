#!/bin/bash
# Cadangan harian database Mahir Excel. Kata sandi dibaca dari dalam container MySQL, tidak disimpan di skrip ini.
# Hasil: /opt/mahir-excel/backups/excellab-YYYYmmdd-HHMMSS.sql.gz (disimpan 14 hari).
set -euo pipefail

DIR=/opt/mahir-excel/backups
KEEP_DAYS=14
CONTAINER=mahir-excel-mysql-1

mkdir -p "$DIR"
chmod 700 "$DIR"
OUT="$DIR/excellab-$(date +%Y%m%d-%H%M%S).sql.gz"
TMP="$OUT.tmp"

docker exec "$CONTAINER" sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces excellab' 2>/dev/null | gzip -9 > "$TMP"
gzip -t "$TMP"                      # gagal bila berkas rusak, dan berkas sementara tidak dipakai
[ "$(stat -c %s "$TMP")" -gt 2000 ] # dump kosong jauh lebih kecil dari ini
mv "$TMP" "$OUT"
chmod 600 "$OUT"

find "$DIR" -name 'excellab-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) ok $OUT $(du -h "$OUT" | cut -f1)"
