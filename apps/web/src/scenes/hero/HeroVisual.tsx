import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sheet, formatValue } from '@excellab/spreadsheet-engine';
import { HeroSceneFallback } from './HeroSceneFallback';

// Three.js dimuat sebagai chunk terpisah dan hanya bila diperlukan.
const ExcelHeroScene = lazy(() => import('./ExcelHeroScene'));

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Perangkat lemah, hemat data, atau layar kecil mendapat ilustrasi CSS tanpa Three.js. */
export function shouldUse3D(): boolean {
  if (typeof window === 'undefined' || typeof matchMedia === 'undefined') return false;
  if (!matchMedia('(min-width: 900px)').matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) <= 2) return false;
  if ((nav.deviceMemory ?? 8) <= 2) return false;
  return webglAvailable();
}

export function HeroVisual() {
  const [want3D, setWant3D] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // Ketik rumus sungguhan lewat mesin spreadsheet agar overlay selalu konsisten dengan hasilnya.
  const formula = useMemo(() => {
    const s = new Sheet({ B2: '350000', B3: '120000', B4: '50000', B5: '200000', B6: '300000', B7: '=SUM(B2:B6)' });
    return { text: '=SUM(B2:B6)', value: formatValue(s.getValue('B7')) };
  }, []);

  useEffect(() => {
    // Tunda sampai browser idle supaya render awal halaman tidak terhambat.
    const start = (): void => setWant3D(shouldUse3D());
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(start, 250);
    return () => window.clearTimeout(id);
  }, []);

  const show3D = want3D && !failed;
  return (
    <div
      className="xl-hero-visual"
      role="img"
      aria-label="Ilustrasi tiga lembar kerja Excel bertumpuk dengan rentang sel B2 sampai B6 terpilih dan rumus SUM pada formula bar."
    >
      <div className="xl-hero-layer" style={{ opacity: show3D && ready ? 0 : 1 }}>
        <HeroSceneFallback />
      </div>
      {show3D && (
        <div className="xl-hero-layer xl-hero-canvas" style={{ opacity: ready ? 1 : 0 }}>
          <SceneBoundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <ExcelHeroScene onReady={() => setReady(true)} reducedMotion={reduced} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
      <div className="xl-hero-formula" aria-hidden="true">
        <span className="fx">fx</span>
        <code>{formula.text}</code>
        <span className="res">{formula.value}</span>
      </div>
    </div>
  );
}
