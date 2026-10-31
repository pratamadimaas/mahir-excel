import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Sheet, formatValue, isError } from '@excellab/spreadsheet-engine';
import { paths } from '@excellab/shared';
import { ArrowRight, Check, ChevronDown, Minus, X } from 'lucide-react';
import { MiniSheet } from '../../components/spreadsheet/MiniSheet';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import type { DatasetSummary } from '../../services/types';
import { useAuthConfig } from '../auth/EmailAuth';
import { Leaderboard } from '../sprint/Leaderboard';
import { ERROR_CASES, FEEDBACK_STEPS, MODULE_OUTCOMES, TRY_EXPECTED, TRY_TABLE, faqs, type ErrorCase, type Row } from './landingData';

interface Overview {
  counts: { modules: number; lessons: number; exercises: number; shortcuts: number; worksheets: number; functions: number; datasets?: number };
  modules: { slug: string; title: string; summary: string; lessons: number; exercises: number }[];
}

interface SampleLesson {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  moduleTitle: string;
}

const nf = new Intl.NumberFormat('id-ID');
/** Dipakai selama jumlah data latihan dari server belum dimuat. */
const DATASET_TOTAL = 50;


function ErrorLab() {
  const [active, setActive] = useState(0);
  const [fixed, setFixed] = useState(false);
  const c: ErrorCase = ERROR_CASES[active]!;

  const select = (i: number): void => {
    setActive(i);
    setFixed(false);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = (active + step + ERROR_CASES.length) % ERROR_CASES.length;
    select(next);
    document.getElementById(`kasus-${ERROR_CASES[next]!.id}`)?.focus();
  };

  return (
    <div className="xl-l-demo-body" aria-labelledby="l-salah">
      <h3 id="l-salah" className="h4">
        <mark className="xl-l-mark">Periksa kembali hasil rumusmu.</mark> Biasanya salah satu dari empat penyebab ini.
      </h3>
      <p className="xl-l-lead">
        Pilih satu kasus, cari sel yang bermasalah, lalu tekan Perbaiki. Hasilnya dihitung ulang oleh mesin rumus.
      </p>
      <div className="xl-l-lab">
        <div role="tablist" aria-label="Kasus kesalahan" aria-orientation="vertical" className="xl-l-tabs" onKeyDown={onKey}>
          {ERROR_CASES.map((k, i) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              id={`kasus-${k.id}`}
              aria-selected={i === active}
              aria-controls="kasus-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
            >
              {k.tab}
            </button>
          ))}
        </div>
        <div id="kasus-panel" role="tabpanel" aria-labelledby={`kasus-${c.id}`} className="xl-l-labpanel">
          <h3 className="h6">{c.title}</h3>
          <MiniSheet
            key={`${c.id}-${fixed ? 'ok' : 'salah'}`}
            table={fixed ? c.fixed : c.broken}
            label={`${c.title}, ${fixed ? 'sesudah diperbaiki' : 'sebelum diperbaiki'}`}
            initial={c.selected}
          />
          <p className="xl-l-explain" aria-live="polite">
            {fixed ? (
              <>
                <strong>Sesudah:</strong> {c.fix}
              </>
            ) : (
              <>
                <strong>Penyebab:</strong> {c.cause}
              </>
            )}
          </p>
          <button
            type="button"
            className={`btn btn-sm ${fixed ? 'btn-outline-secondary' : 'btn-primary'}`}
            onClick={() => setFixed((f) => !f)}
          >
            {fixed ? 'Kembalikan ke semula' : 'Perbaiki'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Coba satu rumus (tanpa akun, dihitung di browser) ---------- */
function TryIt({ exercises }: { exercises: number | null }) {
  const [formula, setFormula] = useState('');
  const [checked, setChecked] = useState<string | null>(null);

  const result = useMemo(() => {
    const trimmed = formula.trim();
    if (!trimmed) return null;
    const sheet = new Sheet({
      A1: 'Kas kecil',
      B1: 'Biaya',
      A2: 'Parkir',
      B2: '25000',
      A3: 'Fotokopi',
      B3: '45000',
      A4: 'Konsumsi',
      B4: '150000',
      A5: 'ATK',
      B5: '80000',
      A6: 'Total',
      B6: trimmed,
    });
    const v = sheet.getValue('B6');
    if (isError(v)) return { text: v.code, detail: v.message, value: null as number | null };
    if (typeof v === 'number') return { text: formatValue(v), detail: '', value: v };
    return { text: String(v ?? ''), detail: '', value: null };
  }, [formula]);

  const check = (e: FormEvent): void => {
    e.preventDefault();
    if (!result) {
      setChecked('Isi sel B6 dulu dengan sebuah rumus.');
      return;
    }
    if (result.value === null) {
      setChecked(`Hasilnya ${result.text}${result.detail ? `: ${result.detail}` : ''}`);
    } else if (result.value === TRY_EXPECTED && /^=\s*SUM\s*\(/i.test(formula.trim())) {
      setChecked('ok');
    } else if (result.value === TRY_EXPECTED) {
      setChecked('Angkanya sudah pas, tetapi latihan ini melatih fungsi SUM. Coba tulis ulang dengan SUM.');
    } else {
      setChecked(`Sel B6 menghasilkan ${result.text}, tetapi itu belum sesuai. Periksa rentang sel dan apakah ada yang terlewat.`);
    }
  };

  return (
    <div className="xl-l-try" aria-labelledby="l-coba">
      <div className="xl-l-try-copy">
        <h3 id="l-coba" className="h4">
          Jumlahkan semua biaya di sel B6.
        </h3>
        <p className="xl-l-lead">Tidak perlu akun untuk mencoba ini.</p>
        <form onSubmit={check} noValidate aria-label="Coba rumus">
          <label htmlFor="coba-rumus" className="form-label">
            Rumus untuk sel B6
          </label>
          <div className="d-flex gap-2">
            <input
              id="coba-rumus"
              className="form-control xl-l-mono"
              value={formula}
              onChange={(e) => {
                setFormula(e.target.value);
                setChecked(null);
              }}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="coba-bantuan"
            />
            <button type="submit" className="btn btn-primary">
              Periksa
            </button>
          </div>
          <p id="coba-bantuan" className="xl-small xl-muted mt-2 mb-2">
            Awali rumus dengan tanda sama dengan (=). Untuk mencoba, ketik SUM dan pilih rentang B2 sampai B5.
          </p>
        </form>
        <div aria-live="polite" data-testid="coba-hasil">
          {checked === 'ok' && (
            <p className="xl-l-result ok">
              <Check className="xl-icon" aria-hidden="true" /> Benar. Totalnya {nf.format(TRY_EXPECTED)}.{' '}
              {exercises ? (
                <>
                  Masih ada {exercises - 1} latihan lain. <Link to="/daftar">Daftar gratis</Link> untuk melanjutkan.
                </>
              ) : (
                <Link to="/daftar">Daftar gratis</Link>
              )}
            </p>
          )}
          {checked && checked !== 'ok' && (
            <p className="xl-l-result bad">
              <X className="xl-icon" aria-hidden="true" /> {checked}
            </p>
          )}
        </div>
      </div>
      <div className="xl-l-try-sheet">
        <MiniSheet key="coba" table={TRY_TABLE(formula.trim()) as Row[]} label="Latihan mencoba rumus" initial="B6" />
        <p className="xl-small xl-muted mt-2 mb-0">Dihitung di browser dengan mesin rumus yang sama seperti di latihan.</p>
      </div>
    </div>
  );
}

/* ---------- Demo bertab: tiga contoh jadi satu bagian ---------- */
const DEMO_TABS = [
  { id: 'rumus', label: 'Tulis rumus', hint: 'Ketik rumus SUM dan lihat hasilnya' },
  { id: 'aneh', label: 'Temukan sel yang salah', hint: 'Empat penyebab yang paling sering' },
  { id: 'umpan', label: 'Lihat umpan balik', hint: 'Lihat bagian yang perlu diperbaiki beserta petunjuknya.' },
] as const;
type DemoTab = (typeof DEMO_TABS)[number]['id'];

function Demo({ exercises, functions }: { exercises: number | null; functions: number | null }) {
  const [tab, setTab] = useState<DemoTab>('rumus');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = DEMO_TABS.findIndex((t) => t.id === tab);
    const next = DEMO_TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + DEMO_TABS.length) % DEMO_TABS.length]!;
    setTab(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <section className="xl-l-section" aria-labelledby="l-demo">
      <h2 id="l-demo">Coba dulu tanpa daftar.</h2>
      <p className="xl-l-lead">Tiga contoh yang bisa dicoba langsung di browser, tanpa akun.</p>
      <p className="xl-small xl-muted">
        {functions
          ? `Mesin rumusnya buatan sendiri dan mendukung ${functions} fungsi, jadi tidak identik dengan Excel.`
          : 'Mesin rumusnya buatan sendiri dan belum mendukung semua fungsi Excel.'}
      </p>
      <div role="tablist" aria-label="Pilih contoh" className="xl-l-demo-tabs" onKeyDown={onKey}>
        {DEMO_TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`demo-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="demo-panel"
            aria-label={t.label}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            <span className="xl-l-dtab-no" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </span>
          </button>
        ))}
      </div>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-${tab}`}>
        {tab === 'rumus' && <TryIt exercises={exercises} />}
        {tab === 'aneh' && <ErrorLab />}
        {tab === 'umpan' && <FeedbackDemo />}
      </div>
    </section>
  );
}

/* ---------- Cara kerja latihan ---------- */
const HOW_STEPS: { title: string; text: ReactNode }[] = [
  { title: 'Unduh berkas latihan', text: <>Klik tombol unduh di halaman latihan. Berkas <code>.xlsx</code> itu berisi data yang perlu kamu kerjakan.</> },
  { title: 'Kerjakan di Excel', text: 'Masukkan rumus pada sel berwarna hijau, lalu simpan berkasnya.' },
  { title: 'Unggah berkas hasilnya', text: 'Sistem membaca rumusmu. Jika belum tepat, kamu mendapat petunjuk sel mana yang perlu diperbaiki.' },
];

function HowItWorks() {
  return (
    <section className="xl-l-section" aria-labelledby="l-cara">
      <h2 id="l-cara">Cara kerja latihannya</h2>
      <p className="xl-l-lead">Setiap latihan bisa dikerjakan di browser atau di Excel. Penilaiannya sama.</p>
      <ol className="xl-l-how" aria-label="Tiga langkah mengerjakan latihan">
        {HOW_STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="xl-l-how-no" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="xl-l-notes">
        <div>
          <strong>Sistem memeriksa rumus yang kamu gunakan beserta hasilnya.</strong>
          <span>Jika latihan meminta SUM lalu kamu mengetik 1020000 langsung, jawabannya ditolak meskipun angkanya sama.</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- Bidang dan isi kursus ---------- */
function Curriculum({ overview }: { overview: Overview | null }) {
  const modules = overview?.modules ?? [];
  return (
    <section id="belajar" className="xl-l-section" aria-labelledby="l-modul">
      <h2 id="l-modul">Pilih bidang sesuai kebutuhan belajarmu</h2>
      <p className="xl-l-lead">
        {overview ? `${overview.counts.lessons} pelajaran dan ${overview.counts.exercises} latihan, disusun berurutan.` : 'Pelajaran dan latihan disusun berurutan.'}{' '}
        Belum tahu mulai dari mana? <Link to="/tes-penempatan">Ikuti Uji Kemampuan Excel</Link> terlebih dahulu.
      </p>
      <ul className="xl-l-beds">
        {paths.map((p) => (
          <li key={p.slug}>
            <Link to={`/jalur/${p.slug}`} className="xl-l-bed">
              <strong>{p.title}</strong>
              <span className="xl-l-bed-tag">{p.tagline}</span>
              <span className="xl-l-bed-go">
                Lihat bidang <ArrowRight className="xl-icon" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <details className="xl-l-fold">
        <summary>
          <span>
            <strong>{modules.length ? `${modules.length} modul` : 'Semua modul'}</strong>, dari Mengenal Excel sampai Persiapan Tes Kerja Admin
          </span>
          <span className="xl-l-fold-act">
            Lihat semua modul <ChevronDown className="xl-icon" aria-hidden="true" />
          </span>
        </summary>
        <p className="xl-l-fold-note">Ada delapan modul inti yang diakhiri dengan proyek kecil. Satu modul tambahan berisi persiapan tes kerja admin.</p>
        <ol className="xl-path" aria-label="Daftar modul">
          {modules.map((m, i) => (
            <li key={m.slug}>
              <span className="xl-path-no" aria-hidden="true">
                {i + 1}
              </span>
              <div className="xl-path-body">
                <strong>{m.title}</strong>
                <span className="xl-muted xl-small">{m.summary}</span>
                {MODULE_OUTCOMES[m.slug] && <span className="xl-small xl-l-outcome">{MODULE_OUTCOMES[m.slug]}</span>}
                <span className="xl-small xl-l-count">
                  {m.lessons} pelajaran, {m.exercises} latihan
                </span>
              </div>
            </li>
          ))}
          {!overview && <li className="xl-muted">Memuat daftar modul…</li>}
        </ol>
      </details>
    </section>
  );
}

/* ---------- 4. Umpan balik ---------- */
function FeedbackDemo() {
  return (
    <div className="xl-l-demo-body" aria-labelledby="l-umpan">
      <h3 id="l-umpan" className="h4">
        <mark className="xl-l-mark">Jawabanmu belum tepat.</mark> Sistem menunjukkan bagian yang perlu diperbaiki.
      </h3>
      <p className="xl-l-lead">
        Sistem memeriksa rumus yang kamu tulis. Berikut tiga percobaan di latihan Total pengeluaran bulanan.
      </p>
      <ol className="xl-l-steps">
        {FEEDBACK_STEPS.map((s) => (
          <li key={s.formula}>
            <code className="xl-l-formula">{s.formula}</code>
            <div className={`xl-l-feedback ${s.ok ? 'ok' : 'bad'}`}>
              <p className="mb-1">
                <strong>{s.ok ? 'Benar!' : 'Belum tepat.'}</strong> {s.message}
              </p>
              {s.note && <p className="xl-small mb-0">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="xl-muted mb-0">
        Petunjuk dibuka satu per satu. Solusi lengkap tersedia setelah jawabanmu benar atau kamu memilih menyerah, tanpa poin.
      </p>
    </div>
  );
}

/* ---------- Sprint: adu cepat, terbuka tanpa akun ---------- */
export function SprintTeaser() {
  return (
    <section className="xl-l-section xl-l-sprint" aria-labelledby="l-sprint">
      <div className="xl-l-sprint-copy">
        <h2 id="l-sprint">
          Tantangan Excel <mark className="xl-l-mark">60 detik</mark>.
        </h2>
        <p className="xl-l-lead">
          Jawab sebanyak mungkin soal Excel dalam 60 detik. Soal muncul secara acak dan mencakup hasil rumus, nama galat, serta shortcut. Kamu tidak
          perlu membuat akun. Cukup isi nama setelah selesai.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/sprint" className="btn btn-primary btn-lg">
            Main sekarang
          </Link>
        </div>
      </div>
      <div className="xl-l-sprint-board">
        <Leaderboard limit={5} as="h3" />
      </div>
    </section>
  );
}

/* ---------- 7. Pelajaran contoh ---------- */
function SampleLessons() {
  const list = useAsync((s) => api.get<SampleLesson[]>('/public/lessons', s), []);
  if (list.loading || list.error || !list.data || list.data.length === 0) return null;
  return (
    <section className="xl-l-section" aria-labelledby="l-contoh">
      <h2 id="l-contoh">Baca satu pelajaran dulu</h2>
      <p className="xl-l-lead">Contoh pelajaran yang bisa dibaca tanpa daftar. Untuk mengerjakan latihan dan menyimpan progres, masuk dulu.</p>
      <ul className="xl-lesson-list">
        {list.data.slice(0, 3).map((l) => (
          <li key={l.slug}>
            <Link to={`/belajar/${l.slug}`}>
              <span className="xl-lesson-title">{l.title}</span>
              <span className="xl-muted xl-small">{l.summary}</span>
            </Link>
            <span className="xl-muted xl-small text-nowrap">
              {l.moduleTitle}, {l.minutes} menit
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Data latihan ---------- */
const DL_SHOWCASE = [
  'transaksi-toko-kelontong',
  'absensi-karyawan-bulanan',
  'data-karyawan',
  'kas-harian-warung',
  'piutang-pelanggan',
  'stok-gudang',
];
const DL_ROWS: { cells: string[]; flag?: Record<number, 'bad' | 'dup'> }[] = [
  { cells: ['01/10/2026', 'TK-0401', 'Indomie Goreng', '12', '3.100'] },
  { cells: ['01/10/2026', 'TK-0402', 'Minyak Goreng 1 L', '2', '18.500'] },
  { cells: ['02/10/2026', 'TK-0404', ' indomie goreng', '5', '3.100'], flag: { 2: 'bad' } },
  { cells: ['02/10/2026', 'TK-0405', 'Telur Ayam 1 kg', '1', '28500'], flag: { 4: 'bad' } },
  { cells: ['2026-10-02', 'TK-0406', 'Beras 5 kg', '1', '69.000'], flag: { 0: 'bad' } },
  { cells: ['03/10/2026', 'TK-0407', 'Kopi Sachet', '20', '1.500'], flag: { 1: 'dup' } },
  { cells: ['03/10/2026', 'TK-0407', 'Kopi Sachet', '20', '1.500'], flag: { 1: 'dup' } },
];
const FIELD_NAME: Record<DatasetSummary['field'], string> = { admin: 'Admin', hrd: 'HRD', jualan: 'Jualan', keuangan: 'Keuangan' };

function DataLatihan({ total }: { total: number }) {
  const list = useAsync((s) => api.get<DatasetSummary[]>('/datasets', s), []);
  const tiles = DL_SHOWCASE.map((slug) => list.data?.find((d) => d.slug === slug)).filter((d): d is DatasetSummary => Boolean(d));
  return (
    <section id="data-latihan" className="xl-l-section xl-l-dl" aria-labelledby="l-data">
      <div className="xl-l-dl-top">
        <div>
          <p className="xl-l-eyebrow">
            Data latihan <span className="xl-l-new">Baru</span>
          </p>
          <h2 id="l-data">
            {total} file data latihan <mark className="xl-l-mark">dengan contoh kasus seperti di kantor.</mark>
          </h2>
          <p className="xl-l-lead">
            Setiap file berisi data dengan masalah yang sering ditemukan di pekerjaan kantor, seperti spasi berlebih, tanggal yang tersimpan sebagai teks, dan nomor ganda. Daftar gratis, unduh filenya, kerjakan di Excel, lalu periksa hasilnya.
          </p>
          <p className="xl-l-dl-note">100 baris atau lebih per file. Format .xlsx dan .csv. Semua data fiktif.</p>
          <Link to="/data-latihan" className="btn btn-primary">
            Lihat semua file
          </Link>
        </div>
        <figure className="xl-l-dl-win" aria-label="Contoh isi data latihan Transaksi Toko Kelontong">
          <div className="xl-l-dl-bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>transaksi-toko-kelontong.xlsx</span>
          </div>
          <div className="xl-l-dl-scroll">
            <table className="xl-l-dl-x">
              <thead>
                <tr>
                  {['Tanggal', 'No Nota', 'Produk', 'Jumlah', 'Harga (Rp)'].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DL_ROWS.map((r, i) => (
                  <tr key={i}>
                    {r.cells.map((c, j) => (
                      <td key={j} className={r.flag?.[j] ? `xl-l-dl-${r.flag[j]}` : j >= 3 ? 'r' : undefined}>
                        {c.startsWith(' ') ? `\u00a0${c.trim()}` : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="xl-l-dl-key">
            <span>Kuning: tidak seragam, atau berupa teks bukan angka dan tanggal asli</span>
            <span>Merah: nota yang tercatat dua kali</span>
          </figcaption>
        </figure>
      </div>

      {tiles.length > 0 && (
        <ul className="xl-l-dl-tiles" aria-label="Contoh data latihan">
          {tiles.map((d) => (
            <li key={d.slug}>
              <span className={`xl-tag xl-field-${d.field}`}>{FIELD_NAME[d.field]}</span>
              <strong>{d.title}</strong>
              <span className="xl-muted xl-small">{d.rows} baris</span>
            </li>
          ))}
        </ul>
      )}

      <p className="xl-l-dl-premium">
        Anggota Premium bisa mengunggah file hasil kerja untuk diperiksa. Sistem memeriksa tiap tugas dan menunjukkan bagian yang perlu diperbaiki.
        Berlaku juga untuk semua worksheet.
      </p>
    </section>
  );
}

/* ---------- 8. Gratis dan Premium ---------- */
function Plans({ counts }: { counts: Overview['counts'] | null }) {
  const cfg = useAuthConfig();
  const price = cfg?.premium.priceLabel;
  const yes = <Check className="xl-icon" aria-label="Ya" role="img" />;
  const no = <Minus className="xl-icon xl-l-cmp-no" aria-label="Tidak tersedia" role="img" />;
  const rows: [string, ReactNode, ReactNode][] = [
    [`Semua pelajaran${counts ? ` (${counts.lessons})` : ''} dan latihan${counts ? ` (${counts.exercises})` : ''}`, yes, yes],
    ['Pemeriksa otomatis dan petunjuk bertahap di latihan, termasuk unggah file hasil kerja', yes, yes],
    ['Uji Kemampuan Excel, ulang terjadwal, Sprint 60 detik, dan pustaka shortcut', yes, yes],
    ['Progres, poin, dan streak tersimpan di akun', yes, yes],
    ['Tombol “Lihat solusi”', '1 solusi setiap 7 hari', 'Tanpa batas'],
    [counts ? `Unduh ${counts.worksheets} worksheet dan ${counts.datasets ?? DATASET_TOTAL} file data latihan` : 'Unduh worksheet dan data latihan (.xlsx, .csv)', yes, yes],
    ['Periksa file worksheet dan data latihan yang kamu unggah, dinilai per tugas', no, yes],
    ['Kunci jawaban worksheet', no, yes],
    ['Template', '2', '2, ditambah 4 lanjutan'],
    ['Penelusur rumus, wizard rumus, laporan kemajuan, dan contekan PDF', no, yes],
    ['Sertifikat PDF yang bisa dicek lewat kode', no, yes],
  ];
  return (
    <section id="harga" className="xl-l-section" aria-labelledby="l-paket">
      <h2 id="l-paket">Semua materi gratis. Premium menambah pemeriksaan worksheet dan Data Latihan.</h2>
      <p className="xl-l-lead">
        Semua pelajaran, latihan, worksheet, dan data latihan bisa diakses gratis. Dengan Premium, kamu mendapat pemeriksaan file worksheet dan Data Latihan, solusi tanpa batas, dan fitur tambahan.
      </p>
      <div className="xl-l-cmp-wrap">
        <table className="xl-l-cmp">
          <caption className="visually-hidden">Perbandingan paket Gratis dan Premium</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Fitur</span>
              </th>
              <th scope="col">
                <span className="xl-l-cmp-name">Gratis</span>
                <span className="xl-l-cmp-sub">Rp0</span>
              </th>
              <th scope="col" className="xl-l-cmp-pro">
                <span className="xl-l-cmp-name">Premium</span>
                {price && <span className="xl-l-price">{price}</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, free, pro]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{free}</td>
                <td className="xl-l-cmp-pro">{pro}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td>
                <Link to="/daftar" className="btn btn-outline-primary">
                  Daftar gratis
                </Link>
              </td>
              <td className="xl-l-cmp-pro">
                <Link to="/premium" className="btn btn-light">
                  Lihat Premium
                </Link>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ---------- 9. FAQ ---------- */
function Faqs({ functions }: { functions: number | null }) {
  return (
    <section id="faq" className="xl-l-section xl-l-split2" aria-labelledby="l-faq">
      <div className="xl-l-side">
        <h2 id="l-faq">Pertanyaan yang sering muncul</h2>
      </div>
      <div className="xl-l-faq">
        {faqs(functions).map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ---------- Penutup ---------- */
function Closing() {
  return (
    <section className="xl-l-closing" aria-labelledby="l-tutup">
      <div className="xl-page">
        <h2 id="l-tutup">Mulai belajar Excel gratis</h2>
        <p>Daftar dengan email atau Google, atau cek level dulu tanpa akun.</p>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/daftar" className="btn btn-light btn-lg">
            Daftar gratis
          </Link>
          <Link to="/tes-penempatan" className="xl-hero-link">
            Ikuti uji kemampuan Excel
          </Link>
        </div>
      </div>
    </section>
  );
}

const CONTACT = (import.meta.env.VITE_CONTACT_URL as string | undefined)?.trim();

/** Pita latar penuh lebar; isinya tetap dalam kolom halaman. Warna hanya lewat kelas, tanpa logika. */
function Band({ tone, children }: { tone: 'white' | 'sage' | 'deep' | 'butter'; children: ReactNode }) {
  return (
    <div className={`xl-l-band xl-l-band-${tone}`}>
      <div className="xl-page xl-l">{children}</div>
    </div>
  );
}

/** Siapa di balik Mahir Excel. Hanya fakta yang bisa dipertanggungjawabkan; kontak muncul bila VITE_CONTACT_URL diisi. */
function Maker() {
  return (
    <section className="xl-l-maker" aria-labelledby="l-pembuat">
      <div className="xl-l-mk">
        <div className="xl-l-mk-main">
          <p className="xl-l-eyebrow">Tentang proyek ini</p>
          <h2 id="l-pembuat">Pengembang Mahir Excel</h2>
          <p className="xl-l-statement">
            Belajar Excel dalam Bahasa Indonesia. <mark className="xl-l-mark-dark">Pelajaran dan latihannya tersedia gratis.</mark>
          </p>
          <div className="xl-l-who">
            <span aria-hidden="true">C</span>
            <div>
              <strong>Codewithdims</strong>
              <small>Pengembang independen</small>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-3">
            {CONTACT && (
              <a className="btn btn-lime" href={CONTACT} target="_blank" rel="noopener noreferrer">
                Hubungi Codewithdims
              </a>
            )}
            <Link to="/tentang" className="xl-l-mk-link">
              Baca selengkapnya
            </Link>
          </div>
        </div>
        <dl className="xl-l-facts">
          <div>
            <dt>Kenapa ada</dt>
            <dd>
              Mahir Excel dibuat agar pengguna di Indonesia bisa belajar Excel melalui latihan langsung. Pendapatan dari Premium digunakan
              untuk mendukung pengembangan dan pemeliharaan situs.
            </dd>
          </div>
          <div>
            <dt>Siapa di baliknya</dt>
            <dd>Satu orang yang membangun dan merawatnya sendiri.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** Beranda untuk pengunjung yang belum masuk: demo dulu, penjelasan dan harga sesudahnya. */
export function Landing() {
  const overview = useAsync((s) => api.get<Overview>('/public/overview', s), []);
  const data = overview.data ?? null;
  return (
    <>
      <Band tone="sage">
        <Demo exercises={data?.counts.exercises ?? null} functions={data?.counts.functions ?? null} />
      </Band>
      <Band tone="white">
        <HowItWorks />
      </Band>
      <Band tone="deep">
        <Curriculum overview={data} />
      </Band>
      <Band tone="white">
        <SampleLessons />
      </Band>
      <Band tone="butter">
        <DataLatihan total={data?.counts.datasets ?? DATASET_TOTAL} />
      </Band>
      <Band tone="sage">
        <Plans counts={data?.counts ?? null} />
      </Band>
      <Band tone="white">
        <Faqs functions={data?.counts.functions ?? null} />
      </Band>
      <Band tone="sage">
        <Maker />
      </Band>
      <Closing />
    </>
  );
}
