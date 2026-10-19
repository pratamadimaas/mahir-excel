import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../app/AuthContext';
import { useI18n } from '../../i18n/I18n';
import { Field } from '../../components/forms/Field';
import { Status } from '../../components/feedback/Feedback';
import { api, ApiError, errorMessage } from '../../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface AuthConfig {
  emailEnabled: boolean;
  googleClientId: string | null;
  premium: { priceLabel: string; contactUrl: string | null; paymentEnabled?: boolean; priceIdr?: number; months?: number };
}

const DEFAULT_CONFIG: AuthConfig = { emailEnabled: false, googleClientId: null, premium: { priceLabel: '', contactUrl: null } };

/** Apakah server dapat mengirim email (login kode dan atur ulang kata sandi). */
export function useAuthConfig(): AuthConfig | null {
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<AuthConfig>('/auth/config')
      .then((c) => !cancelled && setCfg({ ...DEFAULT_CONFIG, ...c }))
      .catch(() => !cancelled && setCfg(DEFAULT_CONFIG));
    return () => {
      cancelled = true;
    };
  }, []);
  return cfg;
}

/**
 * Dua langkah: (1) masukkan email -> kode 6 angka dikirim, (2) masukkan kode.
 * purpose "login": masuk tanpa kata sandi (akun dibuat otomatis bila belum ada).
 * purpose "reset": atur kata sandi baru lalu masuk.
 */
export function EmailCodeForm({ purpose }: { purpose: 'login' | 'reset' }) {
  const { emailVerify } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const send = async (): Promise<boolean> => {
    setFormError(null);
    try {
      const r = await api.post<{ sent: boolean; cooldownSeconds: number }>('/auth/email/request', { email: email.trim(), purpose });
      setCooldown(r.cooldownSeconds);
      return true;
    } catch (err) {
      setFormError(errorMessage(err));
      return false;
    }
  };

  const onEmail = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setErrors({ email: t('auth.err.email') });
    setErrors({});
    setBusy(true);
    if (await send()) setStep('code');
    setBusy(false);
  };

  const onCode = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\d{6}$/.test(code.trim())) errs.code = t('auth.err.code');
    if (purpose === 'reset' && newPassword.length < 8) errs.newPassword = t('auth.err.passwordMin');
    if (purpose === 'reset' && newPassword.length > 72) errs.newPassword = t('auth.err.passwordMax');
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await emailVerify({
        email: email.trim(),
        purpose,
        code: code.trim(),
        ...(purpose === 'reset' ? { newPassword } : {}),
        ...(purpose === 'login' && displayName.trim() ? { displayName: displayName.trim() } : {}),
      });
      nav('/kemajuan');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={onEmail} noValidate aria-label={purpose === 'login' ? t('code.formEmailLogin') : t('code.formEmailReset')}>
        {formError && (
          <Status tone="error" live>
            {formError}
          </Status>
        )}
        <div className="mt-3" />
        <Field
          id={`${purpose}-code-email`}
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          hint={purpose === 'login' ? t('code.hintLogin') : t('code.hintReset')}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('code.sending') : t('code.send')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onCode} noValidate aria-label={t('code.formCode')}>
      <div className="mt-3">
        <Status tone="info" live>
          {t('code.sentPre')} <strong>{email.trim()}</strong> {t('code.sentPost')}
        </Status>
      </div>
      {formError && (
        <div className="mt-3">
          <Status tone="error" live>
            {formError}
          </Status>
        </div>
      )}
      <div className="mt-3" />
      <Field
        id={`${purpose}-code`}
        label={t('auth.code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={errors.code}
      />
      {purpose === 'reset' && (
        <Field
          id="reset-new-password"
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          hint={t('auth.passwordHint')}
        />
      )}
      {purpose === 'login' && (
        <Field
          id="login-code-name"
          label={t('auth.displayNameOptional')}
          autoComplete="nickname"
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint={t('auth.displayNameHint')}
        />
      )}
      <div className="d-flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('code.checking') : purpose === 'login' ? t('code.submitLogin') : t('code.submitReset')}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={cooldown > 0 || busy}
          onClick={async () => {
            setBusy(true);
            await send();
            setBusy(false);
          }}
        >
          {cooldown > 0 ? t('code.resendWait', { n: cooldown }) : t('code.resend')}
        </button>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => {
            setStep('email');
            setCode('');
            setErrors({});
            setFormError(null);
          }}
        >
          {t('code.changeEmail')}
        </button>
      </div>
    </form>
  );
}
