import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import { indexToCol } from '@excellab/spreadsheet-engine';

export interface CellDisplay {
  text: string;
  kind: 'num' | 'text' | 'bool' | 'err' | 'empty';
  title?: string;
}

interface Props {
  label: string;
  rows: number;
  cols: number;
  getRaw: (ref: string) => string;
  getDisplay: (ref: string) => CellDisplay;
  editable: ReadonlySet<string>;
  targets?: ReadonlySet<string>;
  highlights?: ReadonlySet<string>;
  selected: string;
  onSelect: (ref: string) => void;
  onChange: (ref: string, value: string) => void;
  onReadOnlyAttempt?: (ref: string) => void;
  disabled?: boolean;
  /** Nomor baris (mulai 1) yang disembunyikan oleh filter. */
  hiddenRows?: ReadonlySet<number>;
  filtered?: boolean;
  /** Ctrl+D (salin dari atas) dan Ctrl+R (salin dari kiri) pada sel terpilih. */
  onFill?: (kind: 'from-above' | 'from-left') => void;
  /** Seret gagang isi otomatis dari sel `from` sampai sel `to` (satu arah). */
  onFillDrag?: (from: string, to: string) => void;
}

const refOf = (c: number, r: number): string => `${indexToCol(c)}${r + 1}`;

function parse(ref: string): { c: number; r: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  let c = 0;
  for (const ch of m[1]!) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { c: c - 1, r: Number(m[2]) - 1 };
}

interface CellProps {
  refName: string;
  display: CellDisplay;
  raw: string;
  isSelected: boolean;
  isEditable: boolean;
  isTarget: boolean;
  isRef: boolean;
  fillPreview: boolean;
  showHandle: boolean;
  onFillStart: (ref: string, e: ReactPointerEvent<HTMLElement>) => void;
  onFillMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onFillEnd: (e: ReactPointerEvent<HTMLElement>) => void;
  editing: boolean;
  disabled: boolean;
  onMouseDown: (ref: string) => void;
  onDoubleClick: (ref: string) => void;
  onInput: (ref: string, v: string) => void;
  onEditKey: (e: KeyboardEvent<HTMLInputElement>, ref: string) => void;
  onEditBlur: () => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const cls = [
    'xl-cell',
    p.display.kind === 'empty' ? '' : p.display.kind,
    p.isEditable ? 'editable' : 'readonly',
    p.isSelected ? 'selected' : '',
    p.isRef ? 'ref' : '',
    p.isTarget ? 'target' : '',
    p.fillPreview ? 'fill-preview' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <td
      role="gridcell"
      data-ref={p.refName}
      className={cls}
      tabIndex={p.isSelected ? 0 : -1}
      aria-selected={p.isSelected}
      aria-readonly={!p.isEditable}
      aria-label={`${p.refName}${p.display.text ? `: ${p.display.text}` : ', kosong'}${p.isEditable ? ', dapat diisi' : ', hanya baca'}`}
      title={p.display.title}
      onMouseDown={() => p.onMouseDown(p.refName)}
      onDoubleClick={() => p.onDoubleClick(p.refName)}
    >
      {p.editing ? (
        <input
          autoFocus
          aria-label={`Isi sel ${p.refName}`}
          value={p.raw}
          disabled={p.disabled}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onChange={(e) => p.onInput(p.refName, e.target.value)}
          onKeyDown={(e) => p.onEditKey(e, p.refName)}
          onBlur={p.onEditBlur}
        />
      ) : (
        <>
          {p.display.text}
          {p.showHandle && (
            <span
              className="xl-fill-handle"
              aria-hidden="true"
              title="Seret untuk mengisi otomatis"
              onPointerDown={(e) => p.onFillStart(p.refName, e)}
              onPointerMove={p.onFillMove}
              onPointerUp={p.onFillEnd}
              onPointerCancel={p.onFillEnd}
            />
          )}
        </>
      )}
    </td>
  );
});

/**
 * Grid spreadsheet sederhana: seleksi, navigasi keyboard, dan penyuntingan di tempat.
 * Hanya sel dalam `editable` yang dapat diubah.
 */
export function SpreadsheetGrid(props: Props) {
  const { rows, cols, selected, editable, onSelect, onChange, onReadOnlyAttempt, disabled, hiddenRows, onFill, onFillDrag } = props;
  const [dragTo, setDragTo] = useState<string | null>(null);
  const dragFrom = useRef<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const original = useRef('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef(false);

  const sel = parse(selected);

  const focusCell = useCallback((ref: string) => {
    requestAnimationFrame(() => {
      wrapRef.current?.querySelector<HTMLElement>(`[data-ref="${ref}"]`)?.focus({ preventScroll: false });
    });
  }, []);

  useEffect(() => {
    if (focusAfter.current && !editing) {
      focusAfter.current = false;
      focusCell(selected);
    }
  });

  const move = (dc: number, dr: number, from = sel): string => {
    const c = Math.min(cols - 1, Math.max(0, from.c + dc));
    let r = from.r;
    if (dr !== 0) {
      // Lewati baris yang disembunyikan filter.
      let next = r + dr;
      while (next >= 0 && next < rows && hiddenRows?.has(next + 1)) next += dr;
      if (next >= 0 && next < rows) r = next;
    }
    return refOf(c, r);
  };

  // --- gagang isi otomatis ---
  const constrain = (from: string, to: string): string => {
    const a = parse(from);
    const b = parse(to);
    return Math.abs(b.r - a.r) >= Math.abs(b.c - a.c) ? refOf(a.c, b.r) : refOf(b.c, a.r);
  };
  const onFillStart = (from: string, e: ReactPointerEvent<HTMLElement>): void => {
    if (!onFillDrag || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragFrom.current = from;
    setDragTo(from);
  };
  const onFillMove = (e: ReactPointerEvent<HTMLElement>): void => {
    if (!dragFrom.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-ref]');
    const ref = el?.dataset.ref;
    if (ref) setDragTo(constrain(dragFrom.current, ref));
  };
  const onFillEnd = (): void => {
    const from = dragFrom.current;
    const to = dragTo;
    dragFrom.current = null;
    setDragTo(null);
    if (from && to && from !== to) onFillDrag?.(from, to);
  };
  const inPreview = (ref: string): boolean => {
    if (!dragTo || !dragFrom.current || dragTo === dragFrom.current) return false;
    const a = parse(dragFrom.current);
    const b = parse(dragTo);
    const t = parse(ref);
    if (a.c === b.c) return t.c === a.c && t.r !== a.r && t.r >= Math.min(a.r, b.r) && t.r <= Math.max(a.r, b.r);
    return t.r === a.r && t.c !== a.c && t.c >= Math.min(a.c, b.c) && t.c <= Math.max(a.c, b.c);
  };

  const select = (ref: string, focus = true): void => {
    onSelect(ref);
    if (focus) focusAfter.current = true;
  };

  const startEdit = (ref: string, replace: string | null = null): void => {
    if (disabled) return;
    if (!editable.has(ref)) {
      onReadOnlyAttempt?.(ref);
      return;
    }
    original.current = props.getRaw(ref);
    if (replace !== null) onChange(ref, replace);
    setEditing(ref);
  };

  const stopEdit = (restore = false): void => {
    if (editing && restore) onChange(editing, original.current);
    setEditing(null);
    focusAfter.current = true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>): void => {
    if (editing) return;
    const k = e.key;
    const nav: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (nav[k]) {
      e.preventDefault();
      select(move(nav[k]![0], nav[k]![1]));
    } else if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'D' || k === 'r' || k === 'R')) {
      e.preventDefault();
      onFill?.(k.toLowerCase() === 'd' ? 'from-above' : 'from-left');
    } else if (k === 'Home') {
      e.preventDefault();
      select(refOf(0, sel.r));
    } else if (k === 'End') {
      e.preventDefault();
      select(refOf(cols - 1, sel.r));
    } else if (k === 'Enter' || k === 'F2') {
      e.preventDefault();
      startEdit(selected);
    } else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      if (editable.has(selected) && !disabled) onChange(selected, '');
      else onReadOnlyAttempt?.(selected);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEdit(selected, k);
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>, ref: string): void => {
    const here = parse(ref);
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = move(0, e.shiftKey ? -1 : 1, here);
      setEditing(null);
      select(next);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const next = move(e.shiftKey ? -1 : 1, 0, here);
      setEditing(null);
      select(next);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopEdit(true);
    }
  };

  const cells: ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    if (hiddenRows?.has(r + 1)) continue;
    const tds: ReactElement[] = [];
    for (let c = 0; c < cols; c++) {
      const ref = refOf(c, r);
      tds.push(
        <Cell
          key={ref}
          refName={ref}
          display={props.getDisplay(ref)}
          raw={props.getRaw(ref)}
          isSelected={ref === selected}
          isEditable={editable.has(ref)}
          isTarget={!!props.targets?.has(ref)}
          isRef={!!props.highlights?.has(ref)}
          fillPreview={inPreview(ref)}
          showHandle={ref === selected && !!onFillDrag && editing !== ref && props.getRaw(ref) !== ''}
          onFillStart={onFillStart}
          onFillMove={onFillMove}
          onFillEnd={onFillEnd}
          editing={editing === ref}
          disabled={!!disabled}
          onMouseDown={(x) => {
            if (editing && editing !== x) setEditing(null);
            select(x, false);
          }}
          onDoubleClick={(x) => startEdit(x)}
          onInput={onChange}
          onEditKey={onEditKey}
          onEditBlur={() => setEditing(null)}
        />,
      );
    }
    cells.push(
      <tr key={r}>
        <th scope="row" className={[r === sel.r ? 'active-hdr' : '', props.filtered ? 'filtered' : ''].filter(Boolean).join(' ')}>
          {r + 1}
        </th>
        {tds}
      </tr>,
    );
  }

  return (
    <div className="xl-grid-scroll" ref={wrapRef} tabIndex={-1}>
      <table className="xl-grid" role="grid" aria-label={props.label} aria-rowcount={rows} aria-colcount={cols} onKeyDown={onKeyDown}>
        <colgroup>
          <col style={{ width: 42 }} />
          {Array.from({ length: cols }, (_, c) => (
            <col key={c} className="c" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="corner" aria-hidden="true" />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} scope="col" className={c === sel.c ? 'active-hdr' : ''}>
                {indexToCol(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{cells}</tbody>
      </table>
    </div>
  );
}
