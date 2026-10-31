import { Link, useParams } from 'react-router';
import { Download, FileSpreadsheet, KeyRound, Lock } from 'lucide-react';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAuth } from '../../app/AuthContext';
import { Level } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import { formatBytes, type WorksheetView } from '../../services/types';
import { CheckPanel, checkWorksheetFile } from '../datasets/CheckPanel';

export function WorksheetsPage() {
  useDocumentTitle('Worksheet');
  const { user } = useAuth();
  const ws = useAsync((s) => api.get<WorksheetView[]>('/worksheets', s), []);
  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Sumber belajar</p>
        <h1>Worksheet siap unduh</h1>
        <p>
          File Excel (.xlsx) untuk berlatih di aplikasi Excel-mu sendiri. Setiap worksheet punya sheet Petunjuk dan Latihan. Semua worksheet
          gratis diunduh; kunci jawaban dan pemeriksaan hasil untuk anggota Premium.
        </p>
      </header>
      {ws.loading && <Loading label="Memuat worksheet…" lines={5} />}
      {ws.error && <ErrorState message={ws.error} onRetry={ws.reload} />}
      {ws.data && ws.data.length === 0 && <EmptyState title="Belum ada worksheet" />}
      {ws.data && ws.data.length > 0 && (
        <ul className="xl-file-list xl-file-list-lg">
          {ws.data.map((w) => (
            <li key={w.slug}>
              <FileSpreadsheet className="xl-icon xl-file-icon" aria-hidden="true" />
              <div className="xl-file-main">
                <Link to={`/worksheet/${w.slug}`} className="xl-file-title">
                  {w.title}
                </Link>
                <span className="xl-muted xl-small">{w.description}</span>
                <span className="xl-small xl-skills">{w.skills.join(' · ')}</span>
              </div>
              <Level difficulty={w.difficulty} />
              <span className="xl-muted xl-small text-nowrap d-none d-md-inline">.xlsx · {formatBytes(w.fileSize)}</span>
              {w.available && w.premiumOnly && !user?.premium ? (
                <Link className="btn btn-outline-secondary btn-sm" to="/premium">
                  <Lock className="xl-icon" aria-hidden="true" />
                  Premium
                </Link>
              ) : w.available ? (
                <a className="btn btn-primary btn-sm" href={`/api/worksheets/${w.slug}/download`} download>
                  <Download className="xl-icon" aria-hidden="true" />
                  Unduh
                </a>
              ) : (
                <span className="xl-muted xl-small">Belum tersedia</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WorksheetDetailPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const ws = useAsync((s) => api.get<WorksheetView>(`/worksheets/${encodeURIComponent(slug)}`, s), [slug]);
  useDocumentTitle(ws.data?.title);

  if (ws.loading) {
    return (
      <div className="xl-page">
        <Loading label="Memuat worksheet…" lines={5} />
      </div>
    );
  }
  if (ws.error || !ws.data) {
    const nf = ws.error?.includes('tidak ditemukan');
    return (
      <div className="xl-page py-4">
        {nf ? (
          <EmptyState title="Worksheet tidak ditemukan">
            <Link to="/worksheet">Lihat semua worksheet</Link>
          </EmptyState>
        ) : (
          <ErrorState message={ws.error ?? 'Worksheet tidak tersedia.'} onRetry={ws.reload} />
        )}
      </div>
    );
  }
  const w = ws.data;
  const rows = w.preview?.rows ?? [];
  const cols = rows.reduce((n, r) => Math.max(n, r.length), 0);

  return (
    <div className="xl-page">
      <nav aria-label="Breadcrumb" className="xl-breadcrumb">
        <Link to="/worksheet">Worksheet</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{w.title}</span>
      </nav>
      <div className="xl-lesson-layout">
        <article className="xl-lesson">
          <h1>{w.title}</h1>
          <p className="xl-muted">{w.description}</p>

          <section aria-labelledby="ws-tujuan">
            <h2 id="ws-tujuan">Tujuan belajar</h2>
            <p>{w.objective}</p>
          </section>

          <section aria-labelledby="ws-petunjuk">
            <h2 id="ws-petunjuk">Petunjuk</h2>
            <ol>
              {w.instructions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="ws-preview">
            <h2 id="ws-preview">Pratinjau sheet “{w.preview?.sheet ?? 'Latihan'}”</h2>
            {rows.length > 0 ? (
              <>
                <div className="xl-table-wrap">
                  <table className="xl-table">
                    <caption className="visually-hidden">Contoh isi worksheet (kolom jawaban masih kosong)</caption>
                    <thead>
                      <tr>
                        {Array.from({ length: cols }, (_, c) => (
                          <th key={c} scope="col">
                            {rows[0]![c] || ' '}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(1).map((r, i) => (
                        <tr key={i}>
                          {Array.from({ length: cols }, (_, c) => (
                            <td key={c}>{r[c]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="xl-small xl-muted mt-2">
                  Menampilkan sebagian baris pertama. Sel jawaban kosong di file latihan dan diberi warna kuning.
                </p>
              </>
            ) : (
              <p className="xl-muted">Pratinjau belum tersedia.</p>
            )}
          </section>
          {(w.answerCells?.length ?? 0) > 0 && (
            <section aria-labelledby="ws-cek">
              <h2 id="ws-cek">Periksa hasilmu</h2>
              <CheckPanel
                intro="Kerjakan sheet Latihan di Excel, simpan, lalu unggah file yang sama di sini. Sistem memeriksa tiap sel jawaban dan menunjukkan mana yang belum tepat."
                run={(file) => checkWorksheetFile(file, w.slug, w.answerCells ?? [])}
              />
            </section>
          )}
        </article>

        <aside className="xl-lesson-aside" aria-label="Unduhan">
          <h2 className="h6">Unduh</h2>
          <dl className="xl-meta">
            <div>
              <dt>Tingkat</dt>
              <dd>
                <Level difficulty={w.difficulty} />
              </dd>
            </div>
            <div>
              <dt>Jenis file</dt>
              <dd>Excel Workbook (.{w.fileType})</dd>
            </div>
            <div>
              <dt>Ukuran</dt>
              <dd>{formatBytes(w.fileSize)}</dd>
            </div>
            <div>
              <dt>Keterampilan</dt>
              <dd>{w.skills.join(', ')}</dd>
            </div>
          </dl>
          {w.available && w.premiumOnly && !user?.premium ? (
            <Link className="btn btn-primary w-100 mb-2" to="/premium">
              <Lock className="xl-icon" aria-hidden="true" />
              Worksheet ini khusus Premium
            </Link>
          ) : w.available ? (
            <a className="btn btn-primary w-100 mb-2" href={`/api/worksheets/${w.slug}/download`} download>
              <Download className="xl-icon" aria-hidden="true" />
              Unduh worksheet
            </a>
          ) : (
            <Status tone="warning">File belum tersedia.</Status>
          )}
          {w.keyAvailable && (
            <>
              {user?.premium ? (
                <a className="btn btn-outline-secondary w-100" href={`/api/worksheets/${w.slug}/download?answer=1`} download>
                  <KeyRound className="xl-icon" aria-hidden="true" />
                  Kunci jawaban ({formatBytes(w.keySize)})
                </a>
              ) : (
                <Link className="btn btn-outline-secondary w-100" to="/premium">
                  <KeyRound className="xl-icon" aria-hidden="true" />
                  Kunci jawaban (Premium)
                </Link>
              )}
              <p className="xl-small xl-muted mt-2">Coba kerjakan sendiri dulu sebelum membuka kunci jawaban.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
