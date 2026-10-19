import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Loading } from '../feedback/Feedback';
import { useI18n } from '../../i18n/I18n';
import { api } from '../../services/api';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  const { pathname } = useLocation();
  const { t, lang } = useI18n();
  // Isi pelajaran/latihan hanya berbahasa Indonesia; beri tahu pengguna English di area itu.
  const contentArea = /^\/(belajar|latihan|shortcut|worksheet|tantangan|tes-penempatan|kemajuan)/.test(pathname);
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [pathname]);

  // Hitungan kunjungan agregat tanpa cookie (server menghormati Do Not Track). Area admin tidak dihitung.
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    if (pathname.startsWith('/admin') || lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    api.post('/track', { path: pathname }).catch(() => undefined);
  }, [pathname]);
  return (
    <div className="xl-app">
      <a className="skip-link" href="#konten">
        {t('nav.skip')}
      </a>
      <Header />
      <main id="konten" className="xl-main" tabIndex={-1}>
        {lang === 'en' && contentArea && (
          <div className="xl-page pt-3">
            <p className="xl-lang-notice" role="note">
              {t('lang.notice')}
            </p>
          </div>
        )}
        <Suspense
          fallback={
            <div className="xl-page">
              <Loading label="Memuat halaman…" lines={3} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
