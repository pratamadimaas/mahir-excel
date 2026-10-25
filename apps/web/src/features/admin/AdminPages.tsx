import { useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router';
import { useAuth } from '../../app/AuthContext';
import { ConfirmDialog, EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiError, errorMessage } from '../../services/api';

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'bool' | 'json' | 'nullable';
interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  help?: string;
}
interface ResourceConfig {
  title: string;
  singular: string;
  columns: { key: string; label: string }[];
  fields: Field[];
  empty: Record<string, unknown>;
  preview?: (item: Record<string, unknown>) => string | null;
}

const DIFF = ['mudah', 'sedang', 'sulit'];

const RESOURCES: Record<string, ResourceConfig> = {
  modules: {
    title: 'Modul',
    singular: 'modul',
    columns: [
      { key: 'sortOrder', label: 'Urutan' },
      { key: 'slug', label: 'Slug' },
      { key: 'title', label: 'Judul' },
    ],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text', help: 'Huruf kecil, angka, tanda hubung.' },
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'summary', label: 'Ringkasan', type: 'textarea' },
      { key: 'sortOrder', label: 'Urutan', type: 'number' },
      { key: 'published', label: 'Diterbitkan', type: 'bool' },
    ],
    empty: { slug: '', title: '', summary: '', sortOrder: 10, published: false },
  },
  lessons: {
    title: 'Pelajaran',
    singular: 'pelajaran',
    columns: [
      { key: 'moduleSlug', label: 'Modul' },
      { key: 'sortOrder', label: 'Urutan' },
      { key: 'title', label: 'Judul' },
    ],
    fields: [
      { key: 'moduleSlug', label: 'Slug modul', type: 'text' },
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'summary', label: 'Ringkasan', type: 'textarea' },
      { key: 'minutes', label: 'Durasi (menit)', type: 'number' },
      { key: 'sortOrder', label: 'Urutan', type: 'number' },
      { key: 'published', label: 'Diterbitkan', type: 'bool' },
      {
        key: 'content',
        label: 'Konten (JSON)',
        type: 'json',
        help: 'objectives, sections, syntax (opsional), example, mistakes, playgroundNote (opsional), quiz.',
      },
    ],
    empty: {
      moduleSlug: '',
      slug: '',
      title: '',
      summary: '',
      minutes: 10,
      sortOrder: 10,
      published: false,
      content: {
        objectives: ['Tujuan belajar'],
        sections: [{ heading: 'Judul bagian', paragraphs: ['Isi paragraf.'] }],
        example: {
          title: 'Contoh',
          description: 'Deskripsi',
          table: [
            ['A', 'B'],
            [1, 2],
          ],
          formula: '=A2+B2',
          result: '3',
          walkthrough: 'Penjelasan langkah.',
        },
        mistakes: [{ title: 'Kesalahan umum', detail: 'Penjelasan.' }],
        quiz: [{ question: 'Pertanyaan?', options: ['A', 'B'], answerIndex: 0, explanation: 'Alasan.' }],
      },
    },
    preview: (i) => `/belajar/${String(i.slug)}?preview=1`,
  },
  exercises: {
    title: 'Latihan',
    singular: 'latihan',
    columns: [
      { key: 'topic', label: 'Topik' },
      { key: 'slug', label: 'Slug' },
      { key: 'title', label: 'Judul' },
      { key: 'difficulty', label: 'Tingkat' },
    ],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'description', label: 'Deskripsi singkat', type: 'text' },
      { key: 'topic', label: 'Slug modul (topik)', type: 'text' },
      { key: 'difficulty', label: 'Tingkat', type: 'select', options: DIFF },
      { key: 'rows', label: 'Jumlah baris grid', type: 'number' },
      { key: 'cols', label: 'Jumlah kolom grid', type: 'number' },
      { key: 'points', label: 'Poin', type: 'number' },
      { key: 'lessonSlug', label: 'Slug pelajaran terkait (opsional)', type: 'nullable' },
      { key: 'sortOrder', label: 'Urutan', type: 'number' },
      { key: 'published', label: 'Diterbitkan', type: 'bool' },
      { key: 'task', label: 'Tugas', type: 'textarea' },
      { key: 'cells', label: 'Data awal sel (JSON: {"A1":"Barang"})', type: 'json' },
      { key: 'editable', label: 'Sel yang boleh diubah (JSON: ["B7"] atau ["C2:C5"])', type: 'json' },
      { key: 'hints', label: 'Petunjuk bertahap (JSON array; yang terakhir hanya terbuka lewat Lihat solusi)', type: 'json' },
      { key: 'explanation', label: 'Penjelasan jawaban', type: 'textarea' },
      {
        key: 'tools',
        label: 'Alat sort/filter (JSON, opsional)',
        type: 'json',
        help: 'Contoh: {"sort":{"range":"A1:C8"},"filter":{"range":"A1:C8"}}. Baris pertama rentang = judul kolom; rentang harus ada di sel yang boleh diubah bila dipakai untuk sort.',
      },
      {
        key: 'validation',
        label: 'Validasi jawaban (JSON)',
        type: 'json',
        help: 'targets [{cell, solution, requireFunction?, exactText?}], variants, rules, requirePatterns, tolerance. Jawaban acuan harus lolos validasinya sendiri.',
      },
    ],
    empty: {
      slug: '',
      title: '',
      description: '',
      topic: 'rumus-dasar',
      difficulty: 'mudah',
      rows: 8,
      cols: 4,
      points: 10,
      lessonSlug: null,
      sortOrder: 100,
      published: false,
      task: '',
      cells: { A1: 'Angka', A2: '1', A3: '2' },
      editable: ['A4'],
      hints: ['Petunjuk 1', 'Petunjuk 2', 'Petunjuk terakhir (jawaban)'],
      explanation: '',
      validation: { targets: [{ cell: 'A4', solution: '=SUM(A2:A3)', requireFunction: 'SUM' }], variants: [{ A2: '5' }] },
      tools: null,
    },
    preview: (i) => `/latihan/${String(i.slug)}?preview=1`,
  },
  shortcuts: {
    title: 'Shortcut',
    singular: 'shortcut',
    columns: [
      { key: 'category', label: 'Kategori' },
      { key: 'action', label: 'Aksi' },
      { key: 'keysWindows', label: 'Windows' },
      { key: 'keysMac', label: 'Mac' },
    ],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'action', label: 'Aksi', type: 'text' },
      { key: 'keysWindows', label: 'Tombol Windows (mis. Ctrl + Shift + L)', type: 'nullable' },
      { key: 'keysMac', label: 'Tombol Mac', type: 'nullable' },
      {
        key: 'category',
        label: 'Kategori',
        type: 'select',
        options: ['navigasi', 'edit-sel', 'format', 'seleksi', 'data', 'rumus', 'lembar-kerja'],
      },
      { key: 'explanation', label: 'Penjelasan', type: 'textarea' },
      { key: 'example', label: 'Contoh praktis (opsional)', type: 'nullable' },
      { key: 'verification', label: 'Status verifikasi / catatan sumber', type: 'textarea' },
      { key: 'published', label: 'Diterbitkan', type: 'bool' },
    ],
    empty: {
      slug: '',
      action: '',
      keysWindows: '',
      keysMac: '',
      category: 'navigasi',
      explanation: '',
      example: '',
      verification: '',
      published: false,
    },
  },
  worksheets: {
    title: 'Worksheet',
    singular: 'worksheet',
    columns: [
      { key: 'sortOrder', label: 'Urutan' },
      { key: 'slug', label: 'Slug' },
      { key: 'title', label: 'Judul' },
      { key: 'fileName', label: 'File' },
    ],
    fields: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'description', label: 'Deskripsi', type: 'textarea' },
      { key: 'objective', label: 'Tujuan belajar', type: 'textarea' },
      { key: 'difficulty', label: 'Tingkat', type: 'select', options: DIFF },
      { key: 'skills', label: 'Keterampilan (JSON array)', type: 'json' },
      { key: 'instructions', label: 'Petunjuk (JSON array)', type: 'json' },
      {
        key: 'fileName',
        label: 'Nama file (.xlsx di folder worksheet server)',
        type: 'text',
        help: 'File harus ada di folder penyimpanan server; nama divalidasi (huruf kecil, angka, tanda hubung).',
      },
      { key: 'keyFileName', label: 'Nama file kunci jawaban (opsional)', type: 'nullable' },
      { key: 'sortOrder', label: 'Urutan', type: 'number' },
      { key: 'published', label: 'Diterbitkan', type: 'bool' },
    ],
    empty: {
      slug: '',
      title: '',
      description: '',
      objective: '',
      difficulty: 'mudah',
      skills: [],
      instructions: [],
      fileName: '',
      keyFileName: null,
      sortOrder: 100,
      published: false,
    },
    preview: (i) => `/worksheet/${String(i.slug)}`,
  },
};

export function AdminLayout() {
  useDocumentTitle('Admin');
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="xl-page">
        <Loading />
      </div>
    );
  if (!user) return <Navigate to="/masuk" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="xl-page xl-page-narrow py-5">
        <Status tone="error" live>
          Halaman ini hanya untuk administrator.
        </Status>
      </div>
    );
  }
  return (
    <div className="xl-page">
      <header className="xl-page-head pb-2">
        <p className="xl-eyebrow">Admin</p>
        <h1>Kelola konten</h1>
        <nav className="xl-tabs" aria-label="Bagian admin">
          <NavLink to="/admin" end>
            Ringkasan
          </NavLink>
          <NavLink to="/admin/pengguna">Pengguna</NavLink>
          <NavLink to="/admin/premium">Premium</NavLink>
          <NavLink to="/admin/pertumbuhan">Pertumbuhan</NavLink>
          <NavLink to="/admin/sprint">Sprint</NavLink>
          <NavLink to="/admin/laporan">Laporan</NavLink>
          {Object.entries(RESOURCES).map(([k, r]) => (
            <NavLink key={k} to={`/admin/${k}`}>
              {r.title}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

type Item = Record<string, unknown> & { id: number };

function toFormValues(cfg: ResourceConfig, item: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of cfg.fields) {
    const v = item[f.key];
    if (f.type === 'bool') out[f.key] = !!v;
    else if (f.type === 'json') out[f.key] = JSON.stringify(v ?? null, null, 2);
    else out[f.key] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

function toBody(
  cfg: ResourceConfig,
  vals: Record<string, string | boolean>,
): { body: Record<string, unknown>; errors: Record<string, string> } {
  const body: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of cfg.fields) {
    const v = vals[f.key];
    if (f.type === 'bool') body[f.key] = !!v;
    else if (f.type === 'number') {
      const n = Number(v);
      if (v === '' || Number.isNaN(n)) errors[f.key] = 'Harus berupa angka.';
      body[f.key] = n;
    } else if (f.type === 'json') {
      try {
        body[f.key] = JSON.parse(String(v));
      } catch {
        errors[f.key] = 'JSON tidak valid.';
      }
    } else if (f.type === 'nullable') body[f.key] = String(v).trim() === '' ? null : String(v).trim();
    else body[f.key] = String(v).trim();
  }
  return { body, errors };
}

function ResourceForm({
  cfg,
  resource,
  initial,
  id,
  onDone,
  onCancel,
}: {
  cfg: ResourceConfig;
  resource: string;
  initial: Record<string, unknown>;
  id?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState(() => toFormValues(cfg, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<{ message: string; details?: { path: string; message: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const { body, errors: errs } = toBody(cfg, vals);
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (id) await api.put(`/admin/${resource}/${id}`, body);
      else await api.post(`/admin/${resource}`, body);
      onDone();
    } catch (err) {
      setServerError({
        message: errorMessage(err),
        details: err instanceof ApiError ? (err.details as { path: string; message: string }[] | undefined) : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="xl-panel xl-panel-body mb-4"
      aria-label={id ? `Ubah ${cfg.singular}` : `Tambah ${cfg.singular}`}
      noValidate
    >
      <h2 className="h5">{id ? `Ubah ${cfg.singular}` : `Tambah ${cfg.singular}`}</h2>
      {serverError && (
        <Status tone="error" live>
          {serverError.message}
          {serverError.details && (
            <ul>
              {serverError.details.map((d, i) => (
                <li key={i}>
                  <code>{d.path || '(root)'}</code>: {d.message}
                </li>
              ))}
            </ul>
          )}
        </Status>
      )}
      <div className="row g-3 mt-1">
        {cfg.fields.map((f) => {
          const fid = `f-${f.key}`;
          const err = errors[f.key];
          const wide = f.type === 'json' || f.type === 'textarea';
          return (
            <div key={f.key} className={wide ? 'col-12' : 'col-12 col-md-6'}>
              {f.type === 'bool' ? (
                <div className="form-check">
                  <input
                    id={fid}
                    type="checkbox"
                    className="form-check-input"
                    checked={!!vals[f.key]}
                    onChange={(e) => setVals({ ...vals, [f.key]: e.target.checked })}
                  />
                  <label htmlFor={fid} className="form-check-label">
                    {f.label}
                  </label>
                </div>
              ) : (
                <>
                  <label htmlFor={fid} className="form-label">
                    {f.label}
                  </label>
                  {f.type === 'textarea' || f.type === 'json' ? (
                    <textarea
                      id={fid}
                      className={`form-control${err ? ' is-invalid' : ''}${f.type === 'json' ? ' xl-mono' : ''}`}
                      rows={f.type === 'json' ? 10 : 3}
                      spellCheck={false}
                      value={String(vals[f.key])}
                      aria-invalid={!!err}
                      aria-describedby={err ? `${fid}-err` : undefined}
                      onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={fid}
                      className="form-select"
                      value={String(vals[f.key])}
                      onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                    >
                      {f.options!.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={fid}
                      type={f.type === 'number' ? 'number' : 'text'}
                      className={`form-control${err ? ' is-invalid' : ''}`}
                      value={String(vals[f.key])}
                      aria-invalid={!!err}
                      aria-describedby={err ? `${fid}-err` : undefined}
                      onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                    />
                  )}
                  {f.help && <div className="form-text">{f.help}</div>}
                  {err && (
                    <div id={`${fid}-err`} className="invalid-feedback">
                      {err}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="d-flex gap-2 mt-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}

export function AdminResourcePage() {
  const { resource = '' } = useParams();
  const cfg = RESOURCES[resource];
  const list = useAsync((s) => (cfg ? api.get<Item[]>(`/admin/${resource}?pageSize=100`, s) : Promise.resolve([] as Item[])), [resource]);
  const [form, setForm] = useState<{ id?: number; initial: Record<string, unknown> } | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useDocumentTitle(cfg ? `Admin: ${cfg.title}` : undefined);

  if (!cfg)
    return (
      <EmptyState title="Bagian admin tidak ditemukan">
        <Link to="/admin">Kembali</Link>
      </EmptyState>
    );

  const open = async (item: Item): Promise<void> => {
    try {
      const full = await api.get<Item>(`/admin/${resource}/${item.id}`);
      setForm({ id: item.id, initial: full });
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  };

  const togglePublish = async (item: Item): Promise<void> => {
    try {
      const full = await api.get<Item>(`/admin/${resource}/${item.id}`);
      const { id: _id, ...rest } = full;
      await api.put(`/admin/${resource}/${item.id}`, { ...rest, published: !full.published });
      setMessage({
        tone: 'success',
        text: `${cfg.title} “${String(item.title ?? item.action ?? item.slug)}” ${full.published ? 'disembunyikan' : 'diterbitkan'}.`,
      });
      list.reload();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  };

  const remove = async (): Promise<void> => {
    if (!toDelete) return;
    try {
      await api.del(`/admin/${resource}/${toDelete.id}`);
      setMessage({ tone: 'success', text: `${cfg.title} dihapus.` });
      list.reload();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    } finally {
      setToDelete(null);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">{cfg.title}</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ initial: cfg.empty })}>
          Tambah {cfg.singular}
        </button>
      </div>
      {message && (
        <Status tone={message.tone} live>
          {message.text}
        </Status>
      )}
      <div className="mt-3" />
      {form && (
        <ResourceForm
          key={form.id ?? 'new'}
          cfg={cfg}
          resource={resource}
          initial={form.initial}
          id={form.id}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null);
            setMessage({ tone: 'success', text: 'Tersimpan.' });
            list.reload();
          }}
        />
      )}
      {list.loading && <Loading />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <EmptyState title={`Belum ada ${cfg.singular}`} />}
      {list.data && list.data.length > 0 && (
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Daftar {cfg.singular}</caption>
            <thead>
              <tr>
                {cfg.columns.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
                <th scope="col">Status</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id}>
                  {cfg.columns.map((c) => (
                    <td key={c.key}>{String(item[c.key] ?? '')}</td>
                  ))}
                  <td>
                    {item.published ? <span className="text-success fw-semibold">Terbit</span> : <span className="xl-muted">Draf</span>}
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void open(item)}>
                        Ubah
                      </button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void togglePublish(item)}>
                        {item.published ? 'Sembunyikan' : 'Terbitkan'}
                      </button>
                      {cfg.preview && cfg.preview(item) && (
                        <Link className="btn btn-outline-secondary btn-sm" to={cfg.preview(item) as string}>
                          Pratinjau
                        </Link>
                      )}
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setToDelete(item)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={`Hapus ${cfg.singular}?`}
        confirmLabel="Hapus"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      >
        <p className="mb-0">
          “{String(toDelete?.title ?? toDelete?.action ?? toDelete?.slug ?? '')}” akan dihapus permanen
          {resource === 'lessons' ? ' beserta penanda penyelesaian pengguna' : ''}. Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmDialog>
    </>
  );
}
