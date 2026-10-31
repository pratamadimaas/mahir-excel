import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Download, Info, Lock } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAuth } from '../../app/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { DatasetPreview, DatasetSummary } from '../../services/types';
import { CheckPanel, checkDatasetFile } from './CheckPanel';

export const FIELD_LABEL: Record<DatasetSummary['field'], string> = { admin: 'Admin', hrd: 'HRD', jualan: 'Jualan', keuangan: 'Keuangan' };
type Tab = 'katalog' | 'cek';
export const PAGE_SIZE = 12;

function PreviewTable({ slug }: { slug: string }) {
  const p = useAsync((s) => api.get<DatasetPreview>(`/datasets/${slug}/preview`, s), [slug]);
  if (p.loading) return <Loading label="Memuat pratinjau…" lines={3} />;
  if (p.error) return <ErrorState message={p.error} onRetry={p.reload} />;
  if (!p.data) return null;
  return (
    <>
      <div className="xl-table-wrap">
        <table className="xl-table xl-small">
          <caption className="visually-hidden">Pratinjau {p.data.rows.length} baris pertama</caption>
          <thead>
            <tr>
              {p.data.headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xl-small xl-muted mb-0">
        {p.data.rows.length} dari {p.data.total} baris.
      </p>
    </>
  );
}

const STORE = 'xl-datasets-downloaded';
function loadDownloaded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveDownloaded(s: Set<string>): void {
  try {
    localStorage.setItem(STORE, JSON.stringify([...s]));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

export function DatasetsPage() {
  useDocumentTitle('Data Latihan Excel');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'cek' ? 'cek' : 'katalog';
  const q = params.get('q') ?? '';
  const field = params.get('bidang') ?? '';
  const wantedPage = Math.max(1, Number.parseInt(params.get('hal') ?? '1', 10) || 1);
  const [onlyDone, setOnlyDone] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => loadDownloaded());
  const data = useAsync((s) => api.get<DatasetSummary[]>('/datasets', s), []);

  const setParam = (k: string, v: string): void => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'hal') next.delete('hal');
    setParams(next, { replace: true });
  };

  const markDone = (slug: string): void => {
    setDone((prev) => {
      const next = new Set(prev).add(slug);
      saveDownloaded(next);
      return next;
    });
  };

  const rows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (data.data ?? []).filter((d) => {
      if (field && d.field !== field) return false;
      if (onlyDone && !done.has(d.slug)) return false;
      const hay = `${d.title} ${d.blurb} ${d.mess} ${FIELD_LABEL[d.field]}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [data.data, q, field, onlyDone, done]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(wantedPage, pages);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goPage = (n: number): void => {
    setParam('hal', n > 1 ? String(n) : '');
    document.getElementById('dl-list')?.scrollIntoView?.({ block: 'start' });
  };

  const titleOf = (slug: string): string | undefined => data.data?.find((d) => d.slug === slug)?.title;

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Bahan latihan</p>
        <h1>Data Latihan</h1>
        <p>
          File berisi data dummy dengan beberapa masalah, seperti spasi berlebih, tanggal yang tersimpan sebagai teks, dan nomor ganda. Daftar gratis untuk mengunduh, lalu kerjakan di Excel dan periksa hasilnya.
        </p>
      </header>

      <div role="tablist" aria-label="Bagian" className="xl-tabs">
        {(['katalog', 'cek'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`dl-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`dl-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setParam('tab', t === 'cek' ? 'cek' : '')}
          >
            {t === 'katalog' ? 'Katalog' : 'Cek hasil'}
            {t === 'cek' && !user?.premium && (
              <span className="xl-tag premium ms-2">
                <Lock className="xl-icon" aria-hidden="true" /> Premium
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'cek' && (
        <div id="dl-panel-cek" role="tabpanel" aria-labelledby="dl-tab-cek" className="mt-3">
          <CheckPanel
            intro="Unggah file data yang sudah kamu kerjakan (yang kamu unduh dari halaman ini). Sistem membaca tiga jawaban di sheet Jawaban dan memeriksanya satu per satu."
            run={(file) => checkDatasetFile(file, titleOf)}
          />
        </div>
      )}

      {tab === 'katalog' && (
        <div id="dl-panel-katalog" role="tabpanel" aria-labelledby="dl-tab-katalog">
          <div className="xl-status info my-3">
            <Info className="xl-icon" aria-hidden="true" />
            <div>
              Semua data yang digunakan bersifat fiktif dan tidak berasal dari orang atau perusahaan sungguhan. Setiap file memiliki sheet Data dan sheet Jawaban yang berisi tiga tugas. Tugas tersebut merupakan panduan. Kamu tetap bisa mengolah data sesuai kebutuhanmu.
            </div>
          </div>

          {!user && (
            <div className="xl-status info mb-3">
              <Lock className="xl-icon" aria-hidden="true" />
              <div>
                Katalog dan pratinjau 10 baris pertama bisa dilihat tanpa akun. Untuk mengunduh file, <Link to="/daftar">daftar gratis</Link> atau <Link to="/masuk">masuk</Link> dulu.
              </div>
            </div>
          )}

          <form className="xl-filters mt-3" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Cari data latihan">
            <div className="xl-filter-grow">
              <label htmlFor="dl-q" className="form-label">
                Cari data
              </label>
              <input
                id="dl-q"
                type="search"
                className="form-control"
                value={q}
                placeholder="mis. absensi, stok, piutang"
                onChange={(e) => setParam('q', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dl-field" className="form-label">
                Bidang
              </label>
              <select id="dl-field" className="form-select" value={field} onChange={(e) => setParam('bidang', e.target.value)}>
                <option value="">Semua bidang</option>
                {Object.entries(FIELD_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="align-self-end">
              <div className="form-check mb-2">
                <input
                  id="dl-done"
                  type="checkbox"
                  className="form-check-input"
                  checked={onlyDone}
                  onChange={(e) => setOnlyDone(e.target.checked)}
                />
                <label htmlFor="dl-done" className="form-check-label">
                  Sudah diunduh ({done.size})
                </label>
              </div>
            </div>
          </form>

          {data.loading && <Loading label="Memuat data latihan…" lines={5} />}
          {data.error && <ErrorState message={data.error} onRetry={data.reload} />}

          {data.data && (
            <>
              <p className="xl-muted xl-small" id="dl-list" role="status">
                {pages > 1
                  ? `Menampilkan ${(page - 1) * PAGE_SIZE + 1} sampai ${(page - 1) * PAGE_SIZE + shown.length} dari ${rows.length} file`
                  : `Menampilkan ${rows.length} dari ${data.data.length} file`}
              </p>
              {rows.length === 0 ? (
                <EmptyState title="Data tidak ditemukan">Coba kata kunci lain atau hapus filter.</EmptyState>
              ) : (
                <div className="xl-table-wrap">
                  <table className="xl-table xl-dataset-table">
                    <caption className="visually-hidden">Daftar data latihan</caption>
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Unduh</th>
                        <th scope="col" className="d-none d-md-table-cell">
                          Bidang
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((d) => (
                        <tr key={d.slug}>
                          <td>
                            <strong>{d.title}</strong>
                            <div className="xl-small xl-muted">{d.blurb}</div>
                            <div className="xl-small">
                              <b className="xl-dataset-mess">Kondisi data:</b> {d.mess}
                            </div>
                            <details className="xl-small mt-1">
                              <summary>Tugas yang disarankan</summary>
                              <ol className="mb-0">
                                {d.tasks.map((t) => (
                                  <li key={t}>{t}</li>
                                ))}
                              </ol>
                            </details>
                            <details className="xl-small mt-1">
                              <summary>Lihat 10 baris pertama</summary>
                              <PreviewTable slug={d.slug} />
                            </details>
                          </td>
                          <td className="text-nowrap">
                            {!user ? (
                              <Link className="btn btn-primary btn-sm" to="/daftar" aria-label={`Daftar untuk mengunduh ${d.title}`}>
                                <Lock className="xl-icon" aria-hidden="true" /> Daftar untuk mengunduh
                              </Link>
                            ) : (
                            <div className="d-flex gap-2">
                              <a
                                className="btn btn-primary btn-sm"
                                href={`/api/datasets/${d.slug}/download`}
                                download
                                onClick={() => markDone(d.slug)}
                                aria-label={`Unduh ${d.title} (.xlsx)`}
                              >
                                <Download className="xl-icon" aria-hidden="true" /> .xlsx
                              </a>
                              <a
                                className="btn btn-outline-secondary btn-sm"
                                href={`/api/datasets/${d.slug}/download?format=csv`}
                                download
                                onClick={() => markDone(d.slug)}
                                aria-label={`Unduh ${d.title} (.csv)`}
                              >
                                .csv
                              </a>
                            </div>
                            )}
                            <div className="xl-small xl-muted mt-1">
                              {d.rows} baris · {d.cols} kolom
                            </div>
                          </td>
                          <td className="d-none d-md-table-cell">
                            <span className={`xl-tag xl-field-${d.field}`}>{FIELD_LABEL[d.field]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pages > 1 && (
                <nav className="d-flex align-items-center justify-content-between gap-2 mt-3" aria-label="Halaman daftar data latihan">
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                    Sebelumnya
                  </button>
                  <span className="xl-small" aria-live="polite">
                    Halaman {page} dari {pages}
                  </span>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                    Berikutnya
                  </button>
                </nav>
              )}
              <p className="xl-small xl-muted mt-3">
                Setelah selesai, buka tab <Link to="/data-latihan?tab=cek">Cek hasil</Link> untuk memeriksa jawabanmu.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
