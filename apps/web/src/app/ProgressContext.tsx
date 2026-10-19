import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProgressSnapshot, ProgressView, ReviewDueItem } from '@excellab/shared';
import { api } from '../services/api';
import {
  clearLocal,
  completeLesson as localComplete,
  getStorage,
  isEmptyProgress,
  loadLocal,
  localDue,
  localTotals,
  recordResult,
  saveLocal,
  uncompleteLesson as localUncomplete,
} from '../services/progressStore';
import { emptyProgress } from '@excellab/shared';
import type { SubmitResult } from '../services/types';
import { useAuth } from './AuthContext';

export interface UnifiedProgress {
  source: 'local' | 'account';
  completedLessons: Set<string>;
  completedExercises: Record<string, { points: number; attempts: number }>;
  reviews: Record<string, { message: string; at: string }>;
  totalPoints: number;
  streak: { current: number; longest: number };
  activeDays: string[];
}

export interface ImportResult {
  lessons: number;
  exercises: number;
  pointsAdded: number;
}

interface ProgressState {
  progress: UnifiedProgress;
  loading: boolean;
  storageAvailable: boolean;
  localHasData: boolean;
  /** Latihan yang waktunya diulang (jadwal ulang terjadwal), baik dari akun maupun data lokal. */
  reviewDue: { slug: string; box: number; dueAt: string; title?: string }[];
  reviewUpcoming: number;
  recordSubmission: (slug: string, points: number, result: SubmitResult) => Promise<number>;
  completeLesson: (slug: string) => Promise<void>;
  uncompleteLesson: (slug: string) => Promise<void>;
  resetLocal: () => void;
  importLocal: () => Promise<ImportResult>;
  dismissImport: () => void;
  importDismissed: boolean;
}

const Ctx = createContext<ProgressState | null>(null);

function fromLocal(s: ProgressSnapshot): UnifiedProgress {
  const t = localTotals(s);
  return {
    source: 'local',
    completedLessons: new Set(s.completedLessons),
    completedExercises: Object.fromEntries(
      Object.entries(s.exercises).map(([k, v]) => [k, { points: v.points ?? 0, attempts: v.attempts }]),
    ),
    reviews: s.reviews,
    totalPoints: t.totalPoints,
    streak: t.streak,
    activeDays: s.activeDays,
  };
}

function fromAccount(v: ProgressView): UnifiedProgress {
  return {
    source: 'account',
    completedLessons: new Set(v.completedLessons),
    completedExercises: Object.fromEntries(Object.entries(v.exercises).map(([k, e]) => [k, { points: e.points, attempts: e.attempts }])),
    reviews: v.reviews,
    totalPoints: v.totalPoints,
    streak: v.streak,
    activeDays: v.activeDays,
  };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storage = useMemo(() => getStorage(), []);
  const [local, setLocalState] = useState<ProgressSnapshot>(() => loadLocal(storage));
  const localRef = useRef(local);
  const setLocal = useCallback((next: ProgressSnapshot) => {
    localRef.current = next;
    setLocalState(next);
  }, []);
  const [account, setAccount] = useState<ProgressView | null>(null);
  const [dueAccount, setDueAccount] = useState<{ due: ReviewDueItem[]; upcoming: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);

  const storageAvailable = useMemo(() => {
    if (!storage) return false;
    try {
      storage.setItem('excellab.probe', '1');
      storage.removeItem('excellab.probe');
      return true;
    } catch {
      return false;
    }
  }, [storage]);

  const loadDue = useCallback(async () => {
    try {
      setDueAccount(await api.get<{ due: ReviewDueItem[]; upcoming: number }>('/progress/review-due'));
    } catch {
      setDueAccount(null);
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    setAccount(await api.get<ProgressView>('/progress'));
    await loadDue();
  }, [loadDue]);

  useEffect(() => {
    if (!user) {
      setAccount(null);
      setDueAccount(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<ProgressView>('/progress')
      .then((v) => {
        if (cancelled) return;
        setAccount(v);
        void loadDue();
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, loadDue]);

  const updateLocal = useCallback(
    (fn: (s: ProgressSnapshot) => ProgressSnapshot) => {
      const next = fn(localRef.current);
      saveLocal(storage, next);
      setLocal(next);
    },
    [storage, setLocal],
  );

  const recordSubmission = useCallback(
    async (slug: string, points: number, result: SubmitResult): Promise<number> => {
      if (user) {
        await fetchAccount();
        return result.pointsAwarded;
      }
      const r = recordResult(localRef.current, slug, {
        correct: result.correct,
        message: result.targets.find((t) => !t.ok)?.message ?? result.message,
        points,
      });
      saveLocal(storage, r.snapshot);
      setLocal(r.snapshot);
      return r.pointsAwarded;
    },
    [user, fetchAccount, storage, setLocal],
  );

  const completeLesson = useCallback(
    async (slug: string) => {
      if (user) {
        setAccount(await api.put<ProgressView>('/progress', { lessonSlug: slug, completed: true }));
      } else updateLocal((s) => localComplete(s, slug));
    },
    [user, updateLocal],
  );

  const uncompleteLesson = useCallback(
    async (slug: string) => {
      if (user) {
        setAccount(await api.put<ProgressView>('/progress', { lessonSlug: slug, completed: false }));
      } else updateLocal((s) => localUncomplete(s, slug));
    },
    [user, updateLocal],
  );

  const resetLocal = useCallback(() => {
    clearLocal(storage);
    setLocal(emptyProgress());
  }, [storage, setLocal]);

  const importLocal = useCallback(async (): Promise<ImportResult> => {
    const res = await api.post<{ progress: ProgressView; imported: ImportResult }>('/progress/sync', { snapshot: localRef.current });
    setAccount(res.progress);
    void loadDue();
    clearLocal(storage);
    setLocal(emptyProgress());
    return res.imported;
  }, [storage, setLocal, loadDue]);

  const progress = useMemo(() => (user && account ? fromAccount(account) : fromLocal(local)), [user, account, local]);

  const value = useMemo<ProgressState>(
    () => ({
      progress,
      loading,
      storageAvailable,
      localHasData: !isEmptyProgress(local),
      reviewDue: user && account ? (dueAccount?.due ?? []) : localDue(local),
      reviewUpcoming:
        user && account ? (dueAccount?.upcoming ?? 0) : Math.max(0, Object.keys(local.schedule ?? {}).length - localDue(local).length),
      recordSubmission,
      completeLesson,
      uncompleteLesson,
      resetLocal,
      importLocal,
      dismissImport: () => setImportDismissed(true),
      importDismissed,
    }),
    [
      progress,
      loading,
      storageAvailable,
      local,
      user,
      account,
      dueAccount,
      recordSubmission,
      completeLesson,
      uncompleteLesson,
      resetLocal,
      importLocal,
      importDismissed,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProgress harus dipakai di dalam ProgressProvider');
  return v;
}
