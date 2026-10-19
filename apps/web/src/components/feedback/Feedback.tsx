import { useEffect, useRef, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

export function Loading({ label = 'Memuat…', lines = 0 }: { label?: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="py-4">
      <span className="xl-spinner" aria-hidden="true" /> <span className="ms-2 xl-muted">{label}</span>
      {lines > 0 && (
        <div className="mt-3" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="xl-skeleton mb-2" style={{ height: 14, width: `${95 - i * 12}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Terjadi masalah' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="xl-status error my-3">
      <CircleX className="xl-icon" aria-hidden="true" />
      <div className="flex-grow-1">
        <strong>{title}.</strong> {message}
        {onRetry && (
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRetry}>
              Coba lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="xl-empty">
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}

type Tone = 'success' | 'error' | 'warning' | 'info';
const ICONS = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info } as const;

/** Pesan status: warna selalu disertai ikon dan teks. */
export function Status({ tone, children, live = false }: { tone: Tone; children: ReactNode; live?: boolean }) {
  const Icon = ICONS[tone] ?? CircleAlert;
  return (
    <div className={`xl-status ${tone}`} {...(live ? { role: tone === 'error' ? 'alert' : 'status' } : {})}>
      <Icon className="xl-icon" aria-hidden="true" />
      <div className="flex-grow-1">{children}</div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Dialog konfirmasi berbasis <dialog> (fokus terkunci dan Esc bawaan browser). */
export function ConfirmDialog({ open, title, children, confirmLabel = 'Ya, lanjutkan', danger, onConfirm, onCancel }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  return (
    <dialog ref={ref} className="xl-dialog" aria-labelledby="confirm-title" onCancel={(e) => (e.preventDefault(), onCancel())}>
      <div className="xl-dialog-body">
        <h2 id="confirm-title" className="h5">
          {title}
        </h2>
        <div>{children}</div>
      </div>
      <div className="xl-dialog-foot">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
