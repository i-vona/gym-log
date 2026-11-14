import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, e1rm, type Entry, type Exercise } from '../db';
import { useI18n } from '../i18n';
import { bestEntry, useExerciseFormat } from '../exerciseFormat';
import { workingSets } from '../analytics';
import { MUSCLES } from '../anim/muscles';
import type { Cls, Muscle } from '../anim/figure';
import { MuscleMap } from './MuscleMap';
import { MuscleChips } from './ExerciseAnim';

type Record_ = { ex: Exercise; label: string; value: string };

/** What was done on a day: totals, new records, comparison with last time, muscles. */
export function WorkoutSummary({ date, entries }: { date: string; entries: Entry[] }) {
  const { t, exName, fmtNum, fill } = useI18n();
  const { describe } = useExerciseFormat();
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);
  const ids = useMemo(() => [...new Set(entries.map((e) => e.exerciseId))], [entries]);
  const prior = useLiveQuery(
    () => db.entries.where('exerciseId').anyOf(ids).filter((e) => e.date < date && !e.warmup).toArray(),
    [ids.join(','), date],
  );

  const work = useMemo(() => entries.filter((e) => !e.warmup), [entries]);
  const groups = useMemo(() => workingSets(work, exById), [work, exById]);
  const targets = useMemo(() => {
    const p = new Set<Muscle>();
    const s = new Set<Muscle>();
    for (const g of groups) {
      const tg = g.ex.key ? MUSCLES[g.ex.key] : undefined;
      tg?.p.forEach((m) => p.add(m));
      tg?.s.forEach((m) => s.add(m));
    }
    p.forEach((m) => s.delete(m));
    return { p: [...p], s: [...s] };
  }, [groups]);
  const paint = useCallback((m: Muscle): Cls => (targets.p.includes(m) ? 'm1' : targets.s.includes(m) ? 'm2' : 'mu'), [targets]);

  if (!exercises || !prior) return null;

  const times = entries.map((e) => e.createdAt);
  const minutes = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0;
  const sets = groups.reduce((s, g) => s + g.n, 0);
  let reps = 0;
  let volume = 0;
  for (const e of work) {
    const ex = exById.get(e.exerciseId);
    if (ex?.type !== 'strength') continue;
    reps += e.reps ?? 0;
    if (!ex.assisted && e.weight) volume += e.weight * (e.reps ?? 0);
  }

  const records: Record_[] = [];
  const firsts: Exercise[] = [];
  const compare: { ex: Exercise; before: string; now: string; dir: 'up' | 'down' | 'same' }[] = [];
  for (const id of ids) {
    const ex = exById.get(id);
    const today = work.filter((e) => e.exerciseId === id);
    if (!ex || !today.length || ex.type === 'cardio') continue;
    const past = prior.filter((e) => e.exerciseId === id);
    if (!past.length) { firsts.push(ex); continue; }
    const max = (es: Entry[], f: (e: Entry) => number) => Math.max(...es.map(f));
    const kg = (v: number) => `${fmtNum(v, 2)} kg`;
    if (ex.type === 'hold') {
      if (max(today, (e) => e.seconds ?? 0) > max(past, (e) => e.seconds ?? 0)) records.push({ ex, label: t.recLongest, value: `${max(today, (e) => e.seconds ?? 0)} s` });
    } else if (ex.type === 'carry') {
      if (max(today, (e) => e.weight ?? 0) > max(past, (e) => e.weight ?? 0)) records.push({ ex, label: t.recHeaviest, value: kg(max(today, (e) => e.weight ?? 0)) });
      else if (max(today, (e) => e.meters ?? 0) > max(past, (e) => e.meters ?? 0)) records.push({ ex, label: t.recFarthest, value: `${max(today, (e) => e.meters ?? 0)} m` });
    } else if (ex.assisted) {
      const least = (es: Entry[]) => Math.min(...es.map((e) => e.weight ?? 0));
      if (least(today) < least(past)) records.push({ ex, label: t.leastAssist, value: kg(least(today)) });
    } else if (!today.some((e) => e.weight) && !past.some((e) => e.weight)) {
      if (max(today, (e) => e.reps ?? 0) > max(past, (e) => e.reps ?? 0)) records.push({ ex, label: t.maxReps, value: `${max(today, (e) => e.reps ?? 0)}` });
    } else {
      const top = max(today, (e) => e.weight ?? 0);
      const est = (es: Entry[]) => max(es.filter((e) => (e.reps ?? 0) <= 12), (e) => e1rm(e.weight ?? 0, e.reps ?? 0));
      if (top > max(past, (e) => e.weight ?? 0)) records.push({ ex, label: t.recHeaviest, value: kg(top) });
      else if (est(today) > est(past) && est(today) > 0) records.push({ ex, label: `${t.recE1rm} (${t.estimate})`, value: kg(Math.round(est(today) * 2) / 2) });
      else {
        // Most reps with a weight you've used before.
        for (const w of [...new Set(today.map((e) => e.weight ?? 0))].sort((a, b) => b - a)) {
          const before = past.filter((e) => (e.weight ?? 0) === w);
          if (w && before.length && max(today.filter((e) => (e.weight ?? 0) === w), (e) => e.reps ?? 0) > max(before, (e) => e.reps ?? 0)) {
            records.push({ ex, label: fill(t.recMostReps, { w: kg(w) }), value: `${max(today.filter((e) => (e.weight ?? 0) === w), (e) => e.reps ?? 0)}` });
            break;
          }
        }
      }
    }
    const lastDate = past.reduce((d, e) => (e.date > d ? e.date : d), '');
    const prev = bestEntry(past.filter((e) => e.date === lastDate), ex);
    const now = bestEntry(today, ex);
    const b = describe(prev, ex);
    const n = describe(now, ex);
    compare.push({ ex, before: b, now: n, dir: b === n ? 'same' : bestEntry([prev, now], ex) === now ? 'up' : 'down' });
  }

  return (
    <div className="summary">
      <div className="stats">
        {minutes > 0 && <div className="stat"><strong>{minutes} min</strong><span>{t.duration}</span></div>}
        <div className="stat"><strong>{ids.length}</strong><span>{t.exercisesUsed}</span></div>
        <div className="stat"><strong>{sets}</strong><span>{t.workingSets}</span></div>
        {reps > 0 && <div className="stat"><strong>{reps}</strong><span>{t.totalReps}</span></div>}
        {volume > 0 && <div className="stat"><strong>{fmtNum(volume, 0)} kg</strong><span>{t.volumeLifted}</span></div>}
      </div>
      {volume > 0 && <p className="hint small-print">{t.volumeHint}</p>}

      <section className="card">
        <h2>{t.newRecords}</h2>
        {records.length ? (
          <ul className="records">
            {records.map((r, i) => (
              <li key={i}><span>🏆 {exName(r.ex)}</span><strong>{r.value}</strong><span className="muted">{r.label}</span></li>
            ))}
          </ul>
        ) : <p className="hint">{t.noNewRecords}</p>}
        {firsts.length > 0 && <p className="hint small-print">{t.firstTime}: {firsts.map(exName).join(', ')}</p>}
      </section>

      {compare.length > 0 && (
        <section className="card">
          <h2>{t.vsLast}</h2>
          <ul className="records">
            {compare.map((c) => (
              <li key={c.ex.id}>
                <span>{exName(c.ex)}</span>
                <strong className={`cmp-${c.dir}`}>{c.dir === 'up' ? '↑' : c.dir === 'down' ? '↓' : '='} {c.now}</strong>
                <span className="muted">{c.before} → {c.now}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(targets.p.length > 0 || targets.s.length > 0) && (
        <section className="card">
          <h2>{t.musclesTrained}</h2>
          <MuscleMap paint={paint} small />
          <MuscleChips targets={{ p: targets.p.filter((m) => m !== 'cardio'), s: targets.s.filter((m) => m !== 'cardio') }} />
        </section>
      )}
    </div>
  );
}
