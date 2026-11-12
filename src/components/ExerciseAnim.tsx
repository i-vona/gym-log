import { useEffect, useRef, useState } from 'react';
import { draw, poseAt, VIEW, type Move } from '../anim/figure';

/** Animated stick figure for an exercise. Pauses when the user prefers reduced motion. */
export function ExerciseAnim({ move, label }: { move: Move; label: string }) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduced);
  const [ms, setMs] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const offset = ms;
    start.current = null;
    const tick = (now: number) => {
      start.current ??= now;
      setMs(offset + now - start.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const vb = move.vb ?? [0, 0, VIEW.w, VIEW.h];
  const prims = draw(move, poseAt(move, ms));

  return (
    <button className="anim" onClick={() => setPlaying((p) => !p)} aria-label={label}>
      <svg viewBox={vb.join(' ')} role="img" aria-label={label}>
        {prims.map((p, i) => {
          if (p.k === 'l') return <line key={i} className={`a-${p.c}`} x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} strokeWidth={p.w} />;
          if (p.k === 'c') {
            return p.fill
              ? <circle key={i} className={`a-${p.cl} a-fill`} cx={p.c[0]} cy={p.c[1]} r={p.r} />
              : <circle key={i} className={`a-${p.cl} a-ring`} cx={p.c[0]} cy={p.c[1]} r={p.r} strokeWidth={p.w} />;
          }
          return <rect key={i} className={`a-${p.cl} a-fill`} x={p.x} y={p.y} width={p.w} height={p.h} rx={2} />;
        })}
      </svg>
      {!playing && <span className="anim-play" aria-hidden="true">▶</span>}
    </button>
  );
}
