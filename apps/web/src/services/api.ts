/** Klien API tipis. Respons sukses: { data, meta? }, galat: { error: { code, message, details? } }. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** URL absolut ke endpoint API (untuk tautan unduhan). */
export const apiUrl = (path: string): string => `${BASE}/api${path}`;

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = /(?:^|;\s*)excellab_csrf=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]!) : null;
}

interface Envelope<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}

async function raw<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Envelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = csrfToken ?? readCsrfCookie();
    if (token) headers['X-CSRF-Token'] = token;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      credentials: BASE ? 'include' : 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung. Periksa koneksi internetmu lalu coba lagi.');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* body kosong atau bukan JSON */
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Permintaan gagal (${res.status}).`, err?.details);
  }
  return json as Envelope<T>;
}

export const api = {
  get: async <T>(path: string, signal?: AbortSignal): Promise<T> => (await raw<T>('GET', path, undefined, signal)).data,
  page: async <T>(path: string, signal?: AbortSignal) => raw<T[]>('GET', path, undefined, signal),
  post: async <T>(path: string, body?: unknown): Promise<T> => (await raw<T>('POST', path, body ?? {})).data,
  put: async <T>(path: string, body?: unknown): Promise<T> => (await raw<T>('PUT', path, body ?? {})).data,
  del: async <T>(path: string, body?: unknown): Promise<T> => (await raw<T>('DELETE', path, body)).data,
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Terjadi kesalahan tak terduga.';
}
