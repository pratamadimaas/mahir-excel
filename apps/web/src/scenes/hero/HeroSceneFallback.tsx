/** Ilustrasi CSS statis: dipakai di mobile, tanpa WebGL, perangkat lemah, atau bila scene 3D gagal. */
export function HeroSceneFallback() {
  return (
    <div className="xl-hero-fallback" aria-hidden="true">
      <div className="xl-fb-sheet xl-fb-back" />
      <div className="xl-fb-sheet xl-fb-mid" />
      <div className="xl-fb-sheet xl-fb-front">
        <span className="xl-fb-range" />
        <span className="xl-fb-cursor" />
      </div>
    </div>
  );
}
