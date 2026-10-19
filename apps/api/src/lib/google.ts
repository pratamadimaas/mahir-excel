import jwt from 'jsonwebtoken';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleVerifier {
  /** Client ID OAuth Google; null bila login Google tidak dikonfigurasi. */
  clientId: string | null;
  verify(credential: string): Promise<GoogleProfile>;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Memverifikasi ID token Google (Google Identity Services) tanpa dependensi tambahan:
 * tanda tangan RS256 dengan sertifikat publik Google, issuer, audience (Client ID kita), dan masa berlaku.
 */
export function createGoogleVerifier(clientId: string | undefined, fetchImpl: typeof fetch = fetch): GoogleVerifier {
  let certs: { map: Record<string, string>; expires: number } | null = null;

  async function getCerts(): Promise<Record<string, string>> {
    if (certs && certs.expires > Date.now()) return certs.map;
    const res = await fetchImpl(CERTS_URL);
    if (!res.ok) throw new Error(`Gagal memuat sertifikat Google (${res.status})`);
    const map = (await res.json()) as Record<string, string>;
    const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
    certs = { map, expires: Date.now() + (maxAge ? Number(maxAge) : 3600) * 1000 };
    return map;
  }

  return {
    clientId: clientId || null,
    async verify(credential: string): Promise<GoogleProfile> {
      if (!clientId) throw new Error('Login Google tidak dikonfigurasi.');
      const decoded = jwt.decode(credential, { complete: true });
      const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
      if (!kid) throw new Error('Token Google tidak valid.');
      const pem = (await getCerts())[kid];
      if (!pem) throw new Error('Kunci tanda tangan Google tidak dikenal.');
      const payload = jwt.verify(credential, pem, { algorithms: ['RS256'], audience: clientId, issuer: ISSUERS as [string, string] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new Error('Isi token Google tidak lengkap.');
      }
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    },
  };
}
