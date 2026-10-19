import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';

export type Period = 'today' | 'week' | 'all';

export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  at: string;
}

interface Board {
  period: Period;
  entries: BoardEntry[];
  players: number;
  durationSeconds: number;
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: '7 hari' },
  { id: 'all', label: 'Sepanjang masa' },
];

const nf = new Intl.NumberFormat('id-ID');

/** Papan peringkat publik. `highlight` menyorot nama pemain yang baru saja menyimpan skor. */
export function Leaderboard({
  limit = 10,
  highlight,
  refreshKey = 0,
  initial = 'today',
  onLoaded,
  as: Heading = 'h2',
}: {
  limit?: number;
  highlight?: string | null;
  refreshKey?: number;
  initial?: Period;
  onLoaded?: (b: { durationSeconds: number }) => void;
  /** Tingkat judul: h2 di halaman Sprint, h3 bila ditempatkan di bawah judul bagian lain. */
  as?: 'h2' | 'h3';
}) {
  const [period, setPeriod] = useState<Period>(initial);
  const board = useAsync(
    async (s) => {
      const b = await api.get<Board>(`/sprint/leaderboard?period=${period}&limit=${limit}`, s);
      onLoaded?.({ durationSeconds: b.durationSeconds });
      return b;
    },
    [period, limit, refreshKey],
  );

  return (
    <section aria-labelledby="papan">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-2">
        <Heading id="papan" className="h5 mb-0">
          Papan peringkat
        </Heading>
        <div className="xl-sp-periods" role="group" aria-label="Periode papan peringkat">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {board.loading && <Loading label="Memuat papan peringkat…" lines={4} />}
      {board.error && <ErrorState message={board.error} onRetry={board.reload} />}
      {board.data && board.data.entries.length === 0 && (
        <EmptyState title="Belum ada skor">Jadilah yang pertama di papan peringkat periode ini.</EmptyState>
      )}
      {board.data && board.data.entries.length > 0 && (
        <ol className="xl-sp-board" aria-label={`Peringkat ${PERIODS.find((p) => p.id === period)!.label.toLowerCase()}`}>
          {board.data.entries.map((e) => (
            <li key={`${e.rank}-${e.name}`} className={highlight && e.name.toLowerCase() === highlight.toLowerCase() ? 'me' : undefined}>
              <span className="rank" aria-label={`Peringkat ${e.rank}`}>
                {e.rank}
              </span>
              <span className="name">{e.name}</span>
              <span className="meta">{e.correct} benar</span>
              <strong className="score">{nf.format(e.score)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
