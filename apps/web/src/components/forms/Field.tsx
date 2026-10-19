import type { InputHTMLAttributes } from 'react';

/** Kolom formulir dengan label terhubung, petunjuk, dan pesan galat yang dibacakan pembaca layar. */
export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: { id: string; label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        id={id}
        className={`form-control${error ? ' is-invalid' : ''}`}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && (
        <div id={`${id}-hint`} className="form-text">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${id}-err`} className="invalid-feedback">
          {error}
        </div>
      )}
    </div>
  );
}
