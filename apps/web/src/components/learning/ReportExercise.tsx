import { useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { api, errorMessage } from '../../services/api';
import { Status } from '../feedback/Feedback';

const REASONS = [
  { value: 'tidak-jelas', label: 'Soalnya tidak jelas' },
  { value: 'jawaban-meragukan', label: 'Jawaban acuannya meragukan' },
  { value: 'salah-ketik', label: 'Ada salah ketik' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

/** Tombol kecil untuk melaporkan latihan yang membingungkan atau keliru. Laporan masuk ke halaman admin. */
export function ReportExercise({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('tidak-jelas');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'baru' | 'kembar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ duplicate: boolean }>(`/exercises/${slug}/report`, { reason, note: note.trim() || undefined });
      setDone(res.duplicate ? 'kembar' : 'baru');
      setOpen(false);
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Status tone="success" live>
        {done === 'baru' ? 'Terima kasih, laporanmu sudah kami terima.' : 'Kamu sudah melaporkan soal ini dan laporannya masih kami periksa. Terima kasih.'}
      </Status>
    );
  }

  return (
    <div className="xl-report">
      {!open ? (
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setOpen(true)}>
          <Flag className="xl-icon" aria-hidden="true" /> Laporkan soal ini
        </button>
      ) : (
        <form onSubmit={(e) => void send(e)} aria-label="Laporkan soal" className="xl-panel xl-panel-body">
          <label htmlFor={`lapor-alasan-${slug}`} className="form-label mb-1">
            Apa masalahnya?
          </label>
          <select id={`lapor-alasan-${slug}`} className="form-select form-select-sm mb-2" value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <label htmlFor={`lapor-catatan-${slug}`} className="form-label mb-1">
            Catatan (boleh dikosongkan)
          </label>
          <textarea
            id={`lapor-catatan-${slug}`}
            className="form-control form-control-sm mb-2"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && (
            <p className="xl-small mb-2" role="alert" style={{ color: 'var(--xl-error)' }}>
              {error}
            </p>
          )}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? 'Mengirim…' : 'Kirim laporan'}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
