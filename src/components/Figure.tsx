import type { Muscle, Prim } from '../anim/figure';

const pts = (ps: [number, number][]) => ps.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`);

/** Renders figure primitives as SVG. Muscles become tappable when `onPick` is given. */
export function FigurePrims({ prims, onPick, selected }: { prims: Prim[]; onPick?: (m: Muscle) => void; selected?: Muscle | null }) {
  return (
    <>
      {prims.map((p, i) => {
        if (p.k === 'l') return <line key={i} className={`a-${p.c}`} x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} strokeWidth={p.w} />;
        if (p.k === 'pl') return <polyline key={i} points={pts(p.pts).join(' ')} className={`a-${p.c}${p.dim ? ' a-dim' : ''}`} strokeWidth={p.w} fill="none" />;
        if (p.k === 'p') {
          const d = 'M' + pts(p.pts).join('L') + 'Z';
          const cls = `a-${p.cl}${p.dim ? ' a-dim' : ''}${p.mu && p.mu === selected ? ' a-selected' : ''}${onPick && p.mu ? ' a-pick' : ''}`;
          return <path key={i} d={d} className={cls} onClick={onPick && p.mu ? () => onPick(p.mu!) : undefined} />;
        }
        if (p.k === 'c') {
          const dim = p.dim ? ' a-dim' : '';
          return p.fill
            ? <circle key={i} className={`a-${p.cl} a-fill${dim}`} cx={p.c[0]} cy={p.c[1]} r={p.r} />
            : <circle key={i} className={`a-${p.cl} a-ring${dim}`} cx={p.c[0]} cy={p.c[1]} r={p.r} strokeWidth={p.w} />;
        }
        return <rect key={i} className={`a-${p.cl} a-fill`} x={p.x} y={p.y} width={p.w} height={p.h} rx={2} />;
      })}
    </>
  );
}

/** Tight viewBox around everything drawn, with some padding. */
// eslint-disable-next-line react-refresh/only-export-components
export function bounds(prims: Prim[], pad = 4): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const p of prims) {
    if (p.k === 'p' || p.k === 'pl') p.pts.forEach((q) => take(q[0], q[1]));
    else if (p.k === 'c') { take(p.c[0] - p.r, p.c[1] - p.r); take(p.c[0] + p.r, p.c[1] + p.r); }
  }
  return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
}
