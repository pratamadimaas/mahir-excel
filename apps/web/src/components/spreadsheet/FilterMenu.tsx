import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Tombol panah di header kolom; menu muncul di bawahnya. */
  anchor: HTMLElement;
  /** Judul kolom, untuk nama dialog. */
  label: string;
  /** Semua nilai unik di kolom (teks tampilan). */
  values: string[];
  /** Nilai yang sedang diizinkan; null berarti kolom belum difilter. */
  selected: ReadonlySet<string> | null;
  onApply: (next: Set<string> | null) => void;
  onClose: () => void;
}

const blank = '(Kosong)';

/** Menu filter seperti di Excel: pencarian, "Pilih Semua", daftar nilai bercentang, OK dan Batal. */
export function FilterMenu({ anchor, label, values, selected, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected ?? values));
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? values : values.filter((v) => (v === '' ? blank : v).toLowerCase().includes(q));
  }, [values, query]);
  const allShownOn = shown.length > 0 && shown.every((v) => draft.has(v));
  const someShownOn = shown.some((v) => draft.has(v));

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const width = 240;
    setPos({ position: 'fixed', top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }, [anchor]);

  useEffect(() => {
    searchRef.current?.focus();
    const down = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        anchor.focus();
      }
    };
    const away = (): void => onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', away);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', away);
      window.removeEventListener('scroll', away, true);
    };
  }, [anchor, onClose]);

  const toggle = (v: string): void =>
    setDraft((d) => {
      const n = new Set(d);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  const toggleAll = (): void =>
    setDraft((d) => {
      const n = new Set(d);
      for (const v of shown) {
        if (allShownOn) n.delete(v);
        else n.add(v);
      }
      return n;
    });

  const ok = (): void => onApply(values.every((v) => draft.has(v)) ? null : new Set(values.filter((v) => draft.has(v))));

  return createPortal(
    <div ref={menuRef} className="xl-filter-menu" role="dialog" aria-label={`Filter kolom ${label}`} style={pos}>
      <input
        ref={searchRef}
        type="search"
        className="form-control form-control-sm"
        placeholder="Cari"
        aria-label="Cari nilai"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <ul className="xl-filter-list" aria-label="Nilai di kolom">
        <li>
          <label>
            <input
              type="checkbox"
              checked={allShownOn}
              ref={(el) => {
                if (el) el.indeterminate = !allShownOn && someShownOn;
              }}
              onChange={toggleAll}
            />{' '}
            {query.trim() === '' ? '(Pilih Semua)' : '(Pilih Semua Hasil Pencarian)'}
          </label>
        </li>
        {shown.map((v) => (
          <li key={v}>
            <label>
              <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} /> {v === '' ? blank : v}
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="xl-muted">Tidak ada nilai yang cocok.</li>}
      </ul>
      <div className="xl-filter-actions">
        {selected && (
          <button type="button" className="btn btn-link btn-sm me-auto p-0" onClick={() => onApply(null)}>
            Hapus filter
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Batal
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={ok} disabled={draft.size === 0}>
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}
