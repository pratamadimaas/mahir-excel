import { useState } from 'react';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api, errorMessage } from '../../services/api';

interface Entry {
  id: number;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  hidden: boolean;
  at: string;
  email: string | null;
}

interface Data {
  total: number;
  hidden: number;
  entries: Entry[];
}

const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

/** Moderasi papan peringkat Sprint: sembunyikan nama yang tidak pantas atau skor yang mencurigakan. */
export function AdminSprint() {
  const list = useAsync((s) => api.get<Data>('/admin/sprint', s), []);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (e: Entry): Promise<void> => {
    setError(null);
    try {
      await api.put(`/admin/sprint/${e.id}`, { hidden: !e.hidden });
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <h2 className="h5">Sprint: moderasi papan peringkat</h2>
      <p className="xl-muted">
        100 skor terbaru. Menyembunyikan skor menghapusnya dari papan publik tanpa menghapus datanya.
        {list.data && ` Total ${list.data.total} skor, ${list.data.hidden} disembunyikan.`}
      </p>
      {error && (
        <Status tone="error" live>
          {error}
        </Status>
      )}
      {list.loading && <Loading label="Memuat skor…" />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && list.data.entries.length === 0 && <EmptyState title="Belum ada skor Sprint" />}
      {list.data && list.data.entries.length > 0 && (
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Skor Sprint terbaru</caption>
            <thead>
              <tr>
                <th scope="col">Waktu</th>
                <th scope="col">Nama</th>
                <th scope="col">Skor</th>
                <th scope="col">Benar</th>
                <th scope="col">Salah</th>
                <th scope="col">Akun</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.entries.map((e) => (
                <tr key={e.id} className={e.hidden ? 'text-decoration-line-through text-muted' : undefined}>
                  <td className="text-nowrap">{dateTime.format(new Date(e.at))}</td>
                  <td>{e.name}</td>
                  <td>{e.score}</td>
                  <td>{e.correct}</td>
                  <td>{e.wrong}</td>
                  <td>{e.email ?? 'Tanpa akun'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      aria-label={`${e.hidden ? 'Tampilkan' : 'Sembunyikan'} skor ${e.name}`}
                      onClick={() => void toggle(e)}
                    >
                      {e.hidden ? 'Tampilkan' : 'Sembunyikan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
