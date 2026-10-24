import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';

/** Kotak penjelasan untuk fitur Premium: apa gunanya, lalu tautan ke halaman Premium. */
export function PremiumLock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="xl-premium-lock" role="note">
      <Lock className="xl-icon" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p className="mb-1">{children}</p>
        <Link to="/premium">Lihat Premium</Link>
      </div>
    </div>
  );
}
