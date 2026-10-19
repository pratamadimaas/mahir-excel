import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../app/AuthContext';
import { Loading } from './feedback/Feedback';

/** Materi belajar hanya untuk pengguna yang sudah masuk; pengunjung diarahkan ke halaman masuk. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Memeriksa sesi…" lines={2} />;
  if (!user) return <Navigate to="/masuk" replace />;
  return <>{children}</>;
}
