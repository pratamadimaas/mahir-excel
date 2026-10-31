import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Download, Info, Lock } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAuth } from '../../app/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { DatasetSummary } from '../../services/types';
import { CheckPanel, checkDatasetFile } from './CheckPanel';

export const FIELD_LABEL: Record<DatasetSummary['field'], string> = { admin: 'Admin', hrd: 'HRD', jualan: 'Jualan', keuangan: 'Keuangan' };
type Tab = 'katalog' | 'cek';

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
  const [onlyDone, setOnlyDone] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => loadDownloaded());
  const data = useAsync((s) => api.get<DatasetSummary[]>('/datasets', s), []);

  const setParam = (k: string, v: string): void => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
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

  const titleOf = (slug: string): string | undefined => data.data?.find((d) => d.slug === slug)?.title;

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Bahan latihan</p>
        <h1>Data Latihan</h1>
        <p>
          Data dummy yang berantakan seperti di kantor: spasi nyasar, tanggal yang bukan tanggal, nomor ganda. Unduh gratis, kerjakan di
          Excel, lalu periksa hasilmu.
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
              Semua data fiktif, tidak ada data orang atau perusahaan sungguhan. Tiap file punya sheet Data dan sheet Jawaban berisi tiga
              tugas. Tugas itu hanya saran; kamu boleh mengolah datanya sesukamu.
            </div>
          </div>

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
              <p className="xl-muted xl-small" role="status">
                Menampilkan {rows.length} dari {data.data.length} file
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
                      {rows.map((d) => (
                        <tr key={d.slug}>
                          <td>
                            <strong>{d.title}</strong>
                            <div className="xl-small xl-muted">{d.blurb}</div>
                            <div className="xl-small">
                              <b className="xl-dataset-mess">Yang bikin repot:</b> {d.mess}
                            </div>
                            <details className="xl-small mt-1">
                              <summary>Tugas yang disarankan</summary>
                              <ol className="mb-0">
                                {d.tasks.map((t) => (
                                  <li key={t}>{t}</li>
                                ))}
                              </ol>
                            </details>
                          </td>
                          <td className="text-nowrap">
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
              <p className="xl-small xl-muted mt-3">
                Sudah dikerjakan? Buka tab <Link to="/data-latihan?tab=cek">Cek hasil</Link> untuk memeriksa jawabanmu.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
