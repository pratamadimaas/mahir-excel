import { Link } from 'react-router';
import { Download, FileSpreadsheet, FileText, Lock } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { CheatsheetView, TemplateView } from '../../services/types';

const CATEGORY_ORDER: TemplateView['category'][] = ['Usaha', 'Keuangan', 'Acara', 'Proyek'];

function TemplateAction({ t }: { t: TemplateView }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <Link className="btn btn-outline-secondary btn-sm" to="/masuk">
        Masuk untuk mengunduh
      </Link>
    );
  }
  if (t.premiumOnly && !user.premium) {
    return (
      <Link className="btn btn-outline-secondary btn-sm" to="/premium">
        <Lock className="xl-icon" aria-hidden="true" /> Premium
      </Link>
    );
  }
  return (
    <a className="btn btn-primary btn-sm" href={`/api/templates/${t.slug}/download`} download>
      <Download className="xl-icon" aria-hidden="true" /> Unduh .xlsx
    </a>
  );
}

function Cheatsheets() {
  const { user } = useAuth();
  const list = useAsync((s) => (user ? api.get<CheatsheetView[]>('/cheatsheets', s) : Promise.resolve([] as CheatsheetView[])), [user?.id]);
  return (
    <section aria-labelledby="tpl-contekan" className="mt-5">
      <h2 id="tpl-contekan">Lembar contekan PDF per modul</h2>
      <p className="xl-muted">
        Satu atau dua halaman per modul: sintaks, contoh rumus beserta hasilnya, dan kesalahan yang sering terjadi. Cocok dicetak atau disimpan di HP. Khusus Premium.
      </p>
      {!user && (
        <p>
          <Link to="/masuk">Masuk</Link> untuk melihat daftar modul.
        </p>
      )}
      {list.loading && user && <Loading label="Memuat modul…" lines={3} />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length > 0 && (
        <ul className="xl-file-list">
          {list.data.map((m) => (
            <li key={m.slug}>
              <FileText className="xl-icon xl-file-icon" aria-hidden="true" />
              <div className="xl-file-main">
                <span className="xl-file-title">{m.title}</span>
                <span className="xl-muted xl-small">{m.lessons} pelajaran dirangkum</span>
              </div>
              {user?.premium ? (
                <a className="btn btn-primary btn-sm" href={`/api/cheatsheets/${m.slug}/download`} download>
                  <Download className="xl-icon" aria-hidden="true" /> Unduh PDF
                </a>
              ) : (
                <Link className="btn btn-outline-secondary btn-sm" to="/premium">
                  <Lock className="xl-icon" aria-hidden="true" /> Premium
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TemplatePage() {
  useDocumentTitle('Template Excel');
  const list = useAsync((s) => api.get<TemplateView[]>('/templates', s), []);
  const groups = CATEGORY_ORDER.map((c) => ({ category: c, items: (list.data ?? []).filter((t) => t.category === c) })).filter((g) => g.items.length > 0);

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Sumber belajar</p>
        <h1>Template Excel siap pakai</h1>
        <p>
          File .xlsx yang bisa langsung kamu isi dengan datamu: rumusnya sudah terpasang dan hasilnya terhitung sendiri. Contoh isinya diberi tanda “contoh”, hapus lalu ganti. Dua template gratis,
          sisanya untuk anggota Premium.
        </p>
      </header>

      {list.loading && <Loading label="Memuat template…" lines={4} />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

      {groups.map((g) => (
        <section key={g.category} aria-labelledby={`tpl-${g.category}`} className="mb-4">
          <h2 id={`tpl-${g.category}`} className="h5">
            {g.category}
          </h2>
          <ul className="xl-tpl-grid">
            {g.items.map((t) => (
              <li key={t.slug} className="xl-tpl-card">
                <div className="d-flex align-items-start gap-2">
                  <FileSpreadsheet className="xl-icon" aria-hidden="true" />
                  <h3>{t.title}</h3>
                </div>
                <div>
                  <span className={`xl-tag${t.free ? '' : ' premium'}`}>{t.free ? 'Gratis' : 'Premium'}</span>
                </div>
                <p className="mb-0">{t.description}</p>
                <p className="xl-small xl-muted mb-0">{t.forWho}</p>
                <p className="xl-small mb-0">
                  <strong>Isi berkas:</strong> {t.sheets.join(', ')}
                </p>
                <p className="xl-small mb-0">
                  <strong>Rumus:</strong> {t.formulas.join(', ')}
                </p>
                {t.note && <p className="xl-small mb-0">{t.note}</p>}
                <div className="xl-tpl-foot">
                  <TemplateAction t={t} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="xl-small xl-muted">
        Semua rumus memakai fungsi yang ada di Excel 2016 ke atas, Google Sheets, dan LibreOffice. Hasil awal di berkas dihitung oleh mesin rumus Mahir Excel dan dicek terhadap hitungan manual; berkas belum diuji satu per satu
        di setiap versi Excel.
      </p>

      <Cheatsheets />
    </div>
  );
}
