import { useEffect, useState } from 'react';
import { useAuth } from '../app/AuthContext';
import { api, errorMessage } from './api';
import type { ModuleSummary } from './types';

let cache: Promise<ModuleSummary[]> | null = null;

/** Daftar modul dan pelajaran dipakai di banyak halaman; cukup diambil sekali per sesi. */
export function getModules(force = false): Promise<ModuleSummary[]> {
  if (!cache || force) {
    cache = api.get<ModuleSummary[]>('/modules').catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

export function resetCatalogCache(): void {
  cache = null;
}

export function useModules(): { modules: ModuleSummary[] | null; error: string | null; loading: boolean; reload: () => void } {
  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const signedIn = !!user;
  useEffect(() => {
    // Materi hanya untuk pengguna yang masuk: tanpa sesi tidak ada yang diminta ke server.
    if (authLoading || !signedIn) {
      setModules(null);
      return;
    }
    let cancelled = false;
    setError(null);
    getModules(tick > 0)
      .then((m) => !cancelled && setModules(m))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [tick, authLoading, signedIn]);
  return { modules, error, loading: signedIn && !modules && !error, reload: () => setTick((t) => t + 1) };
}

export function flattenLessons(modules: ModuleSummary[]) {
  return modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleSlug: m.slug, moduleTitle: m.title })));
}
