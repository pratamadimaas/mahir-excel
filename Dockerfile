# Satu image untuk API dan web (API melayani hasil build web lewat SERVE_WEB=true).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/spreadsheet-engine/package.json packages/spreadsheet-engine/
RUN npm ci
COPY . .
# Tautan kontak di footer ikut tertanam saat build web (dibaca Vite dari lingkungan build).
ARG VITE_CONTACT_URL=""
ENV VITE_CONTACT_URL=$VITE_CONTACT_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production SERVE_WEB=true API_PORT=4000 WORKSHEET_DIR=/data/worksheets
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data/worksheets && chown -R node:node /data /app
USER node
EXPOSE 4000
# Hanya menjalankan migrasi (aman diulang). Seed dijalankan manual sekali, lihat docs/DEPLOY.md.
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/server.js"]
