import { useEffect, useState } from 'react';
import type { LessonContent } from '../../services/types';
import { LessonBody } from '../academy/LessonBody';

type Section = LessonContent['sections'][number];
type Mistake = LessonContent['mistakes'][number];
type QuizItem = LessonContent['quiz'][number];

const PLAIN_NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;

const splitLines = (t: string): string[] =>
  t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const splitParas = (t: string): string[] =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean);
const parseTable = (t: string): (string | number)[][] =>
  t
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('|').map((cell) => (PLAIN_NUMBER.test(cell.trim()) ? Number(cell.trim()) : cell.trim())));
const tableText = (rows: (string | number)[][]): string => rows.map((r) => r.join(' | ')).join('\n');

const EMPTY: LessonContent = {
  objectives: [],
  sections: [],
  example: { title: '', description: '', table: [['']], formula: '', result: '', walkthrough: '' },
  mistakes: [],
  quiz: [],
};

/** Membaca JSON isi pelajaran; null bila bukan objek yang bisa dibaca. Bagian yang hilang diisi kosong. */
export function parseLesson(json: string): LessonContent | null {
  try {
    const v = JSON.parse(json) as Partial<LessonContent> | null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return {
      ...EMPTY,
      ...v,
      example: { ...EMPTY.example, ...(v.example ?? {}) },
      objectives: v.objectives ?? [],
      sections: v.sections ?? [],
      mistakes: v.mistakes ?? [],
      quiz: v.quiz ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Kotak teks yang menyimpan ketikannya sendiri. Kalau langsung diturunkan dari daftar, baris kosong
 * (pemisah paragraf) atau baris yang sedang diketik hilang di tengah jalan.
 */
function ListArea({
  id,
  label,
  help,
  value,
  onChange,
  mode,
  rows = 4,
}: {
  id: string;
  label: string;
  help?: string;
  value: string[];
  onChange: (next: string[]) => void;
  mode: 'line' | 'para';
  rows?: number;
}) {
  const parse = mode === 'para' ? splitParas : splitLines;
  const join = (v: string[]): string => v.join(mode === 'para' ? '\n\n' : '\n');
  const [text, setText] = useState(() => join(value));
  useEffect(() => {
    if (JSON.stringify(parse(text)) !== JSON.stringify(value)) setText(join(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya menyamakan bila nilai berubah dari luar
  }, [value]);
  return (
    <div className="mb-2">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <textarea
        id={id}
        className="form-control"
        rows={rows}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
      />
      {help && <div className="form-text">{help}</div>}
    </div>
  );
}

function TableArea({ id, value, onChange }: { id: string; value: (string | number)[][]; onChange: (next: (string | number)[][]) => void }) {
  const [text, setText] = useState(() => tableText(value));
  useEffect(() => {
    if (JSON.stringify(parseTable(text)) !== JSON.stringify(value)) setText(tableText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya menyamakan bila nilai berubah dari luar
  }, [value]);
  return (
    <div className="mb-2">
      <label htmlFor={id} className="form-label">
        Tabel contoh
      </label>
      <textarea
        id={id}
        className="form-control xl-mono"
        rows={6}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseTable(e.target.value));
        }}
      />
      <div className="form-text">
        Satu baris per baris tabel, kolom dipisah tanda | (contoh: Barang | Harga). Baris pertama adalah judul kolom.
      </div>
    </div>
  );
}

function Text({
  id,
  label,
  value,
  onChange,
  rows,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  help?: string;
}) {
  return (
    <div className="mb-2">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {rows ? (
        <textarea id={id} className="form-control" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="form-control" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {help && <div className="form-text">{help}</div>}
    </div>
  );
}

function RowTools({
  i,
  n,
  onMove,
  onRemove,
  noun,
}: {
  i: number;
  n: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  noun: string;
}) {
  return (
    <div className="d-flex gap-1">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={i === 0}
        onClick={() => onMove(i - 1)}
        aria-label={`Geser ${noun} ${i + 1} ke atas`}
      >
        Naik
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={i === n - 1}
        onClick={() => onMove(i + 1)}
        aria-label={`Geser ${noun} ${i + 1} ke bawah`}
      >
        Turun
      </button>
      <button type="button" className="btn btn-outline-danger btn-sm" onClick={onRemove} aria-label={`Hapus ${noun} ${i + 1}`}>
        Hapus
      </button>
    </div>
  );
}

const moved = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
};

/**
 * Editor isi pelajaran per bagian, tanpa JSON. Perubahan langsung dikirim ke form lewat `onChange` sebagai JSON,
 * jadi penyimpanan dan validasi di server tetap sama.
 */
export function LessonEditor({ initial, onChange }: { initial: LessonContent; onChange: (c: LessonContent) => void }) {
  const [c, setC] = useState<LessonContent>(initial);
  // Naik saat urutan atau jumlah item berubah, supaya kotak teks di bawahnya dipasang ulang dengan isi yang benar.
  const [rev, setRev] = useState(0);
  const set = (next: LessonContent, remount = false): void => {
    setC(next);
    if (remount) setRev((r) => r + 1);
    onChange(next);
  };
  const setSection = (i: number, s: Section): void => set({ ...c, sections: c.sections.map((x, j) => (j === i ? s : x)) });
  const setMistake = (i: number, m: Mistake): void => set({ ...c, mistakes: c.mistakes.map((x, j) => (j === i ? m : x)) });
  const setQuiz = (i: number, q: QuizItem, remount = false): void => set({ ...c, quiz: c.quiz.map((x, j) => (j === i ? q : x)) }, remount);

  return (
    <div className="xl-lesson-editor">
      <div className="form-check mb-3">
        <input
          id="le-guide"
          type="checkbox"
          className="form-check-input"
          checked={!!c.guide}
          onChange={(e) => set({ ...c, guide: e.target.checked || undefined })}
        />
        <label htmlFor="le-guide" className="form-check-label">
          Pelajaran panduan (langkah di menu Excel, tanpa latihan di playground)
        </label>
      </div>

      <ListArea
        id="le-obj"
        label="Tujuan belajar"
        help="Satu tujuan per baris."
        value={c.objectives}
        onChange={(objectives) => set({ ...c, objectives })}
        mode="line"
        rows={3}
      />

      <h3 className="h6 mt-4">Bagian pelajaran</h3>
      {c.sections.map((s, i) => (
        <div key={`${rev}-s${i}`} className="xl-panel xl-panel-body mb-2">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Bagian {i + 1}</strong>
            <RowTools
              i={i}
              n={c.sections.length}
              noun="bagian"
              onMove={(to) => set({ ...c, sections: moved(c.sections, i, to) }, true)}
              onRemove={() => set({ ...c, sections: c.sections.filter((_, j) => j !== i) }, true)}
            />
          </div>
          <Text id={`le-sh-${i}`} label="Judul bagian" value={s.heading} onChange={(heading) => setSection(i, { ...s, heading })} />
          <ListArea
            id={`le-sp-${i}`}
            label="Isi"
            help="Pisahkan paragraf dengan satu baris kosong."
            value={s.paragraphs}
            onChange={(paragraphs) => setSection(i, { ...s, paragraphs })}
            mode="para"
            rows={7}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => set({ ...c, sections: [...c.sections, { heading: '', paragraphs: [] }] }, true)}
      >
        Tambah bagian
      </button>

      <h3 className="h6 mt-4">Sintaks</h3>
      <div className="form-check mb-2">
        <input
          id="le-syn"
          type="checkbox"
          className="form-check-input"
          checked={!!c.syntax}
          onChange={(e) => set({ ...c, syntax: e.target.checked ? { signature: '', params: [], notes: [] } : undefined }, true)}
        />
        <label htmlFor="le-syn" className="form-check-label">
          Pelajaran ini punya bagian Sintaks rumus
        </label>
      </div>
      {c.syntax && (
        <div className="xl-panel xl-panel-body mb-2" key={`${rev}-syn`}>
          <Text
            id="le-sig"
            label="Bentuk rumus"
            value={c.syntax.signature}
            onChange={(signature) => set({ ...c, syntax: { ...c.syntax!, signature } })}
            help="Contoh: =SUM(angka1; angka2; ...)"
          />
          {c.syntax.params.map((p, i) => (
            <div key={`${rev}-p${i}`} className="row g-2 mb-2 align-items-end">
              <div className="col-12 col-md-3">
                <Text
                  id={`le-pn-${i}`}
                  label={`Parameter ${i + 1}`}
                  value={p.name}
                  onChange={(name) =>
                    set({ ...c, syntax: { ...c.syntax!, params: c.syntax!.params.map((x, j) => (j === i ? { ...x, name } : x)) } })
                  }
                />
              </div>
              <div className="col-12 col-md-7">
                <Text
                  id={`le-pd-${i}`}
                  label="Penjelasan"
                  value={p.description}
                  onChange={(description) =>
                    set({ ...c, syntax: { ...c.syntax!, params: c.syntax!.params.map((x, j) => (j === i ? { ...x, description } : x)) } })
                  }
                />
              </div>
              <div className="col-12 col-md-2 mb-2">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => set({ ...c, syntax: { ...c.syntax!, params: c.syntax!.params.filter((_, j) => j !== i) } }, true)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mb-3"
            onClick={() => set({ ...c, syntax: { ...c.syntax!, params: [...c.syntax!.params, { name: '', description: '' }] } }, true)}
          >
            Tambah parameter
          </button>
          <ListArea
            id="le-notes"
            label="Catatan sintaks (opsional)"
            help="Satu catatan per baris."
            value={c.syntax.notes ?? []}
            onChange={(notes) => set({ ...c, syntax: { ...c.syntax!, notes } })}
            mode="line"
            rows={2}
          />
        </div>
      )}

      <h3 className="h6 mt-4">Contoh</h3>
      <div className="xl-panel xl-panel-body mb-2">
        <Text
          id="le-et"
          label="Judul contoh"
          value={c.example.title}
          onChange={(title) => set({ ...c, example: { ...c.example, title } })}
        />
        <Text
          id="le-ed"
          label="Deskripsi"
          value={c.example.description}
          rows={2}
          onChange={(description) => set({ ...c, example: { ...c.example, description } })}
        />
        <TableArea id="le-etab" value={c.example.table} onChange={(table) => set({ ...c, example: { ...c.example, table } })} />
        <Text
          id="le-ef"
          label="Rumus"
          value={c.example.formula}
          onChange={(formula) => set({ ...c, example: { ...c.example, formula } })}
        />
        <Text id="le-er" label="Hasil" value={c.example.result} onChange={(result) => set({ ...c, example: { ...c.example, result } })} />
        <Text
          id="le-ew"
          label="Penjelasan langkah"
          value={c.example.walkthrough}
          rows={3}
          onChange={(walkthrough) => set({ ...c, example: { ...c.example, walkthrough } })}
        />
      </div>

      <h3 className="h6 mt-4">Kesalahan yang sering terjadi</h3>
      {c.mistakes.map((m, i) => (
        <div key={`${rev}-m${i}`} className="xl-panel xl-panel-body mb-2">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Kesalahan {i + 1}</strong>
            <RowTools
              i={i}
              n={c.mistakes.length}
              noun="kesalahan"
              onMove={(to) => set({ ...c, mistakes: moved(c.mistakes, i, to) }, true)}
              onRemove={() => set({ ...c, mistakes: c.mistakes.filter((_, j) => j !== i) }, true)}
            />
          </div>
          <Text id={`le-mt-${i}`} label="Judul" value={m.title} onChange={(title) => setMistake(i, { ...m, title })} />
          <Text id={`le-md-${i}`} label="Penjelasan" value={m.detail} rows={2} onChange={(detail) => setMistake(i, { ...m, detail })} />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => set({ ...c, mistakes: [...c.mistakes, { title: '', detail: '' }] }, true)}
      >
        Tambah kesalahan
      </button>

      <h3 className="h6 mt-4">Catatan Excel asli vs playground</h3>
      <Text
        id="le-pg"
        label="Catatan (kosongkan bila tidak perlu)"
        value={c.playgroundNote ?? ''}
        rows={2}
        onChange={(v) => set({ ...c, playgroundNote: v === '' ? undefined : v })}
      />

      <h3 className="h6 mt-4">Kuis</h3>
      {c.quiz.map((q, i) => (
        <div key={`${rev}-q${i}`} className="xl-panel xl-panel-body mb-2">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Soal {i + 1}</strong>
            <RowTools
              i={i}
              n={c.quiz.length}
              noun="soal"
              onMove={(to) => set({ ...c, quiz: moved(c.quiz, i, to) }, true)}
              onRemove={() => set({ ...c, quiz: c.quiz.filter((_, j) => j !== i) }, true)}
            />
          </div>
          <Text id={`le-qq-${i}`} label="Pertanyaan" value={q.question} rows={2} onChange={(question) => setQuiz(i, { ...q, question })} />
          <ListArea
            id={`le-qo-${i}`}
            label="Pilihan jawaban"
            help="Satu pilihan per baris, 2 sampai 6."
            value={q.options}
            onChange={(options) => setQuiz(i, { ...q, options, answerIndex: Math.min(q.answerIndex, Math.max(0, options.length - 1)) })}
            mode="line"
            rows={4}
          />
          <div className="mb-2">
            <label htmlFor={`le-qa-${i}`} className="form-label">
              Jawaban yang benar
            </label>
            <select
              id={`le-qa-${i}`}
              className="form-select"
              value={q.answerIndex}
              onChange={(e) => setQuiz(i, { ...q, answerIndex: Number(e.target.value) })}
            >
              {q.options.map((o, oi) => (
                <option key={oi} value={oi}>
                  {oi + 1}. {o.length > 70 ? `${o.slice(0, 70)}…` : o}
                </option>
              ))}
            </select>
          </div>
          <Text
            id={`le-qe-${i}`}
            label="Penjelasan jawaban"
            value={q.explanation}
            rows={2}
            onChange={(explanation) => setQuiz(i, { ...q, explanation })}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => set({ ...c, quiz: [...c.quiz, { question: '', options: [], answerIndex: 0, explanation: '' }] }, true)}
      >
        Tambah soal
      </button>
    </div>
  );
}

/**
 * Kolom isi pelajaran di form admin: editor per bagian, atau JSON mentah untuk yang butuh. Keduanya mengubah nilai yang sama.
 * Pratinjau memakai komponen yang sama dengan halaman pelajaran, jadi tampilannya persis sama.
 */
export function LessonField({
  value,
  onChange,
  meta,
  error,
}: {
  value: string;
  onChange: (json: string) => void;
  meta: { title: string; summary: string; minutes: number };
  error?: string;
}) {
  const [json, setJson] = useState(() => parseLesson(value) === null);
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const parsed = parseLesson(value);

  const toEditor = (): void => {
    if (parseLesson(value) === null) {
      setNote('JSON belum valid, jadi belum bisa dibuka di editor. Perbaiki dulu.');
      return;
    }
    setNote(null);
    setJson(false);
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <span className="form-label mb-0">Isi pelajaran</span>
        <div className="d-flex gap-2">
          <button
            type="button"
            className={preview ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-outline-secondary'}
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
            disabled={!parsed}
          >
            Pratinjau
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => (json ? toEditor() : setJson(true))}>
            {json ? 'Kembali ke editor' : 'Edit sebagai JSON'}
          </button>
        </div>
      </div>
      {note && <div className="text-danger xl-small mb-2">{note}</div>}
      {error && <div className="text-danger xl-small mb-2">{error}</div>}
      {json ? (
        <textarea
          className="form-control xl-mono"
          rows={16}
          spellCheck={false}
          aria-label="Isi pelajaran (JSON)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        parsed && <LessonEditor initial={parsed} onChange={(c) => onChange(JSON.stringify(c, null, 2))} />
      )}
      {preview && parsed && (
        <section className="xl-panel xl-panel-body mt-3" aria-label="Pratinjau pelajaran">
          <p className="xl-eyebrow">Pratinjau (belum disimpan)</p>
          <article className="xl-lesson">
            <LessonBody title={meta.title} summary={meta.summary} minutes={meta.minutes} content={parsed} />
          </article>
        </section>
      )}
    </div>
  );
}
