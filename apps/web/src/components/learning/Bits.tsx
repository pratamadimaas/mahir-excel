import { DIFFICULTY_LABELS, DIFFICULTY_LEVEL, type Difficulty } from '../../services/types';

export function Level({ difficulty }: { difficulty: Difficulty }) {
  const n = DIFFICULTY_LEVEL[difficulty];
  return (
    <span className="xl-level" title={`Tingkat: ${DIFFICULTY_LABELS[difficulty]}`}>
      <i aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <b key={i} className={i <= n ? 'on' : ''} />
        ))}
      </i>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

/** Menampilkan kombinasi tombol sebagai keycap kecil. "Alt + H, O, I" = rangkaian berurutan. */
export function Keycaps({ combo }: { combo: string | null }) {
  if (!combo) return <span className="xl-muted">-</span>;
  const parts = combo.split(' + ');
  return (
    <span className="xl-keycaps" aria-label={combo}>
      {parts.map((p, i) => (
        <span key={i} className="xl-keycaps" aria-hidden="true">
          {i > 0 && <span className="xl-key-sep">+</span>}
          <kbd className="xl-keycap">{p}</kbd>
        </span>
      ))}
    </span>
  );
}

export function ProgressBar({ value, max, label, large }: { value: number; max: number; label: string; large?: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className={`xl-progress${large ? ' lg' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${pct}%`}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
