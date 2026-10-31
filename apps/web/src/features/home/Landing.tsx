import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Sheet, formatValue, isError } from '@excellab/spreadsheet-engine';
import { paths } from '@excellab/shared';
import { ArrowRight, Check, ChevronDown, Clock3, Database, FileSpreadsheet, ListFilter, Minus, RotateCcw, SquareCheckBig, X } from 'lucide-react';
import { Keycaps } from '../../components/learning/Bits';
import { MiniSheet } from '../../components/spreadsheet/MiniSheet';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import type { DatasetSummary } from '../../services/types';
import { useAuthConfig } from '../auth/EmailAuth';
import { Leaderboard } from '../sprint/Leaderboard';
import { AUDIENCE, ERROR_CASES, FEEDBACK_STEPS, MODULE_OUTCOMES, TRY_EXPECTED, TRY_TABLE, faqs, type ErrorCase, type Row } from './landingData';

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
        <mark className="xl-l-mark">Periksa hasil rumusmu.</mark> Biasanya salah satu dari empat penyebab ini.
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
  { id: 'rumus', label: 'Coba satu rumus', hint: 'Ketik rumus SUM dan lihat hasilnya' },
  { id: 'aneh', label: 'Periksa hasil rumusmu', hint: 'Empat penyebab yang paling sering' },
  { id: 'umpan', label: 'Kalau jawabanmu salah', hint: 'Lihat bagian yang perlu diperbaiki beserta petunjuknya' },
] as const;
type DemoTab = (typeof DEMO_TABS)[number]['id'];

function Demo({ exercises }: { exercises: number | null }) {
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
          <strong>Sistem memeriksa rumus dan hasil perhitungannya.</strong>
          <span>Jika latihan meminta SUM lalu kamu mengetik 1020000 langsung, jawabannya ditolak meskipun angkanya sama.</span>
        </div>
        <div>
          <strong>Petunjuk dibuka satu per satu.</strong>
          <span>Solusi baru terbuka setelah kamu menjawab benar atau memilih menyerah.</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- Untuk siapa ---------- */
function Audience() {
  return (
    <section className="xl-l-section xl-l-split2" aria-labelledby="l-siapa">
      <div className="xl-l-side">
        <h2 id="l-siapa">Mahir Excel untuk siapa?</h2>
        <p className="xl-l-lead mb-0">
          Kamu bisa mengikuti <Link to="/tes-penempatan">Uji Kemampuan Excel</Link>: 16 soal tanpa perlu daftar. Hasilnya menunjukkan levelmu: Pemula, Menengah, atau Mahir. Daftar akun jika ingin menyimpan hasilnya.
        </p>
      </div>
      <dl className="xl-l-aud-list">
        {AUDIENCE.map((a) => (
          <div key={a.title}>
            <dt>{a.title}</dt>
            <dd>{a.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Bidang dan isi kursus ---------- */
function Curriculum({ overview }: { overview: Overview | null }) {
  const modules = overview?.modules ?? [];
  return (
    <section id="belajar" className="xl-l-section" aria-labelledby="l-modul">
      <h2 id="l-modul">Pilih bidang sesuai pekerjaanmu</h2>
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
                {MODULE_OUTCOMES[m.slug] && <span className="xl-small xl-l-outcome">Yang kamu pelajari: {MODULE_OUTCOMES[m.slug]}</span>}
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
        <mark className="xl-l-mark">Kalau jawabanmu salah,</mark> sistem menunjukkan letaknya.
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
        Petunjuk muncul bertahap. Solusi baru terbuka setelah kamu menjawab benar atau memilih menyerah, tanpa poin.
      </p>
    </div>
  );
}

/* ---------- 5. Alat bantu ---------- */
function Toolbox({ counts }: { counts: Overview['counts'] | null }) {
  return (
    <section className="xl-l-section" aria-labelledby="l-isi">
      <h2 id="l-isi">
        Selain pelajaran, ada <mark className="xl-l-mark">cara lain untuk berlatih.</mark>
      </h2>
      <p className="xl-l-lead">Bisa dikerjakan kapan saja.</p>
      <div className="xl-l-tools">
        <article>
          <span className="xl-l-ic" aria-hidden="true">
            <ListFilter className="xl-icon" />
          </span>
          <h3>Playground: urutkan, saring, isi otomatis</h3>
          <p>
            Latihan tertentu menyediakan alat urutkan dan filter, serta isi otomatis dengan tarik, tombol, atau Ctrl + D. Rumus yang disalin
            bergeser seperti di Excel.
          </p>
          <div className="xl-l-keys">
            <Keycaps combo="Ctrl + D" />
            <Keycaps combo="Ctrl + R" />
          </div>
        </article>
        <article>
          <span className="xl-l-ic" aria-hidden="true">
            <Database className="xl-icon" />
          </span>
          <h3>{counts?.datasets ?? DATASET_TOTAL} file data latihan</h3>
          <p>Minimal 100 baris per file, dengan kasus seperti pekerjaan kantor. Unduh gratis. Pemeriksaan hasil untuk anggota Premium.</p>
          <div className="xl-l-foot">
            <span className="xl-l-file">transaksi-toko.xlsx</span>
            <span className="xl-l-tag">Gratis</span>
          </div>
        </article>
        <article>
          <span className="xl-l-ic" aria-hidden="true">
            <RotateCcw className="xl-icon" />
          </span>
          <h3>Ulang terjadwal</h3>
          <p>Latihan yang pernah salah muncul kembali, dengan jeda yang makin panjang setiap kali kamu menjawab benar.</p>
          <ol className="xl-l-days" aria-label="Jeda pengulangan dalam hari">
            {[1, 3, 7, 14, 30].map((d) => (
              <li key={d}>
                <strong>{d}</strong>
                <span>hari</span>
              </li>
            ))}
          </ol>
        </article>
        <article>
          <span className="xl-l-ic" aria-hidden="true">
            <FileSpreadsheet className="xl-icon" />
          </span>
          <h3>{counts ? `${counts.worksheets} worksheet` : 'Worksheet'} .xlsx</h3>
          <p>Unduh, lalu kerjakan di Excel. Anggota Premium mendapat kunci jawaban dan bisa mengunggah berkas untuk diperiksa.</p>
          <div className="xl-l-foot">
            <span className="xl-l-file">rekap-penjualan.xlsx</span>
            <span className="xl-l-tag">Semua gratis</span>
          </div>
        </article>
        <article>
          <span className="xl-l-ic" aria-hidden="true">
            <SquareCheckBig className="xl-icon" />
          </span>
          <h3>Uji Kemampuan Excel</h3>
          <p>Satu pertanyaan per layar. Hasilnya berupa levelmu dan saran modul untuk memulai.</p>
          <div className="xl-l-foot">
            <span className="xl-l-tag">Tanpa akun</span>
            <Link to="/tes-penempatan" className="xl-l-go">
              Ikuti ujinya <ArrowRight className="xl-icon" aria-hidden="true" />
            </Link>
          </div>
        </article>
        <article className="xl-l-tool-dark">
          <span className="xl-l-ic" aria-hidden="true">
            <Clock3 className="xl-icon" />
          </span>
          <h3>Sprint 60 detik</h3>
          <p>Jawab sebanyak mungkin soal dalam 60 detik: hasil rumus, nama galat, dan shortcut. Cukup isi nama setelah selesai.</p>
          <div className="xl-l-foot">
            <span className="xl-l-tag">Tanpa akun</span>
            <Link to="/sprint" className="xl-l-go">
              Main sekarang <ArrowRight className="xl-icon" aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------- Sprint: adu cepat, terbuka tanpa akun ---------- */
export function SprintTeaser() {
  return (
    <section className="xl-l-section xl-l-sprint" aria-labelledby="l-sprint">
      <div className="xl-l-sprint-copy">
        <h2 id="l-sprint">
          Jawab soal Excel <mark className="xl-l-mark">dalam 60 detik</mark>.
        </h2>
        <p className="xl-l-lead">
          Jawab sebanyak mungkin soal dalam 60 detik. Soal muncul secara acak dan mencakup hasil rumus, nama galat, serta shortcut. Kamu tidak
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
      <h2 id="l-contoh">Coba baca satu pelajaran</h2>
      <p className="xl-l-lead">Lima pelajaran contoh bisa dibaca tanpa daftar. Untuk mengerjakan latihan dan menyimpan progres, masuk dulu.</p>
      <ul className="xl-lesson-list">
        {list.data.map((l) => (
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
  'pesanan-marketplace',
  'surat-masuk-keluar',
  'hasil-tes-pelamar',
  'pengeluaran-operasional-kantor',
];
const DL_FIELDS: [string, string][] = [
  ['Admin', 'Surat masuk dan keluar, stok gudang, inventaris, buku tamu'],
  ['HRD', 'Absensi, data karyawan, hasil tes pelamar, cuti, gaji'],
  ['Jualan', 'Transaksi toko, pesanan marketplace, kafe, retur'],
  ['Keuangan', 'Kas harian, piutang, hutang, mutasi rekening'],
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
            {total} file data latihan <mark className="xl-l-mark">dari pekerjaan admin, HRD, jualan, dan keuangan.</mark>
          </h2>
          <p className="xl-l-lead">
            Setiap file berisi data dengan masalah yang sering ditemukan di pekerjaan kantor, seperti spasi berlebih, tanggal yang tersimpan sebagai teks, dan nomor ganda. Unduh gratis, kerjakan di Excel, lalu periksa hasilnya.
          </p>
          <dl className="xl-l-dl-fields">
            {DL_FIELDS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
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

      <div className="xl-l-dl-check">
        <div>
          <span className="xl-l-new">Premium</span>
          <h3>Setelah selesai, anggota Premium bisa mengunggah file untuk diperiksa.</h3>
          <p>Sistem memeriksa setiap tugas. Jika ada jawaban yang belum sesuai, kamu mendapat petunjuk tentang bagian yang perlu diperbaiki. Fitur ini juga tersedia untuk semua worksheet.</p>
        </div>
        <ul className="xl-l-dl-verdicts" aria-label="Contoh hasil pemeriksaan">
          <li className="ok">
            <Check className="xl-icon" aria-hidden="true" />
            <div>
              <strong>Omzet per hari</strong>
              <span>Sesuai</span>
            </div>
          </li>
          <li className="bad">
            <X className="xl-icon" aria-hidden="true" />
            <div>
              <strong>Jumlah nota unik</strong>
              <span>Jawabanmu 243, seharusnya 240. Ada nota yang tercatat dua kali.</span>
            </div>
          </li>
          <li className="idle">
            <Minus className="xl-icon" aria-hidden="true" />
            <div>
              <strong>Produk terlaris</strong>
              <span>Belum diisi</span>
            </div>
          </li>
        </ul>
      </div>
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
    ['Pemeriksa otomatis dan petunjuk bertahap', yes, yes],
    ['Uji Kemampuan Excel, ulang terjadwal, Sprint 60 detik, dan pustaka shortcut', yes, yes],
    ['Progres, poin, dan streak tersimpan di akun', yes, yes],
    ['Tombol “Lihat solusi”', '1 solusi setiap 7 hari', 'Tanpa batas'],
    [counts ? `${counts.worksheets} worksheet .xlsx dan ${counts.datasets ?? DATASET_TOTAL} file data latihan` : 'Worksheet dan data latihan (.xlsx, .csv)', yes, yes],
    ['Periksa worksheet dan data latihan yang kamu unggah, dinilai per tugas', no, yes],
    ['Kunci jawaban worksheet', no, yes],
    ['Template', '2', '2, ditambah 4 lanjutan'],
    ['Penelusur rumus, wizard rumus, laporan kemajuan, dan contekan PDF', no, yes],
    ['Sertifikat PDF yang bisa dicek lewat kode', no, yes],
  ];
  return (
    <section id="harga" className="xl-l-section" aria-labelledby="l-paket">
      <h2 id="l-paket">Belajar gratis. Premium menambah pemeriksaan berkas dan solusi.</h2>
      <p className="xl-l-lead">
        Semua pelajaran, latihan, worksheet, dan data latihan gratis. Premium menambah pemeriksaan berkas, solusi tanpa batas, dan fitur tambahan.
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
        <h2 id="l-tutup">Mulai dengan latihan pertama.</h2>
        <p>Daftar gratis untuk mulai belajar, atau ikuti Uji Kemampuan Excel tanpa akun.</p>
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
          <h2 id="l-pembuat">Tentang pengembang Mahir Excel</h2>
          <p className="xl-l-statement">
            Belajar Excel dalam Bahasa Indonesia. <mark className="xl-l-mark-dark">Pelajaran dan latihannya gratis.</mark>
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
              Supaya orang Indonesia bisa belajar Excel lewat latihan langsung. Pelajaran dan latihannya gratis. Pendapatan dari Premium dipakai
              untuk merawat situs ini.
            </dd>
          </div>
          <div>
            <dt>Cara materi dijaga</dt>
            <dd>
              Setiap pelajaran disusun sendiri. Contoh rumus dijalankan oleh mesin rumus yang dibuat untuk Mahir Excel, dan jawaban latihan
              diuji dengan data lain supaya jawaban asal tidak lolos.
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

/** Beranda untuk pengunjung yang belum masuk: bukti dulu, ajakan daftar sesudahnya. */
export function Landing() {
  const overview = useAsync((s) => api.get<Overview>('/public/overview', s), []);
  const data = overview.data ?? null;
  return (
    <>
      <Band tone="white">
        <HowItWorks />
      </Band>
      <Band tone="sage">
        <Audience />
      </Band>
      <Band tone="deep">
        <Curriculum overview={data} />
      </Band>
      <Band tone="white">
        <SampleLessons />
      </Band>
      <Band tone="sage">
        <Demo exercises={data?.counts.exercises ?? null} />
      </Band>
      <Band tone="white">
        <Toolbox counts={data?.counts ?? null} />
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
