import { useEffect, useState } from 'react';
import { FileSpreadsheet, MousePointerClick, X } from 'lucide-react';

const KEY = 'xl-howto-hidden';

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

interface Way {
  id: 'langsung' | 'excel';
  title: string;
  image: string;
  alt: string;
  steps: string[];
  note: string;
}

const WAYS: Way[] = [
  {
    id: 'langsung',
    title: 'Isi langsung di sini',
    image: '/panduan/langsung.jpg',
    alt: 'Lembar kerja latihan dengan tiga langkah bernomor: klik sel hijau, ketik rumus atau klik sel lain untuk memasukkan alamatnya, lalu klik Periksa jawaban.',
    steps: [
      'Klik sel hijau muda.',
      'Ketik rumus yang diawali =. Klik sel lain untuk memasukkan alamatnya.',
      'Tekan Enter, lalu klik Periksa jawaban.',
    ],
    note: 'Cocok untuk HP, atau kalau kamu tidak punya Excel.',
  },
  {
    id: 'excel',
    title: 'Kerjakan di Excel',
    image: '/panduan/excel.jpg',
    alt: 'Tiga langkah bernomor: klik Kerjakan di Excel untuk mengunduh file, isi sel hijau di Excel lalu simpan, dan klik Unggah jawaban di halaman ini.',
    steps: [
      'Klik Kerjakan di Excel. File .xlsx terunduh.',
      'Buka di Excel (klik Enable Editing bila diminta), isi sel hijau, lalu simpan.',
      'Kembali ke sini dan klik Unggah jawaban. Jawabanmu langsung diperiksa.',
    ],
    note: 'Paling nyaman di komputer. Sel soal terkunci, dan kalau ada yang terubah kamu diberi tahu.',
  },
];

interface Props {
  /** `katalog`: penjelasan saja. `latihan`: dengan tombol untuk memulai tiap cara. */
  mode: 'katalog' | 'latihan';
  onHere?: () => void;
  onDownload?: () => void;
  busy?: boolean;
}

/** Panduan dua cara mengerjakan latihan, dengan gambar. Bisa disembunyikan; pilihannya diingat di browser. */
export function HowToPanel({ mode, onHere, onDownload, busy }: Props) {
  const [hidden, setHidden] = useState(readHidden);
  const [zoom, setZoom] = useState<Way | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setZoom(null);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [zoom]);

  const set = (v: boolean): void => {
    setHidden(v);
    writeHidden(v);
  };

  if (hidden) {
    return (
      <p className="xl-howto-show">
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => set(false)}>
          Tampilkan cara mengerjakan latihan
        </button>
      </p>
    );
  }

  return (
    <section className={`xl-howto ${mode}`} aria-labelledby="xl-howto-title">
      <header className="xl-howto-head">
        <div>
          <h2 id="xl-howto-title" className="h5 mb-0">
            Cara mengerjakan latihan
          </h2>
          <p className="xl-muted xl-small mb-0">Pilih satu. Penilaian dan poinnya sama.</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => set(true)}
          aria-label="Sembunyikan panduan cara mengerjakan"
        >
          <X className="xl-icon" aria-hidden="true" /> Sembunyikan
        </button>
      </header>

      <div className="xl-howto-grid">
        {WAYS.map((w) => (
          <article key={w.id} className="xl-howto-card">
            <button
              type="button"
              className="xl-howto-img"
              onClick={() => setZoom(w)}
              aria-label={`Perbesar gambar panduan: ${w.id === 'excel' ? 'lewat Excel' : 'langsung'}`}
            >
              <img src={w.image} alt={w.alt} width={1200} height={560} loading="lazy" />
            </button>
            <div className="xl-howto-body">
              <h3 className="h6">{w.title}</h3>
              <ol>
                {w.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="xl-muted xl-small mb-0">{w.note}</p>
              {mode === 'latihan' && (
                <div className="mt-2">
                  {w.id === 'langsung' ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={onHere}>
                      <MousePointerClick className="xl-icon" aria-hidden="true" /> Mulai isi di sini
                    </button>
                  ) : (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDownload} disabled={busy}>
                      <FileSpreadsheet className="xl-icon" aria-hidden="true" /> Unduh file Excel
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {zoom && (
        <div className="xl-howto-zoom" role="dialog" aria-modal="true" aria-label={zoom.title} onClick={() => setZoom(null)}>
          <img src={zoom.image} alt={zoom.alt} />
          <button type="button" className="btn btn-light btn-sm" onClick={() => setZoom(null)}>
            Tutup
          </button>
        </div>
      )}
    </section>
  );
}
