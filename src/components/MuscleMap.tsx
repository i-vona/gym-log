import { useMemo } from 'react';
import { draw, type Cls, type Move, type Muscle, type Pose } from '../anim/figure';
import { useI18n } from '../i18n';
import { bounds, FigurePrims } from './Figure';

const STAND: Pose = { view: 'front', t: 90, ua: -77, fa: -84, th: -93, sh: -91, at: ['ground', 100] };
const STILL: Move = { frames: [STAND], noFloor: true };

/**
 * Front and back anatomy with each muscle coloured by `paint`. Tapping a muscle calls
 * `onPick`; the selected muscle gets an outline.
 */
export function MuscleMap({ paint, selected, onPick, small }: {
  paint: (m: Muscle) => Cls;
  selected?: Muscle | null;
  onPick?: (m: Muscle) => void;
  small?: boolean;
}) {
  const { t } = useI18n();
  const views = useMemo(() => (['front', 'back'] as const).map((view) => {
    const prims = draw(STILL, { ...STAND, view }, undefined, paint);
    return { view, prims, vb: bounds(prims) };
  }), [paint]);

  return (
    <div className={small ? 'mmap small' : 'mmap'}>
      {views.map(({ view, prims, vb }) => (
        <figure key={view}>
          <svg viewBox={vb.join(' ')} role="img" aria-label={view === 'front' ? t.front : t.back}>
            <FigurePrims prims={prims} onPick={onPick} selected={selected} />
          </svg>
          <figcaption>{view === 'front' ? t.front : t.back}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Colour scale legend for the map (direct sets per week). */
export function HeatLegend() {
  const { t } = useI18n();
  const steps: [Cls, string][] = [['mu', t.legendNone], ['h1', '1–2'], ['h2', '3–5'], ['h3', '6–9'], ['h4', '10+']];
  return (
    <div className="heat-legend">
      <span className="muscles-label">{t.mapLegendTitle}</span>
      <div>
        {steps.map(([c, label]) => (
          <span key={c} className="heat-step"><i className={`heat-sw a-${c}`} />{label}</span>
        ))}
      </div>
    </div>
  );
}
