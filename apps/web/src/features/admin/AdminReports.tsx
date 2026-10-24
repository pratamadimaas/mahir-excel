import { useState } from 'react';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api, errorMessage } from '../../services/api';

interface Report {
  id: number;
  reason: string;
  note: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  exerciseSlug: string;
  exerciseTitle: string;
  email: string;
  openForExercise: number;
}

const REASON_LABELS: Record<string, string> = {
  'tidak-jelas': 'Soal tidak jelas',
  'jawaban-meragukan': 'Jawaban meragukan',
  'salah-ketik': 'Salah ketik',
  lainnya: 'Lainnya',
};

const when = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

export function AdminReports() {
  const [all, setAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useAsync((s) => api.get<Report[]>(`/admin/reports?status=${all ? 'all' : 'open'}`, s), [all]);

  const resolve = async (id: number): Promise<void> => {
    setError(null);
    try {
      await api.put(`/admin/reports/${id}/resolve`);
      list.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <section aria-labelledby="laporan-judul">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 id="laporan-judul" className="h4 mb-1">
            Laporan soal
          </h2>
          <p className="xl-muted mb-0">Laporan dari pengguna tentang latihan yang membingungkan atau keliru. Tandai selesai setelah diperbaiki.</p>
        </div>
        <label className="d-flex align-items-center gap-2">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Tampilkan yang sudah selesai
        </label>
      </div>
      {error && <Status tone="error" live>{error}</Status>}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading label="Memuat laporan…" lines={3} />}
      {list.data && list.data.length === 0 && <EmptyState title="Belum ada laporan">Laporan dari pengguna akan muncul di sini.</EmptyState>}
      {list.data && list.data.length > 0 && (
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Daftar laporan soal</caption>
            <thead>
              <tr>
                <th scope="col">Latihan</th>
                <th scope="col">Masalah</th>
                <th scope="col">Pelapor</th>
                <th scope="col">Waktu</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`/latihan/${r.exerciseSlug}`}>{r.exerciseTitle}</a>
                    {r.openForExercise > 1 && !r.resolvedAt && <div className="xl-small xl-muted">{r.openForExercise} laporan terbuka</div>}
                  </td>
                  <td>
                    <strong>{REASON_LABELS[r.reason] ?? r.reason}</strong>
                    {r.note && <div className="xl-small">{r.note}</div>}
                  </td>
                  <td className="xl-small">{r.email}</td>
                  <td className="xl-small text-nowrap">{r.createdAt ? when.format(new Date(r.createdAt)) : ''}</td>
                  <td>
                    {r.resolvedAt ? (
                      <span className="xl-small xl-muted">Selesai</span>
                    ) : (
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void resolve(r.id)} aria-label={`Tandai selesai: ${r.exerciseTitle}`}>
                        Tandai selesai
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
