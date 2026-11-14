import { useEffect, useRef, useState } from 'react';
import { draw, poseAt, VIEW, type Move, type Targets } from '../anim/figure';
import { useI18n } from '../i18n';
import { FigurePrims } from './Figure';

/** Animated figure for an exercise with the worked muscles highlighted. Tap to pause. */
export function ExerciseAnim({ move, targets, label, big }: { move: Move; targets?: Targets; label: string; big?: boolean }) {
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
  const prims = draw(move, poseAt(move, ms), targets);

  return (
    <button className={big ? 'anim anim-big' : 'anim'} onClick={() => setPlaying((p) => !p)} aria-label={label}>
      <svg viewBox={vb.join(' ')} role="img" aria-label={label}>
        <FigurePrims prims={prims} />
      </svg>
      {!playing && <span className="anim-play" aria-hidden="true">▶</span>}
    </button>
  );
}

/** Legend: main and supporting muscles as coloured chips. */
export function MuscleChips({ targets }: { targets?: Targets }) {
  const { t, muscleName } = useI18n();
  if (!targets) return null;
  return (
    <div className="muscles">
      {targets.p.length > 0 && (
        <div>
          <span className="muscles-label">{t.primaryMuscles}</span>
          {targets.p.map((m) => <span key={m} className="chip chip-m1">{muscleName(m)}</span>)}
        </div>
      )}
      {targets.s.length > 0 && (
        <div>
          <span className="muscles-label">{t.secondaryMuscles}</span>
          {targets.s.map((m) => <span key={m} className="chip chip-m2">{muscleName(m)}</span>)}
        </div>
      )}
    </div>
  );
}
