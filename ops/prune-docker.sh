#!/bin/bash
# Pembersihan mingguan cache build Docker yang lebih tua dari 3 hari, dan gambar yatim.
# Container, volume (termasuk database), dan cache terbaru tidak disentuh.
set -euo pipefail

echo "$(date -Iseconds) sebelum: $(df -h / | tail -1)"
docker builder prune -f --filter until=72h > /dev/null
docker image prune -f > /dev/null
echo "$(date -Iseconds) sesudah: $(df -h / | tail -1)"
