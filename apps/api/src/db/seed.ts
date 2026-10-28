import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { exercises, lessons, modules, shortcuts, worksheets } from '@excellab/shared';
import { loadConfig, type Config } from '../config';
import { createPool, row, run, type Db } from './pool';
import { generateWorksheets } from '../worksheets/generate';

const json = (v: unknown): string => JSON.stringify(v);

/**
 * Mengisi konten dari paket @excellab/shared. Idempoten: konten diperbarui berdasarkan slug.
 * Pelajaran yang sudah diubah lewat admin (kolom `edited`) tidak ditimpa judul, ringkasan, durasi, dan isinya;
 * modul, latihan, shortcut, dan worksheet tetap mengikuti kode.
 */
export async function seedContent(
  db: Db,
): Promise<{ modules: number; lessons: number; exercises: number; shortcuts: number; worksheets: number }> {
  for (const m of modules) {
    await run(
      db,
      `INSERT INTO modules (slug, title, summary, sort_order, published) VALUES (?,?,?,?,1)
       ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), sort_order=VALUES(sort_order)`,
      [m.slug, m.title, m.summary, m.sortOrder],
    );
  }
  for (const l of lessons) {
    const mod = await row<{ id: number }>(db, 'SELECT id FROM modules WHERE slug=?', [l.moduleSlug]);
    if (!mod) throw new Error(`Modul ${l.moduleSlug} tidak ditemukan untuk pelajaran ${l.slug}`);
    await run(
      db,
      `INSERT INTO lessons (module_id, slug, title, summary, minutes, sort_order, published, content) VALUES (?,?,?,?,?,?,1,?)
       ON DUPLICATE KEY UPDATE module_id=VALUES(module_id), sort_order=VALUES(sort_order),
         title=IF(edited=1, title, VALUES(title)), summary=IF(edited=1, summary, VALUES(summary)),
         minutes=IF(edited=1, minutes, VALUES(minutes)), content=IF(edited=1, content, VALUES(content))`,
      [mod.id, l.slug, l.title, l.summary, l.minutes, l.sortOrder, json(l.content)],
    );
  }
  for (const e of exercises) {
    const lesson = e.lessonSlug ? await row<{ id: number }>(db, 'SELECT id FROM lessons WHERE slug=?', [e.lessonSlug]) : undefined;
    await run(
      db,
      `INSERT INTO exercises (lesson_id, topic, slug, title, description, difficulty, points, rows_count, cols_count,
         cells, editable, task, hints, explanation, validation, tools, sort_order, published)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE lesson_id=VALUES(lesson_id), topic=VALUES(topic), title=VALUES(title),
         description=VALUES(description), difficulty=VALUES(difficulty), points=VALUES(points),
         rows_count=VALUES(rows_count), cols_count=VALUES(cols_count), cells=VALUES(cells),
         editable=VALUES(editable), task=VALUES(task), hints=VALUES(hints), explanation=VALUES(explanation),
         validation=VALUES(validation), tools=VALUES(tools), sort_order=VALUES(sort_order)`,
      [
        lesson?.id ?? null,
        e.topic,
        e.slug,
        e.title,
        e.description,
        e.difficulty,
        e.points,
        e.rows,
        e.cols,
        json(e.cells),
        json(e.editable),
        e.task,
        json(e.hints),
        e.explanation,
        json(e.validation),
        e.tools ? json(e.tools) : null,
        e.sortOrder,
      ],
    );
  }
  for (const s of shortcuts) {
    await run(
      db,
      `INSERT INTO shortcuts (slug, action, keys_windows, keys_mac, category, explanation, example, verification, published)
       VALUES (?,?,?,?,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE action=VALUES(action), keys_windows=VALUES(keys_windows), keys_mac=VALUES(keys_mac),
         category=VALUES(category), explanation=VALUES(explanation), example=VALUES(example), verification=VALUES(verification)`,
      [s.slug, s.action, s.keysWindows, s.keysMac, s.category, s.explanation, s.example ?? null, s.verification],
    );
  }
  for (const w of worksheets) {
    await run(
      db,
      `INSERT INTO worksheet_resources (slug, title, description, objective, difficulty, skills, instructions, file_name, key_file_name, sort_order, published)
       VALUES (?,?,?,?,?,?,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), objective=VALUES(objective),
         difficulty=VALUES(difficulty), skills=VALUES(skills), instructions=VALUES(instructions),
         file_name=VALUES(file_name), key_file_name=VALUES(key_file_name), sort_order=VALUES(sort_order)`,
      [
        w.slug,
        w.title,
        w.description,
        w.objective,
        w.difficulty,
        json(w.skills),
        json(w.instructions),
        `${w.slug}.xlsx`,
        `${w.slug}-kunci.xlsx`,
        w.sortOrder,
      ],
    );
  }
  return {
    modules: modules.length,
    lessons: lessons.length,
    exercises: exercises.length,
    shortcuts: shortcuts.length,
    worksheets: worksheets.length,
  };
}

/** Membuat admin pengembangan hanya bila ADMIN_EMAIL dan ADMIN_PASSWORD diisi. Tidak menimpa akun yang sudah ada. */
export async function seedAdmin(db: Db, config: Config): Promise<'created' | 'exists' | 'skipped'> {
  if (!config.adminEmail || !config.adminPassword) return 'skipped';
  if (config.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD minimal 8 karakter.');
  const email = config.adminEmail.trim().toLowerCase();
  const existing = await row<{ id: number }>(db, 'SELECT id FROM users WHERE email=?', [email]);
  if (existing) {
    await run(db, "UPDATE users SET role='admin' WHERE id=?", [existing.id]);
    return 'exists';
  }
  const hash = await bcrypt.hash(config.adminPassword, config.bcryptRounds);
  await run(db, "INSERT INTO users (email, password_hash, display_name, role) VALUES (?,?,?, 'admin')", [email, hash, 'Admin']);
  return 'created';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const db = createPool(config);
  (async () => {
    const counts = await seedContent(db);
    const admin = await seedAdmin(db, config);
    const files = await generateWorksheets(config.worksheetDir);
    const kept = await row<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM lessons WHERE edited=1');
    console.log('Seed selesai:', counts, `| admin: ${admin} | ${files.length} file worksheet`);
    if (Number(kept?.n ?? 0) > 0) console.log(`${kept?.n} pelajaran yang diubah lewat admin tidak ditimpa.`);
  })()
    .catch((e) => {
      console.error('Seed gagal:', e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
