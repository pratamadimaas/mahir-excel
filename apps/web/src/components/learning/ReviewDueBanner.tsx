import { Link } from 'react-router';
import { Repeat } from 'lucide-react';
import { useProgress } from '../../app/ProgressContext';

/** Pengingat latihan yang waktunya diulang (ulang terjadwal). Tidak tampil bila tidak ada. */
export function ReviewDueBanner() {
  const { reviewDue } = useProgress();
  if (reviewDue.length === 0) return null;
  return (
    <div className="xl-continue" role="status">
      <div>
        <div className="xl-eyebrow mb-1">
          <Repeat className="xl-icon me-1" aria-hidden="true" />
          Waktunya mengulang
        </div>
        <strong>{reviewDue.length} latihan siap diulang</strong>
        <div className="xl-muted xl-small">Mengulang pada waktunya membuat materi lebih melekat.</div>
      </div>
      <Link to="/kemajuan#ulang" className="btn btn-outline-primary">
        Lihat daftar
      </Link>
    </div>
  );
}
