import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, X } from 'lucide-react';

const KEY = 'xl-start-hidden';

const readHidden = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const writeHidden = (hidden: boolean): void => {
  try {
    if (hidden) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* penyimpanan diblokir: panduan tetap bisa dibuka dan ditutup untuk halaman ini */
  }
};

/** Urutannya sama dengan menu di bagian atas halaman. */
const CARDS = [
  { to: '/belajar', name: 'Belajar', text: 'Baca pelajaran, lalu kerjakan latihan di bagian bawahnya.' },
  { to: '/jalur', name: 'Bidang', text: 'Pelajaran disusun untuk admin, admin HRD, jualan, atau keuangan.' },
  { to: '/latihan', name: 'Latihan', text: 'Ketik rumus di lembar kerja, atau unduh, isi di Excel, lalu unggah. Dicek langsung.' },
  { to: '/shortcut', name: 'Shortcut', text: 'Daftar pintasan keyboard Excel dan kuisnya.' },
  { to: '/worksheet', name: 'Worksheet', text: 'Berkas .xlsx untuk latihan tambahan. Sebagian gratis.' },
  { to: '/template', name: 'Template', text: 'Template Excel siap pakai untuk kerjaan.' },
  { to: '/sprint', name: 'Sprint', text: 'Soal berwaktu 60 detik.' },
  { to: '/program', name: 'Sertifikat gratis', text: 'Selesaikan Uji Kemampuan Excel, Sprint, dan 5 latihan. Untuk 100 pengguna pertama.' },
] as const;

/** Petunjuk memakai situs untuk pengguna yang sudah masuk. Bisa disembunyikan; pilihannya diingat di browser. */
export function StartGuide() {
  const [hidden, setHidden] = useState(readHidden);
  const set = (v: boolean): void => {
    setHidden(v);
    writeHidden(v);
  };

  if (hidden) {
    return (
      <p className="xl-start-show">
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => set(false)}>
          Tampilkan cara memakai Mahir Excel
        </button>
      </p>
    );
  }

  return (
    <section className="xl-panel xl-panel-body xl-start" aria-labelledby="xl-start-title">
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h2 id="xl-start-title" className="h5 mb-1">
            Cara memakai Mahir Excel
          </h2>
          <p className="xl-muted xl-small mb-0">Pilih yang mau kamu lakukan, lalu klik kartunya. Menu yang sama ada di bagian atas halaman.</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => set(true)}
          aria-label="Sembunyikan petunjuk cara memakai Mahir Excel"
        >
          <X className="xl-icon" aria-hidden="true" /> Sembunyikan
        </button>
      </header>

      <ul className="xl-start-grid">
        {CARDS.map((c, i) => (
          <li key={c.to}>
            <Link to={c.to} className="xl-start-card">
              <span className="xl-start-no" aria-hidden="true">
                {i + 1}
              </span>
              <strong>{c.name}</strong>
              <span className="xl-muted xl-small">{c.text}</span>
              <span className="xl-start-go">
                Buka {c.name} <ArrowRight className="xl-icon" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="xl-start-note mb-0">
        Belum tahu mulai dari mana? <Link to="/tes-penempatan">Ikuti Uji Kemampuan Excel</Link> dulu, sampai 16 soal.
      </p>
    </section>
  );
}
