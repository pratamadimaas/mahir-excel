import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { loadConfig, type Config } from '../config';

export async function runMigrations(config: Config): Promise<string[]> {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true, charset: 'utf8mb4' });
  const applied: string[] = [];
  try {
    await conn.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB',
    );
    const [done] = await conn.query('SELECT version FROM schema_migrations');
    const doneSet = new Set((done as { version: string }[]).map((r) => r.version));
    const files = fs
      .readdirSync(config.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (doneSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(config.migrationsDir, file), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      applied.push(file);
    }
  } finally {
    await conn.end();
  }
  return applied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations(loadConfig())
    .then((applied) => {
      console.log(applied.length ? `Migrasi dijalankan: ${applied.join(', ')}` : 'Tidak ada migrasi baru.');
    })
    .catch((e) => {
      console.error('Migrasi gagal:', e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
