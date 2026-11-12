import type { Entry, Exercise, ExerciseType, PlanItem } from './db';
import { useI18n } from './i18n';

export type Field = 'weight' | 'reps' | 'minutes' | 'distance' | 'seconds' | 'meters';

/** The two inputs shown for each exercise type, and which one must be filled in. */
export const FIELDS: Record<ExerciseType, { fields: [Field, Field]; required: Field[] }> = {
  strength: { fields: ['weight', 'reps'], required: ['reps'] },
  cardio: { fields: ['minutes', 'distance'], required: [] }, // at least one of the two
  hold: { fields: ['weight', 'seconds'], required: ['seconds'] },
  carry: { fields: ['weight', 'meters'], required: ['meters'] },
};

export function useExerciseFormat() {
  const { t, fmtNum } = useI18n();

  const fieldLabel = (f: Field, ex: Exercise) =>
    ({
      weight: ex.assisted ? t.assistKg : t.kg,
      reps: t.reps,
      minutes: t.min,
      distance: t.km,
      seconds: t.sec,
      meters: t.m,
    })[f];

  const describe = (e: Entry, ex: Exercise | undefined): string => {
    const w = e.weight ?? 0;
    const kg = `${fmtNum(w, 2)} kg`;
    switch (ex?.type) {
      case 'cardio':
        return [e.minutes != null && `${fmtNum(e.minutes)} min`, e.distance != null && `${fmtNum(e.distance, 2)} km`]
          .filter(Boolean).join(' · ');
      case 'hold':
        return w ? `${e.seconds ?? 0} s · ${kg}` : `${e.seconds ?? 0} s`;
      case 'carry':
        return w ? `${kg} × ${fmtNum(e.meters ?? 0)} m` : `${fmtNum(e.meters ?? 0)} m`;
      default:
        if (ex?.assisted) return `${e.reps ?? 0} ${t.repsWord} (${t.assist} ${kg})`;
        return w ? `${kg} × ${e.reps ?? 0}` : `${e.reps ?? 0} ${t.repsWord}`;
    }
  };

  /** "4 × 10-12 · rest 60 s", "3 × 30 m per side · rest 45 s", "45 s" */
  const target = (it: PlanItem): string => {
    if (!it.target) return '';
    const unit = it.unit === 's' ? ' s' : it.unit === 'm' ? ' m' : it.unit === 'min' ? ' min' : '';
    let s = `${it.sets ? `${it.sets} × ` : ''}${it.target}${unit}`;
    if (it.perSide) s += ` ${t.perSide}`;
    if (it.rest) s += ` · ${t.rest} ${it.rest} s`;
    return s;
  };

  return { fieldLabel, describe, target };
}

/** Value to prefill from a plan target when there is no history: lower end of "10-12". */
export function planDefault(it: PlanItem | undefined): string {
  return it?.target ? it.target.split('-')[0].trim() : '';
}
