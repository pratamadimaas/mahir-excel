import { createApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';

const config = loadConfig();
const db = createPool(config);
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  console.log(`Mahir Excel API berjalan di http://localhost:${config.port} (${config.env})`);
  if (!config.googleClientId) console.log('Login dengan Google nonaktif: isi GOOGLE_CLIENT_ID di .env untuk mengaktifkan tombolnya.');
});

function shutdown(): void {
  server.close(() => {
    void db.end().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
