import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Ilustrasi 3D ringan: tiga lembar kerja tipis dengan grid, rentang sel terpilih, dan panel rumus.
 * Hanya dirender saat dibutuhkan (frameloop="demand"), tanpa tekstur, tanpa post-processing.
 * Teks yang terbaca ada di overlay HTML, bukan di dalam canvas.
 */

const COLS = 8;
const ROWS = 9;
const CW = 0.5;
const CH = 0.34;
const W = COLS * CW;
const H = ROWS * CH;

const GREEN = '#217346';
const GREEN_DARK = '#185c37';

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

function cellCenter(col: number, row: number): [number, number] {
  return [-W / 2 + (col + 0.5) * CW, H / 2 - (row + 0.5) * CH];
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Frame({ w, h, t = 0.022, color, z = 0 }: { w: number; h: number; t?: number; color: string; z?: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + t, t, t]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w + t, t, t]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]}>
        <boxGeometry args={[t, h, t]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[w / 2, 0, 0]}>
        <boxGeometry args={[t, h, t]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function GridLines() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let c = 0; c <= COLS; c++) pts.push(-W / 2 + c * CW, H / 2, 0, -W / 2 + c * CW, -H / 2, 0);
    for (let r = 0; r <= ROWS; r++) pts.push(-W / 2, H / 2 - r * CH, 0, W / 2, H / 2 - r * CH, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} position={[0, 0, 0.019]}>
      <lineBasicMaterial color="#c9d1c9" />
    </lineSegments>
  );
}

/** Batang abu-abu kecil yang menyiratkan isi sel (angka/teks) tanpa teks nyata. */
function CellContent() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const rnd = seeded(7);
    const list: { x: number; y: number; w: number }[] = [];
    for (let r = 1; r < ROWS; r++) {
      for (let c = 1; c < COLS; c++) {
        if (rnd() < 0.28) continue;
        const [cx, cy] = cellCenter(c, r);
        const isText = c === 1;
        const w = isText ? 0.18 + rnd() * 0.12 : 0.12 + rnd() * 0.18;
        list.push({ x: isText ? cx - CW / 2 + 0.06 + w / 2 : cx + CW / 2 - 0.06 - w / 2, y: cy, w });
      }
    }
    return list;
  }, []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, 0.024);
      o.scale.set(it.w, 0.05, 0.01);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#b4bdb4" />
    </instancedMesh>
  );
}

function Scene({ reduced, onReady }: { reduced: boolean; onReady: () => void }) {
  const { invalidate, gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const mid = useRef<THREE.Group>(null);
  const back = useRef<THREE.Group>(null);
  const panel = useRef<THREE.Group>(null);
  const cursor = useRef<THREE.Group>(null);
  const hover = useRef<THREE.Mesh>(null);
  const progress = useRef(reduced ? 1 : 0);
  const startTime = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const cursorPos = useRef<[number, number]>(cellCenter(2, 2));

  useEffect(() => {
    onReady();
    invalidate();
  }, [onReady, invalidate]);

  useEffect(() => {
    if (reduced) return; // tanpa parallax bila pengguna meminta gerakan dikurangi
    const el = gl.domElement;
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      target.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      invalidate();
    };
    const leave = (): void => {
      target.current = { x: 0, y: 0 };
      if (hover.current) hover.current.visible = false;
      invalidate();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [gl, invalidate, reduced]);

  useFrame((state) => {
    if (document.hidden) return;
    if (startTime.current === null) startTime.current = state.clock.elapsedTime;
    const t = reduced ? 1 : Math.min(1, (state.clock.elapsedTime - startTime.current) / 1.0);
    progress.current = t;
    const e = easeOut(t);

    // Lembar bergeser membuka susunan saat masuk.
    if (mid.current) mid.current.position.set(0.22 * e, -0.14 * e, -0.28 * e);
    if (back.current) back.current.position.set(0.44 * e, -0.28 * e, -0.56 * e);
    if (panel.current) {
      panel.current.position.set(0.05, H / 2 + 0.34, 0.5 * e + 0.02);
      panel.current.scale.setScalar(0.94 + 0.06 * e);
    }
    if (cursor.current) cursor.current.position.set(cursorPos.current[0], cursorPos.current[1], 0.03);

    const c = current.current;
    c.x += (target.current.x - c.x) * 0.12;
    c.y += (target.current.y - c.y) * 0.12;
    if (group.current) {
      group.current.rotation.set(-0.62 + c.y * 0.07, -0.42 + c.x * 0.1, 0.1);
      group.current.position.y = -0.1 + (1 - e) * -0.5;
    }
    const settled = Math.abs(target.current.x - c.x) < 0.002 && Math.abs(target.current.y - c.y) < 0.002;
    if (t < 1 || !settled) state.invalidate();
  });

  const onMove = (e: ThreeEvent<PointerEvent>): void => {
    if (!e.uv || !hover.current) return;
    const col = Math.min(COLS - 1, Math.floor(e.uv.x * COLS));
    const row = Math.min(ROWS - 1, Math.floor((1 - e.uv.y) * ROWS));
    const [x, y] = cellCenter(col, row);
    hover.current.position.set(x, y, 0.021);
    hover.current.visible = true;
    invalidate();
  };
  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    if (!e.uv) return;
    const col = Math.min(COLS - 1, Math.max(1, Math.floor(e.uv.x * COLS)));
    const row = Math.min(ROWS - 1, Math.max(1, Math.floor((1 - e.uv.y) * ROWS)));
    cursorPos.current = cellCenter(col, row);
    invalidate();
  };

  const rangeW = 2 * CW;
  const rangeH = 4 * CH;
  const [rx, ry] = [-W / 2 + 2 * CW + rangeW / 2, H / 2 - 2 * CH - rangeH / 2];

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.5, 3.5, 5]} intensity={1.15} />
      <group ref={group} scale={0.98}>
        <group ref={back}>
          <mesh>
            <boxGeometry args={[W, H, 0.03]} />
            <meshStandardMaterial color="#e3e8e3" roughness={0.95} />
          </mesh>
        </group>
        <group ref={mid}>
          <mesh>
            <boxGeometry args={[W, H, 0.03]} />
            <meshStandardMaterial color="#f1f6f2" roughness={0.95} />
          </mesh>
        </group>

        {/* lembar depan */}
        <mesh onPointerMove={onMove} onClick={onClick}>
          <boxGeometry args={[W, H, 0.03]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh position={[0, H / 2 - CH / 2, 0.018]}>
          <planeGeometry args={[W, CH]} />
          <meshBasicMaterial color="#eef1ee" />
        </mesh>
        <mesh position={[-W / 2 + CW / 2, -CH / 2, 0.018]}>
          <planeGeometry args={[CW, H - CH]} />
          <meshBasicMaterial color="#eef1ee" />
        </mesh>
        <GridLines />
        <CellContent />

        {/* rentang terpilih: isi translucent + bingkai hijau */}
        <mesh position={[rx, ry, 0.022]}>
          <planeGeometry args={[rangeW, rangeH]} />
          <meshBasicMaterial color={GREEN} transparent opacity={0.16} depthWrite={false} />
        </mesh>
        <group position={[rx, ry, 0.03]}>
          <Frame w={rangeW} h={rangeH} color={GREEN} />
        </group>

        {/* sel aktif dan sorotan hover */}
        <mesh ref={hover} visible={false}>
          <planeGeometry args={[CW, CH]} />
          <meshBasicMaterial color={GREEN} transparent opacity={0.1} depthWrite={false} />
        </mesh>
        <group ref={cursor}>
          <Frame w={CW} h={CH} t={0.03} color={GREEN_DARK} />
        </group>

        {/* panel rumus mengambang */}
        <group ref={panel}>
          <mesh position={[0.03, -0.03, -0.03]}>
            <boxGeometry args={[W * 0.78, 0.36, 0.02]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.07} />
          </mesh>
          <mesh>
            <boxGeometry args={[W * 0.78, 0.36, 0.03]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          <mesh position={[-W * 0.39 + 0.16, 0, 0.02]}>
            <planeGeometry args={[0.32, 0.36]} />
            <meshBasicMaterial color={GREEN} />
          </mesh>
          <mesh position={[-W * 0.39 + 0.62, 0, 0.02]}>
            <planeGeometry args={[0.58, 0.08]} />
            <meshBasicMaterial color="#c9d1c9" />
          </mesh>
          <mesh position={[-W * 0.39 + 1.12, 0, 0.02]}>
            <planeGeometry args={[0.32, 0.08]} />
            <meshBasicMaterial color="#9fb9a9" />
          </mesh>
        </group>
      </group>
    </>
  );
}

export default function ExcelHeroScene({ onReady, reducedMotion }: { onReady: () => void; reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [0, 0, 9.2], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene reduced={reducedMotion} onReady={onReady} />
    </Canvas>
  );
}
