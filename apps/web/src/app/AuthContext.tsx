import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrfToken } from '../services/api';
import type { User } from '../services/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Masuk atau daftar dengan ID token dari Google Sign-In. */
  googleLogin: (credential: string) => Promise<User>;
  /** Memuat ulang data pengguna dari server (mis. setelah verifikasi email). */
  refresh: () => Promise<void>;
  /** Memverifikasi kode email (login tanpa kata sandi atau atur ulang kata sandi) lalu masuk. */
  emailVerify: (payload: {
    email: string;
    purpose: 'login' | 'reset';
    code: string;
    newPassword?: string;
    displayName?: string;
  }) => Promise<{ user: User; isNew: boolean }>;
}

const Ctx = createContext<AuthState | null>(null);

interface AuthResponse {
  user: User;
  csrfToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: User | null; csrfToken: string | null }>('/auth/me')
      .then((d) => {
        if (cancelled) return;
        setUser(d.user);
        setCsrfToken(d.csrfToken);
      })
      .catch(() => {
        /* API tidak tersedia: tetap berjalan sebagai anonim */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api.post<AuthResponse>('/auth/login', { email, password });
    setCsrfToken(d.csrfToken);
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const d = await api.post<AuthResponse>('/auth/register', { email, password, displayName });
    setCsrfToken(d.csrfToken);
    setUser(d.user);
    return d.user;
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    const d = await api.post<AuthResponse>('/auth/google', { credential });
    setCsrfToken(d.csrfToken);
    setUser(d.user);
    return d.user;
  }, []);

  const emailVerify = useCallback(async (payload: Parameters<AuthState['emailVerify']>[0]) => {
    const d = await api.post<AuthResponse & { isNew: boolean }>('/auth/email/verify', payload);
    setCsrfToken(d.csrfToken);
    setUser(d.user);
    return { user: d.user, isNew: d.isNew };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await api.get<{ user: User | null; csrfToken: string | null }>('/auth/me');
      setUser(d.user);
      if (d.csrfToken) setCsrfToken(d.csrfToken);
    } catch {
      /* biarkan data lama */
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setCsrfToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, googleLogin, emailVerify, refresh }),
    [user, loading, login, register, logout, googleLogin, emailVerify, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return v;
}
