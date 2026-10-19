import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../services/api';
import { getModules } from '../../services/catalog';
import type { ExerciseSummary, ShortcutView, WorksheetView } from '../../services/types';

interface Item {
  type: 'Pelajaran' | 'Latihan' | 'Shortcut' | 'Worksheet';
  title: string;
  extra: string;
  to: string;
}

let indexPromise: Promise<Item[]> | null = null;

function loadIndex(): Promise<Item[]> {
  indexPromise ??= Promise.all([
    getModules(),
    api.page<ExerciseSummary>('/exercises?pageSize=100'),
    api.page<ShortcutView>('/shortcuts?pageSize=200'),
    api.get<WorksheetView[]>('/worksheets'),
  ])
    .then(([modules, ex, sc, ws]) => [
      ...modules.flatMap((m) =>
        m.lessons.map((l): Item => ({ type: 'Pelajaran', title: l.title, extra: `${m.title} ${l.summary}`, to: `/belajar/${l.slug}` })),
      ),
      ...ex.data.map((e): Item => ({ type: 'Latihan', title: e.title, extra: e.description, to: `/latihan/${e.slug}` })),
      ...sc.data.map((s): Item => ({
        type: 'Shortcut',
        title: s.action,
        extra: `${s.keysWindows ?? ''} ${s.keysMac ?? ''}`,
        to: `/shortcut?q=${encodeURIComponent(s.action)}`,
      })),
      ...ws.map((w): Item => ({ type: 'Worksheet', title: w.title, extra: w.description, to: `/worksheet/${w.slug}` })),
    ])
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

const norm = (s: string): string => s.toLowerCase();

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal?.();
      setQ('');
      setActive(0);
      loadIndex()
        .then((i) => (setItems(i), setError(false)))
        .catch(() => setError(true));
    }
    if (!open && d.open) d.close?.();
  }, [open]);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items.filter((i) => i.type === 'Pelajaran').slice(0, 8);
    return items.filter((i) => terms.every((t) => norm(`${i.title} ${i.extra}`).includes(t))).slice(0, 12);
  }, [q, items]);

  const go = (item: Item | undefined): void => {
    if (!item) return;
    onClose();
    nav(item.to);
  };

  return (
    <dialog
      ref={ref}
      className="xl-dialog"
      aria-label="Pencarian"
      onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="xl-dialog-body">
        <label htmlFor="global-search" className="form-label">
          Cari pelajaran, latihan, shortcut, atau worksheet
        </label>
        <input
          id="global-search"
          className="form-control"
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `sr-${active}` : undefined}
          value={q}
          placeholder="mis. SUMIF, filter, anggaran"
          onChange={(e) => (setQ(e.target.value), setActive(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(results[active]);
            }
          }}
        />
        {error && <p className="text-danger xl-small mt-2 mb-0">Indeks pencarian gagal dimuat. Coba tutup dan buka lagi.</p>}
        <ul
          id="search-results"
          role="listbox"
          aria-label="Hasil pencarian"
          className="list-unstyled mt-3 mb-0"
          style={{ maxHeight: 320, overflowY: 'auto' }}
        >
          {results.map((r, i) => (
            <li
              key={r.to + r.title}
              id={`sr-${i}`}
              role="option"
              aria-selected={i === active}
              className="d-flex justify-content-between gap-3 px-2 py-2 rounded"
              style={{ cursor: 'pointer', background: i === active ? 'var(--xl-green-light)' : undefined }}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span>{r.title}</span>
              <span className="xl-muted xl-small">{r.type}</span>
            </li>
          ))}
          {results.length === 0 && !error && <li className="xl-muted px-2 py-2">Tidak ada hasil untuk “{q}”.</li>}
        </ul>
      </div>
      <div className="xl-dialog-foot">
        <span className="xl-muted xl-small me-auto">↑ ↓ memilih · Enter membuka · Esc menutup</span>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Tutup
        </button>
      </div>
    </dialog>
  );
}
