export interface PublicUserInput {
  id: number;
  email: string;
  displayName: string;
  role: string;
  emailVerified?: boolean;
  /** Nilai kolom premium_until dari database (UTC, "YYYY-MM-DD HH:MM:SS") atau ISO. */
  premiumUntil?: string | null;
}

const toDate = (v: string): Date => new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);

/** Bentuk pengguna yang dikirim ke klien. Admin selalu dianggap premium. */
export function toPublicUser(u: PublicUserInput) {
  const until = u.premiumUntil ? toDate(u.premiumUntil) : null;
  const active = !!until && until.getTime() > Date.now();
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    emailVerified: !!u.emailVerified,
    premium: u.role === 'admin' || active,
    premiumUntil: until ? until.toISOString() : null,
  };
}
