import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../app/AuthContext';
import { Status } from '../../components/feedback/Feedback';
import { useI18n } from '../../i18n/I18n';

interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: string }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';
let loader: Promise<void> | null = null;

/** Memuat skrip Google Identity Services sekali saja. */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('Gagal memuat skrip Google'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * Tombol "Masuk dengan Google". Token dikirim ke server untuk diverifikasi; klien tidak pernah
 * mempercayai isi token sendiri. Disembunyikan bila server tidak mengonfigurasi Client ID.
 */
export function GoogleButton({ clientId, mode = 'signin' }: { clientId: string; mode?: 'signin' | 'signup' }) {
  const { googleLogin } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !box.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            if (!res.credential) {
              setError(t('auth.googleError'));
              return;
            }
            setError(null);
            googleLogin(res.credential)
              .then(() => nav('/'))
              .catch(() => setError(t('auth.googleError')));
          },
        });
        window.google.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width: 280,
          locale: lang,
        });
      })
      .catch(() => !cancelled && setFailedToLoad(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, googleLogin, nav, t, lang, mode]);

  if (failedToLoad) return null; // tanpa koneksi ke Google, form email tetap berfungsi
  return (
    <div className="my-3" data-testid="google-signin">
      <div ref={box} aria-label="Masuk dengan Google" />
      {error && (
        <Status tone="error" live>
          {error}
        </Status>
      )}
      <p className="xl-small xl-muted text-center my-3" aria-hidden="true">
        — {t('auth.or')} —
      </p>
    </div>
  );
}
