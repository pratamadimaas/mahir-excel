import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Field } from '../../components/forms/Field';
import { EmailCodeForm, useAuthConfig } from './EmailAuth';
import { GoogleButton } from './GoogleButton';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { ConfirmDialog, Loading, Status } from '../../components/feedback/Feedback';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/I18n';
import { api, ApiError, errorMessage } from '../../services/api';
import { getPlatformPref, setPlatformPref, type Platform } from '../shortcuts/prefs';
import { ImportBanner } from '../progress/ProgressPage';
import { VerifyEmailCard } from './VerifyEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginPage() {
  const { t } = useI18n();
  useDocumentTitle(t('login.title'));
  const { user, login } = useAuth();
  const cfg = useAuthConfig();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<'sandi' | 'kode'>(params.get('metode') === 'kode' ? 'kode' : 'sandi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  // Tunggu konfigurasi server dulu agar form tidak berganti di tengah pengetikan.
  if (!cfg) {
    return (
      <div className="xl-page xl-page-narrow py-5">
        <h1>{t('login.title')}</h1>
        <Loading label={t('auth.preparing')} />
      </div>
    );
  }
  const emailEnabled = cfg.emailEnabled;
  const activeTab = emailEnabled ? tab : 'sandi';

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = t('auth.err.email');
    if (!password) errs.password = t('auth.err.password');
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xl-page xl-page-narrow py-5">
      <h1>{t('login.title')}</h1>
      <p className="xl-muted">{t('login.intro')}</p>

      {cfg.googleClientId && <GoogleButton clientId={cfg.googleClientId} />}

      {emailEnabled && (
        <div role="tablist" aria-label={t('login.methods')} className="xl-tabs">
          <button
            type="button"
            role="tab"
            id="tab-sandi"
            aria-selected={activeTab === 'sandi'}
            aria-controls="panel-sandi"
            tabIndex={activeTab === 'sandi' ? 0 : -1}
            onClick={() => setTab('sandi')}
          >
            {t('login.tabPassword')}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-kode"
            aria-selected={activeTab === 'kode'}
            aria-controls="panel-kode"
            tabIndex={activeTab === 'kode' ? 0 : -1}
            onClick={() => setTab('kode')}
          >
            {t('login.tabCode')}
          </button>
        </div>
      )}

      {activeTab === 'sandi' ? (
        <div id="panel-sandi" role={emailEnabled ? 'tabpanel' : undefined} aria-labelledby={emailEnabled ? 'tab-sandi' : undefined}>
          <form onSubmit={submit} noValidate aria-label="Form masuk dengan kata sandi">
            {formError && (
              <Status tone="error" live>
                {formError}
              </Status>
            )}
            <div className="mt-3" />
            <Field
              id="login-email"
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Field
              id="login-pw"
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('auth.processing') : t('login.submit')}
            </button>
            {emailEnabled && (
              <Link to="/lupa-sandi" className="btn btn-link">
                {t('login.forgot')}
              </Link>
            )}
          </form>
        </div>
      ) : (
        <div id="panel-kode" role="tabpanel" aria-labelledby="tab-kode">
          <EmailCodeForm purpose="login" />
        </div>
      )}

      <p className="mt-4 mb-1">
        {t('login.noAccount')} <Link to="/daftar">{t('login.register')}</Link>
      </p>
      {!emailEnabled && <p className="xl-small xl-muted">{t('login.emailOff')}</p>}
    </div>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  useDocumentTitle(t('forgot.title'));
  const { user } = useAuth();
  const cfg = useAuthConfig();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="xl-page xl-page-narrow py-5">
      <h1>{t('forgot.title')}</h1>
      {cfg && !cfg.emailEnabled ? (
        <Status tone="warning">{t('forgot.off')}</Status>
      ) : (
        <>
          <p className="xl-muted">{t('forgot.intro')}</p>
          <EmailCodeForm purpose="reset" />
        </>
      )}
      <p className="mt-4 mb-0">
        <Link to="/masuk">{t('forgot.back')}</Link>
      </p>
    </div>
  );
}

export function RegisterPage() {
  const { t } = useI18n();
  useDocumentTitle(t('register.submit'));
  const { user, register } = useAuth();
  const cfg = useAuthConfig();
  const { localHasData } = useProgress();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('auth.err.name');
    if (!EMAIL_RE.test(email.trim())) errs.email = t('auth.err.email');
    if (password.length < 8) errs.password = t('auth.err.passwordMin');
    else if (password.length > 72) errs.password = t('auth.err.passwordMax');
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim());
      nav('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ email: err.message });
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xl-page xl-page-narrow py-5">
      <h1>{t('register.title')}</h1>
      <p className="xl-muted">
        {t('register.intro')}
        {localHasData && t('register.introImport')}
      </p>
      {cfg?.googleClientId && <GoogleButton clientId={cfg.googleClientId} mode="signup" />}
      <form onSubmit={submit} noValidate aria-label="Form pendaftaran">
        {formError && (
          <Status tone="error" live>
            {formError}
          </Status>
        )}
        <div className="mt-3" />
        <Field
          id="reg-name"
          label={t('auth.displayName')}
          autoComplete="nickname"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Field
          id="reg-email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          id="reg-pw"
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={t('auth.passwordHint')}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('auth.processing') : t('register.submit')}
        </button>
      </form>
      <p className="mt-4 xl-small xl-muted">
        {t('register.privacyPre')} <Link to="/privasi">{t('register.privacyLink')}</Link>. {t('register.termsPre')}{' '}
        <Link to="/syarat">{t('register.termsLink')}</Link>.
      </p>
      <p className="mb-1">
        {t('register.haveAccount')} <Link to="/masuk">{t('login.title')}</Link>
      </p>
      <p className="xl-small mb-0">
        {t('register.codeInstead')} <Link to="/masuk?metode=kode">{t('register.codeLink')}</Link>.
      </p>
    </div>
  );
}

export function ProfilePage() {
  useDocumentTitle('Profil');
  const { user, logout, loading } = useAuth();
  const nav = useNavigate();
  const [platform, setPlatform] = useState<Platform | 'semua'>(() => getPlatformPref());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pw, setPw] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/masuk" replace />;

  const del = async (): Promise<void> => {
    setBusy(true);
    setDelError(null);
    try {
      await api.del('/auth/account', { password: pw });
      await logout().catch(() => undefined);
      nav('/');
    } catch (e) {
      setDelError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xl-page xl-page-narrow py-4">
      <h1>Profil</h1>
      <dl className="xl-meta mb-4">
        <div>
          <dt>Nama tampilan</dt>
          <dd>{user.displayName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Peran</dt>
          <dd>{user.role === 'admin' ? 'Administrator' : 'Pelajar'}</dd>
        </div>
        <div>
          <dt>Paket</dt>
          <dd>
            {user.role === 'admin' ? (
              'Administrator'
            ) : user.premium ? (
              <>Premium{user.premiumUntil && ` sampai ${new Date(user.premiumUntil).toLocaleDateString('id-ID', { dateStyle: 'long' })}`}</>
            ) : (
              <>
                Gratis · <Link to="/premium">Lihat Premium</Link>
              </>
            )}
          </dd>
        </div>
      </dl>

      <ImportBanner />
      <VerifyEmailCard />

      <section aria-labelledby="pref" className="mb-4">
        <h2 id="pref" className="h5">
          Preferensi belajar
        </h2>
        <label htmlFor="pref-plat" className="form-label">
          Platform shortcut bawaan
        </label>
        <select
          id="pref-plat"
          className="form-select"
          style={{ maxWidth: 260 }}
          value={platform}
          onChange={(e) => {
            const v = e.target.value as Platform | 'semua';
            setPlatform(v);
            setPlatformPref(v);
          }}
        >
          <option value="semua">Windows dan Mac</option>
          <option value="windows">Windows</option>
          <option value="mac">Mac</option>
        </select>
        <p className="xl-small xl-muted mt-1">Preferensi ini disimpan di browser ini.</p>
      </section>

      <div className="d-flex flex-wrap gap-2 mb-5">
        {user.role === 'admin' && (
          <Link to="/admin" className="btn btn-outline-primary">
            Buka admin
          </Link>
        )}
        <button type="button" className="btn btn-outline-secondary" onClick={() => void logout().then(() => nav('/'))}>
          Keluar
        </button>
      </div>

      <section aria-labelledby="hapus" className="xl-panel xl-panel-body">
        <h2 id="hapus" className="h6">
          Hapus akun
        </h2>
        <p className="xl-small xl-muted">
          Menghapus akun beserta seluruh progresmu secara permanen. Data di browser ini tidak ikut terhapus.
        </p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setConfirmDelete(true)}>
          Hapus akun saya
        </button>
        <ConfirmDialog
          open={confirmDelete}
          title="Hapus akun secara permanen?"
          confirmLabel={busy ? 'Menghapus…' : 'Hapus akun'}
          danger
          onConfirm={del}
          onCancel={() => (setConfirmDelete(false), setPw(''), setDelError(null))}
        >
          <p>Tindakan ini tidak dapat dibatalkan. Masukkan kata sandimu untuk mengonfirmasi.</p>
          <label htmlFor="del-pw" className="form-label">
            Kata sandi
          </label>
          <input
            id="del-pw"
            type="password"
            className="form-control"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {delError && <div className="invalid-feedback">{delError}</div>}
        </ConfirmDialog>
      </section>
    </div>
  );
}
