import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Sheet, formatValue, isError } from '@excellab/spreadsheet-engine';
import { Check, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Keycaps } from '../../components/learning/Bits';
import { MiniSheet } from '../../components/spreadsheet/MiniSheet';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { useAuthConfig } from '../auth/EmailAuth';
import { ProgramBanner } from '../program/ProgramPage';
import { Leaderboard } from '../sprint/Leaderboard';
import { AUDIENCE, ERROR_CASES, FEEDBACK_STEPS, MODULE_OUTCOMES, TRY_EXPECTED, TRY_TABLE, faqs, type ErrorCase, type Row } from './landingData';

interface Overview {
  counts: { modules: number; lessons: number; exercises: number; shortcuts: number; worksheets: number; functions: number };
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

/* ---------- 1. Penyebab hasil aneh: kasus nyata yang bisa diperbaiki ---------- */
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
        <mark className="xl-l-mark">Hasilnya aneh?</mark> Biasanya salah satu dari empat ini.
      </h3>
      <p className="xl-l-lead">
        Pilih satu kasus, cari sel yang bermasalah, lalu tekan Perbaiki. Tabelnya hidup, jadi hasilnya benar-benar dihitung ulang.
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
          Coba satu rumus sekarang.
        </h3>
        <p className="xl-l-lead">Jumlahkan semua biaya di sel B6. Tidak perlu akun untuk mencoba ini.</p>
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
            Rumus diawali tanda sama dengan. Bingung? Coba tulis SUM lalu pilih rentang B2 sampai B5.
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
        <p className="xl-small xl-muted mt-2 mb-0">Dihitung langsung di browsermu oleh mesin rumus yang sama dengan latihan.</p>
      </div>
    </div>
  );
}

/* ---------- Demo bertab: tiga contoh jadi satu bagian ---------- */
const DEMO_TABS = [
  { id: 'rumus', label: 'Coba satu rumus' },
  { id: 'aneh', label: 'Hasilnya aneh?' },
  { id: 'umpan', label: 'Salah itu wajar' },
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
      <h2 id="l-demo">Coba sebelum daftar.</h2>
      <p className="xl-l-lead">Tiga contoh yang jalan di browsermu tanpa akun. Tabelnya hidup, jadi hasilnya benar-benar dihitung ulang.</p>
      <div role="tablist" aria-label="Pilih contoh" className="xl-l-demo-tabs" onKeyDown={onKey}>
        {DEMO_TABS.map((t) => (
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
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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

/* ---------- Untuk siapa ---------- */
function Audience() {
  return (
    <section className="xl-l-section xl-l-split2" aria-labelledby="l-siapa">
      <div className="xl-l-side">
        <h2 id="l-siapa">Untuk siapa Mahir Excel.</h2>
        <p className="xl-l-lead mb-0">
          Belum yakin level kamu? <Link to="/tes-penempatan">Ikuti tes penempatan</Link>: 12 pertanyaan, sekitar 3 menit, tanpa akun.
        </p>
      </div>
      <dl className="xl-l-limits">
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

/* ---------- Sertifikat ---------- */
/** Contoh tampilan sertifikat. QR-nya sungguhan tetapi mengarah ke beranda; nama dan kode di sertifikat asli milik pemiliknya. */
function CertificatePreview() {
  const cells = useMemo(() => {
    const qr = QRCode.create('https://mahirexcel.online', { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const out: ReactNode[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) out.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.05} height={1.05} />);
    return { n, out };
  }, []);
  return (
    <figure className="xl-l-cert">
      <div className="xl-l-cert-page" role="img" aria-label="Contoh sertifikat penyelesaian modul Rumus Dasar">
        <div className="xl-l-cert-brand">Mahir Excel</div>
        <div className="xl-l-cert-title">SERTIFIKAT PENYELESAIAN</div>
        <div className="xl-l-cert-label">Diberikan kepada</div>
        <div className="xl-l-cert-name">Contoh Nama</div>
        <div className="xl-l-cert-text">yang telah menyelesaikan modul 3: Rumus Dasar</div>
        <div className="xl-l-cert-foot">
          <svg viewBox={`0 0 ${cells.n} ${cells.n}`} className="xl-l-cert-qr" aria-hidden="true" shapeRendering="crispEdges">
            <g fill="#185c37">{cells.out}</g>
          </svg>
          <div className="xl-l-cert-verify">
            <strong>Pindai untuk memeriksa keaslian</strong>
            <span>Kode verifikasi unik</span>
          </div>
          <div className="xl-l-cert-issuer">
            <em>Mahir Excel</em>
            <span>Diterbitkan oleh Mahir Excel</span>
          </div>
        </div>
      </div>
      <figcaption className="xl-small xl-muted mt-2">
        Contoh tampilan. Sertifikat asli memuat namamu, tanggal terbit, dan kode unik yang bisa diperiksa siapa pun.
      </figcaption>
    </figure>
  );
}

function Certificates() {
  return (
    <section className="xl-l-section xl-l-split" aria-labelledby="l-sertifikat">
      <div>
        <h2 id="l-sertifikat">Bukti belajar yang bisa diperiksa.</h2>
        <p className="xl-l-lead">
          Selesaikan semua pelajaran sebuah modul, atau seluruh materi, lalu unduh sertifikat PDF. Siapa pun bisa memeriksa keasliannya lewat
          kode di sertifikat.
        </p>
        <ul className="xl-l-checks">
          <li>Sertifikat per modul dan untuk seluruh materi tersedia di paket Premium.</li>
          <li>
            Program Perintis memberi sertifikat gratis untuk pengguna pertama yang menyelesaikan syaratnya. <Link to="/program">Lihat syarat</Link>
          </li>
          <li>Ini bukan sertifikasi Microsoft. Sertifikat menandakan kamu menyelesaikan materi di sini.</li>
        </ul>
      </div>
      <CertificatePreview />
    </section>
  );
}

/* ---------- 3. Kurikulum ---------- */
function Curriculum({ overview }: { overview: Overview | null }) {
  return (
    <section id="belajar" className="xl-l-section xl-l-split" aria-labelledby="l-modul">
      <div className="xl-l-sticky">
        <h2 id="l-modul">
          Dari sel pertama sampai <mark className="xl-l-mark">VLOOKUP</mark>.
        </h2>
        <p className="xl-l-lead">
          {overview
            ? `${overview.counts.lessons} pelajaran dan ${overview.counts.exercises} latihan, disusun berurutan. Tiap modul ditutup dengan proyek kecil.`
            : 'Pelajaran dan latihan disusun berurutan. Tiap modul ditutup dengan proyek kecil.'}
        </p>
        <p className="mb-0">
          Belum tahu mulai dari mana? <Link to="/tes-penempatan">Ikuti tes penempatan</Link>, 12 pertanyaan sekitar 3 menit.
        </p>
      </div>
      <ol className="xl-path" aria-label="Daftar modul">
        {(overview?.modules ?? []).map((m, i) => (
          <li key={m.slug}>
            <span className="xl-path-no" aria-hidden="true">
              {i + 1}
            </span>
            <div className="xl-path-body">
              <strong>{m.title}</strong>
              <span className="xl-muted xl-small">{m.summary}</span>
              {MODULE_OUTCOMES[m.slug] && <span className="xl-small xl-l-outcome">Hasilnya: {MODULE_OUTCOMES[m.slug]}</span>}
              <span className="xl-small xl-l-count">
                {m.lessons} pelajaran, {m.exercises} latihan
              </span>
            </div>
          </li>
        ))}
        {!overview && <li className="xl-muted">Memuat daftar modul…</li>}
      </ol>
    </section>
  );
}

/* ---------- 4. Umpan balik ---------- */
function FeedbackDemo() {
  return (
    <div className="xl-l-demo-body" aria-labelledby="l-umpan">
      <h3 id="l-umpan" className="h4">
        <mark className="xl-l-mark">Salah itu wajar.</mark> Yang penting tahu kenapa.
      </h3>
      <p className="xl-l-lead">
        Yang diperiksa adalah rumus yang kamu tulis, bukan sekadar angkanya. Ini tiga percobaan nyata di latihan Total pengeluaran bulanan.
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
        Petunjuk dibuka satu per satu. Solusi lengkap baru terbuka setelah kamu menjawab benar atau memilih menyerah, tanpa poin.
      </p>
    </div>
  );
}

/* ---------- 5. Bento: isi paket ---------- */
function Toolbox({ counts }: { counts: Overview['counts'] | null }) {
  return (
    <section className="xl-l-section" aria-labelledby="l-isi">
      <h2 id="l-isi">Selain pelajaran, ada alat untuk dipakai sehari-hari.</h2>
      <div className="xl-l-bento">
        <article className="xl-l-cell xl-l-cell-a">
          <h3 className="h5">Playground yang bisa mengurutkan, menyaring, dan mengisi otomatis</h3>
          <p>
            Latihan tertentu memberi alat urutkan dan filter, serta isi otomatis dengan tarik, tombol, atau Ctrl + D. Rumus yang disalin
            bergeser seperti di Excel.
          </p>
          <div className="xl-l-keys">
            <Keycaps combo="Ctrl + D" />
            <Keycaps combo="Ctrl + R" />
          </div>
        </article>
        <article className="xl-l-cell xl-l-cell-b">
          <h3 className="h5">{counts ? `${counts.shortcuts} shortcut` : 'Pustaka shortcut'}</h3>
          <p>Untuk Windows dan Mac, bisa dicari, ditambah mode kuis.</p>
          <div className="xl-l-keys">
            <Keycaps combo="Ctrl + Shift + L" />
            <Keycaps combo="Alt + =" />
            <Keycaps combo="F4" />
          </div>
        </article>
        <article className="xl-l-cell xl-l-cell-c">
          <h3 className="h5">Ulang terjadwal</h3>
          <p>Latihan yang pernah salah muncul lagi, makin jarang tiap kali kamu menjawab benar.</p>
          <ol className="xl-l-days" aria-label="Jeda pengulangan dalam hari">
            {[1, 3, 7, 14, 30].map((d) => (
              <li key={d}>
                <strong>{d}</strong>
                <span>hari</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="xl-l-cell xl-l-cell-d">
          <h3 className="h5">{counts ? `${counts.worksheets} worksheet` : 'Worksheet'} .xlsx</h3>
          <p>Unduh, lalu kerjakan di Excel sungguhan. 3 worksheet pertama gratis; sisanya dan kunci jawaban untuk anggota Premium.</p>
        </article>
        <article className="xl-l-cell xl-l-cell-e">
          <h3 className="h5">Tes penempatan</h3>
          <p>12 pertanyaan, hasilnya saran modul untuk memulai. Terbuka tanpa akun.</p>
          <Link to="/tes-penempatan" className="btn btn-light btn-sm">
            Ikuti tes penempatan
          </Link>
        </article>
        <article className="xl-l-cell xl-l-cell-f">
          <div>
            <h3 className="h5">Sprint 60 detik</h3>
            <p className="mb-0">
              Jawab soal Excel sebanyak mungkin dalam satu menit: hasil rumus, nama galat, dan shortcut. Tanpa akun, cukup isi nama di akhir.
            </p>
          </div>
          <Link to="/sprint" className="btn btn-primary">
            Main sekarang
          </Link>
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
          Adu cepat <mark className="xl-l-mark">60 detik</mark>.
        </h2>
        <p className="xl-l-lead">
          Jawab soal Excel sebanyak mungkin dalam satu menit. Soalnya dibuat acak tanpa habis: hasil rumus, nama galat, dan shortcut. Tidak
          perlu akun, cukup isi nama di akhir.
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

/* ---------- 6. Batasan yang jujur ---------- */
function Limits({ functions }: { functions: number | null }) {
  return (
    <section className="xl-l-section xl-l-split2" aria-labelledby="l-batas">
      <div className="xl-l-side">
        <h2 id="l-batas">Yang sebaiknya kamu tahu dulu.</h2>
        <p className="xl-l-lead mb-0">Lebih baik kamu tahu batasnya sebelum mulai, daripada kecewa di tengah jalan.</p>
      </div>
      <dl className="xl-l-limits">
        <div>
          <dt>Playground adalah simulasi</dt>
          <dd>
            {functions ? `Ada ${functions} fungsi` : 'Fungsinya terbatas'}, cukup untuk dasar sampai VLOOKUP dan XLOOKUP. Ini bukan
            pengganti Excel, dan beberapa perilaku Excel asli sengaja tidak ditiru.
          </dd>
        </div>
        <div>
          <dt>PivotTable dan grafik baru dijelaskan</dt>
          <dd>Pelajarannya membahas konsepnya, tetapi belum bisa dilatih langsung di playground.</dd>
        </div>
        <div>
          <dt>Hanya berbahasa Indonesia</dt>
          <dd>Antarmuka punya versi English, tetapi pelajaran dan latihan ditulis dalam Bahasa Indonesia.</dd>
        </div>
        <div>
          <dt>Sertifikat bukan sertifikasi Microsoft</dt>
          <dd>Sertifikat PDF menandakan kamu menyelesaikan materi di sini. Mahir Excel tidak berafiliasi dengan Microsoft.</dd>
        </div>
      </dl>
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
      <p className="xl-l-lead">Lima pelajaran contoh bisa dibaca tanpa daftar. Latihan dan progresnya ada setelah kamu masuk.</p>
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

/* ---------- 8. Gratis dan Premium ---------- */
function Plans({ counts }: { counts: Overview['counts'] | null }) {
  const cfg = useAuthConfig();
  const price = cfg?.premium.priceLabel;
  return (
    <section id="harga" className="xl-l-section" aria-labelledby="l-paket">
      <h2 id="l-paket">Belajarnya gratis. Premium untuk latihan lebih banyak dan bukti belajar.</h2>
      <div className="xl-l-plans">
        <div className="xl-l-plan">
          <h3 className="h5">Gratis</h3>
          <ul>
            <li>
              Semua pelajaran{counts ? ` (${counts.lessons})` : ''} dan latihan{counts ? ` (${counts.exercises})` : ''}
            </li>
            <li>Tes penempatan dan jadwal ulang</li>
            <li>Pustaka shortcut dan mode kuis</li>
            <li>Petunjuk bertahap dan pembahasan setelah jawabanmu benar</li>
            <li>3 worksheet .xlsx pertama</li>
            <li>Sprint 60 detik dan papan peringkat</li>
            <li>Progres, poin, dan streak tersimpan di akun</li>
          </ul>
          <Link to="/daftar" className="btn btn-primary">
            Daftar gratis
          </Link>
        </div>
        <div className="xl-l-plan xl-l-plan-pro">
          <h3 className="h5">Premium</h3>
          <ul>
            <li>Semua yang gratis</li>
            <li>Tombol “Lihat solusi” langsung di setiap latihan</li>
            <li>7 worksheet lanjutan dan kunci jawaban semua worksheet</li>
            <li>Sertifikat PDF per modul dan untuk seluruh materi, bisa dicek lewat kode</li>
          </ul>
          {price && <p className="xl-l-price">{price}</p>}
          <Link to="/premium" className="btn btn-outline-primary">
            Lihat Premium
          </Link>
        </div>
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
        <h2 id="l-tutup">Mulai dari satu rumus.</h2>
        <p>Buat akun gratis, atau cek dulu level kamu lewat tes penempatan.</p>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/daftar" className="btn btn-light btn-lg">
            Daftar gratis
          </Link>
          <Link to="/tes-penempatan" className="xl-hero-link">
            Ikuti tes penempatan
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

/** Empat angka asli dari server tepat di bawah hero. Tidak tampil bila angkanya belum ada. */
function StatStrip({ counts }: { counts: Overview['counts'] | null }) {
  if (!counts) return null;
  const items: [number, string][] = [
    [counts.lessons, 'pelajaran'],
    [counts.exercises, 'latihan'],
    [counts.functions, 'fungsi rumus'],
    [counts.shortcuts, 'shortcut'],
  ];
  return (
    <dl className="xl-l-stats" aria-label="Isi Mahir Excel saat ini">
      {items.map(([n, label]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{nf.format(n)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Siapa di balik Mahir Excel. Hanya fakta yang bisa dipertanggungjawabkan; kontak muncul bila VITE_CONTACT_URL diisi. */
function Maker() {
  return (
    <section className="xl-l-section xl-l-maker" aria-labelledby="l-pembuat">
      <h2 id="l-pembuat">Dibuat oleh siapa dan kenapa</h2>
      <p className="xl-l-statement">
        Belajar Excel dalam Bahasa Indonesia seharusnya bisa dijangkau siapa saja, tanpa harus membayar dulu.
      </p>
      <dl className="xl-l-facts">
        <div>
          <dt>Kenapa ada</dt>
          <dd>
            Mahir Excel dibuat untuk membantu lebih banyak orang Indonesia menguasai Excel lewat latihan langsung. Belajarnya sengaja dibuat
            gratis. Premium ada supaya proyek ini bisa terus dirawat.
          </dd>
        </div>
        <div>
          <dt>Cara materi dijaga benar</dt>
          <dd>
            Pelajaran ditulis orisinal. Setiap contoh dijalankan oleh mesin rumus sendiri, dan jawaban latihan diuji terhadap data lain
            supaya jawaban asal tidak lolos. Daftar shortcut belum diverifikasi di semua versi dan tata letak keyboard, dan itu dicatat
            terang-terangan.
          </dd>
        </div>
        <div>
          <dt>Siapa di baliknya</dt>
          <dd>
            Seorang pengembang independen yang membangun dan merawatnya sendiri. Mahir Excel tidak berafiliasi dengan Microsoft maupun
            lembaga lain.
          </dd>
        </div>
      </dl>
      <div className="d-flex flex-wrap gap-2">
        <Link to="/tentang" className="btn btn-outline-primary">
          Baca selengkapnya
        </Link>
        {CONTACT && (
          <a className="btn btn-primary" href={CONTACT} target="_blank" rel="noopener noreferrer">
            Hubungi Codewithdims
          </a>
        )}
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
      <Band tone="sage">
        <ProgramBanner />
        <StatStrip counts={data?.counts ?? null} />
      </Band>
      <Band tone="white">
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
        <Certificates />
      </Band>
      <Band tone="sage">
        <Limits functions={data?.counts.functions ?? null} />
      </Band>
      <Band tone="white">
        <Plans counts={data?.counts ?? null} />
        <Faqs functions={data?.counts.functions ?? null} />
      </Band>
      <Band tone="sage">
        <Maker />
      </Band>
      <Closing />
    </>
  );
}
