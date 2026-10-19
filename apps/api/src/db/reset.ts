import { pathToFileURL } from 'node:url';
import { loadConfig, type Config } from '../config';
import { createPool, rows, run, type Db } from './pool';
import { runMigrations } from './migrate';
import { seedAdmin, seedContent } from './seed';

/** Menghapus semua tabel lalu membangun ulang. Hanya untuk pengembangan dan tes. */
export async function resetDatabase(db: Db, config: Config, opts: { seed?: boolean } = {}): Promise<void> {
  if (config.env === 'production') throw new Error('db:reset tidak boleh dijalankan di produksi.');
  const tables = await rows<{ t: string }>(db, 'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
  await run(db, 'SET FOREIGN_KEY_CHECKS=0');
  for (const { t } of tables) await db.query(`DROP TABLE IF EXISTS \`${t.replace(/`/g, '')}\``);
  await run(db, 'SET FOREIGN_KEY_CHECKS=1');
  await runMigrations(config);
  if (opts.seed !== false) {
    await seedContent(db);
    await seedAdmin(db, config);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const db = createPool(config);
  resetDatabase(db, config)
    .then(() => console.log(`Database ${config.db.database} direset dan di-seed ulang.`))
    .catch((e) => {
      console.error('Reset gagal:', e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
