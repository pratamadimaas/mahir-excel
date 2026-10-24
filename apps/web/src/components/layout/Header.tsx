import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Flame, Languages, Menu, Search, Trophy, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { useI18n } from '../../i18n/I18n';
import { flattenLessons, useModules } from '../../services/catalog';
import { SearchDialog } from './SearchDialog';

export function Wordmark() {
  const { t } = useI18n();
  return (
    <Link to="/" className="xl-brand" aria-label={t('nav.home')}>
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="6" fill="#217346" />
        <path d="M9 8h14v16H9z" fill="none" stroke="#fff" strokeWidth="1.6" />
        <path d="M9 13.3h14M9 18.7h14M16 8v16" stroke="#fff" strokeWidth="1.2" opacity=".75" />
        <rect x="16" y="13.3" width="7" height="5.4" fill="#fff" opacity=".95" />
      </svg>
      Mahir Excel
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  const { user, logout } = useAuth();
  const { progress } = useProgress();
  const { modules } = useModules();
  const { t, lang, setLang } = useI18n();

  // Pengunjung tanpa akun hanya dapat membuka tes penempatan; materi lain menunggu login.
  const NAV = user
    ? [
        { to: '/belajar', label: t('nav.learn') },
        { to: '/jalur', label: t('nav.paths') },
        { to: '/latihan', label: t('nav.practice') },
        { to: '/shortcut', label: t('nav.shortcuts') },
        { to: '/worksheet', label: t('nav.worksheets') },
        { to: '/template', label: t('nav.templates') },
        { to: '/sprint', label: t('nav.sprint') },
        { to: '/program', label: t('nav.program') },
        ...(user.premium ? [] : [{ to: '/premium', label: t('nav.premium') }]),
      ]
    : [
        { to: '/jalur', label: t('nav.paths') },
        { to: '/#belajar', label: t('nav.learn'), hash: true },
        { to: '/#harga', label: t('nav.pricing'), hash: true },
        { to: '/#faq', label: t('nav.faq'), hash: true },
      ];

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nextLesson = useMemo(() => {
    if (!modules) return null;
    const all = flattenLessons(modules);
    const started = progress.completedLessons.size > 0 || Object.keys(progress.completedExercises).length > 0;
    if (!started) return null;
    return all.find((l) => !progress.completedLessons.has(l.slug)) ?? null;
  }, [modules, progress]);

  const langButton = (
    <button
      type="button"
      className="xl-icon-btn"
      onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
      aria-label={t('lang.switch')}
      title={t('lang.switch')}
    >
      <Languages className="xl-icon" aria-hidden="true" />
      <span aria-hidden="true">{lang === 'id' ? 'ID' : 'EN'}</span>
    </button>
  );

  return (
    <header className="xl-header">
      <div className="xl-page">
        <div className="xl-header-inner">
          <Wordmark />
          <nav className="xl-nav" aria-label={t('nav.main')}>
            {NAV.map((n) =>
              'hash' in n ? (
                <Link key={n.to} to={n.to}>
                  {n.label}
                </Link>
              ) : (
                <NavLink key={n.to} to={n.to}>
                  {n.label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="xl-header-actions">
            {user && (
              <button type="button" className="xl-icon-btn" onClick={() => setSearchOpen(true)} aria-label={t('nav.searchLabel')}>
                <Search className="xl-icon" aria-hidden="true" />
                <span className="d-none d-xl-inline xl-muted">{t('nav.search')}</span>
              </button>
            )}
            {langButton}
            {user && nextLesson && (
              <Link to={`/belajar/${nextLesson.slug}`} className="btn btn-primary btn-sm d-none d-xxl-inline-flex text-nowrap">
                {t('nav.continue')}
              </Link>
            )}
            {user && (
              <Link
                to="/kemajuan"
                className="xl-chip"
                aria-label={t('nav.progressLabel', { points: progress.totalPoints, days: progress.streak.current })}
              >
                <Trophy className="xl-icon" aria-hidden="true" />
                <strong>{progress.totalPoints}</strong>
                <Flame className="xl-icon" aria-hidden="true" />
                <strong>{progress.streak.current}</strong>
              </Link>
            )}
            {user ? (
              <Link to="/profil" className="xl-icon-btn" aria-label={t('nav.profileLabel', { name: user.displayName })}>
                <UserIcon className="xl-icon" aria-hidden="true" />
                <span className="d-none d-lg-inline text-truncate" style={{ maxWidth: 110 }}>
                  {user.displayName}
                </span>
              </Link>
            ) : (
              <>
                <Link to="/masuk" className="xl-icon-btn d-none d-sm-inline-flex">
                  {t('nav.login')}
                </Link>
                <Link to="/daftar" className="xl-cta d-none d-sm-inline-flex">
                  {t('nav.register')}
                </Link>
              </>
            )}
            <button
              type="button"
              className="xl-icon-btn xl-menu-toggle"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="xl-icon" aria-hidden="true" /> : <Menu className="xl-icon" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className="xl-mobile-menu">
          <div className="xl-page">
            <nav aria-label={t('nav.mobile')}>
              {NAV.map((n) =>
                'hash' in n ? (
                  <Link key={n.to} to={n.to}>
                    {n.label}
                  </Link>
                ) : (
                  <NavLink key={n.to} to={n.to}>
                    {n.label}
                  </NavLink>
                ),
              )}
              {user && <NavLink to="/tantangan">{t('nav.challenge')}</NavLink>}
              {user && (
                <NavLink to="/kemajuan">{t('nav.progress', { points: progress.totalPoints, days: progress.streak.current })}</NavLink>
              )}
              {user && nextLesson && (
                <NavLink to={`/belajar/${nextLesson.slug}`}>{t('nav.continueNamed', { title: nextLesson.title })}</NavLink>
              )}
              {user ? (
                <>
                  <NavLink to="/profil">{t('nav.profile')}</NavLink>
                  {user.role === 'admin' && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
                  <button type="button" className="xl-link-btn" onClick={() => void logout()}>
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/masuk">{t('nav.login')}</NavLink>
                  <NavLink to="/daftar">{t('nav.register')}</NavLink>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
      {user && <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
