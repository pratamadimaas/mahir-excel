import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config';
import { writeWorkbooks } from './builders';

export async function generateWorksheets(dir: string): Promise<string[]> {
  return writeWorkbooks(dir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  generateWorksheets(config.worksheetDir)
    .then((files) => console.log(`${files.length} file worksheet dibuat di ${config.worksheetDir}`))
    .catch((e) => {
      console.error('Gagal membuat worksheet:', e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
