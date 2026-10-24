import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Loading } from '../feedback/Feedback';
import { useI18n } from '../../i18n/I18n';
import { api } from '../../services/api';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * Asal kunjungan, dikirim sekali per sesi tab: utm_source bila ada, kalau tidak host halaman pengarah, kalau tidak "langsung".
 * Hanya nama host yang dikirim (tanpa alamat lengkap), dan server menghitungnya per pengunjung per hari tanpa cookie.
 */
function visitSource(): string | undefined {
  try {
    if (sessionStorage.getItem('xl-src')) return undefined;
    sessionStorage.setItem('xl-src', '1');
  } catch {
    /* penyimpanan diblokir: tetap kirim, server hanya menghitung kunjungan pertama pengunjung hari itu */
  }
  const utm = new URLSearchParams(window.location.search).get('utm_source');
  if (utm && /^[A-Za-z0-9._-]{1,60}$/.test(utm)) return utm;
  try {
    const host = new URL(document.referrer).hostname;
    if (host && host !== window.location.hostname && /^[A-Za-z0-9.-]{1,60}$/.test(host)) return host;
  } catch {
    /* tidak ada pengarah */
  }
  return 'langsung';
}

export function Layout() {
  const { pathname, hash } = useLocation();
  const { t, lang } = useI18n();
  // Isi pelajaran/latihan hanya berbahasa Indonesia; beri tahu pengguna English di area itu.
  const contentArea = /^\/(belajar|latihan|shortcut|worksheet|tantangan|tes-penempatan|kemajuan)/.test(pathname);
  useEffect(() => {
    // Tautan seperti /#harga menggulir ke bagian itu; selain itu kembali ke atas.
    // Bagian bisa baru tampil setelah sesi diperiksa, jadi dicoba lagi beberapa kali.
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      let tries = 0;
      let frame = 0;
      const go = (): void => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView?.({ block: 'start' });
          return;
        }
        if (tries++ < 90) frame = requestAnimationFrame(go);
      };
      go();
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo?.({ top: 0 });
  }, [pathname, hash]);

  // Hitungan kunjungan agregat tanpa cookie (server menghormati Do Not Track). Area admin tidak dihitung.
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    if (pathname.startsWith('/admin') || lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    api.post('/track', { path: pathname, src: visitSource() }).catch(() => undefined);
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
