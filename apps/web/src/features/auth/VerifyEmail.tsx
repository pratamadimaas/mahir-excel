import { useEffect, useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { Field } from '../../components/forms/Field';
import { Status } from '../../components/feedback/Feedback';
import { api, errorMessage } from '../../services/api';
import { useAuthConfig } from './EmailAuth';

/** Kartu verifikasi email untuk akun yang belum terverifikasi (mis. mendaftar dengan kata sandi). Opsional, tidak membatasi fitur. */
export function VerifyEmailCard() {
  const { user, refresh } = useAuth();
  const cfg = useAuthConfig();
  const [step, setStep] = useState<'idle' | 'code' | 'done'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!user || !cfg?.emailEnabled) return null;
  // Setelah berhasil, status pengguna berubah menjadi terverifikasi; pesan sukses tetap ditampilkan di sesi ini.
  if (user.emailVerified !== false && step !== 'done') return null;

  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ cooldownSeconds: number }>('/auth/email/request', { email: user.email, purpose: 'verify' });
      setCooldown(r.cooldownSeconds);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return setError('Kode terdiri dari 6 angka.');
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/email/verify', { email: user.email, purpose: 'verify', code: code.trim() });
      await refresh();
      setStep('done');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <Status tone="success" live>
        <MailCheck className="xl-icon me-1" aria-hidden="true" /> Email berhasil diverifikasi.
      </Status>
    );
  }

  return (
    <section className="xl-panel xl-panel-body mb-4" aria-labelledby="verifikasi-email">
      <h2 id="verifikasi-email" className="h6">
        Verifikasi emailmu
      </h2>
      <p className="xl-small xl-muted">
        Emailmu belum terverifikasi. Verifikasi memastikan kamu bisa memulihkan akun lewat email. Fitur belajar tetap bisa dipakai tanpa
        verifikasi.
      </p>
      {error && (
        <Status tone="error" live>
          {error}
        </Status>
      )}
      {step === 'idle' ? (
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void send()} disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim kode verifikasi'}
        </button>
      ) : (
        <form onSubmit={verify} noValidate aria-label="Masukkan kode verifikasi">
          <Field
            id="verify-code"
            label={`Kode 6 angka yang dikirim ke ${user.email}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <div className="d-flex gap-2 flex-wrap">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? 'Memeriksa…' : 'Verifikasi'}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void send()} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Kirim ulang (${cooldown} dtk)` : 'Kirim ulang kode'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
