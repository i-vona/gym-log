import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, e1rm, type Entry } from '../db';
import { useI18n } from '../i18n';
import { useExerciseFormat } from '../exerciseFormat';
import { Chart, type Point } from '../components/Chart';

type Metric = 'topWeight' | 'est1rm' | 'volume' | 'maxReps' | 'distance' | 'time' | 'pace'
  | 'longestHold' | 'carryDistance' | 'assistance';

function fmtPace(minPerKm: number) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

const sum = (es: Entry[], f: (e: Entry) => number) => es.reduce((s, e) => s + f(e), 0);
const maxBy = (es: Entry[], f: (e: Entry) => number) => es.reduce((b, e) => (f(e) > f(b) ? e : b));

export function ProgressView() {
  const { t, exName, fmtDate, fmtNum } = useI18n();
  const { describe } = useExerciseFormat();
  const entries = useLiveQuery(() => db.entries.orderBy('date').toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());

  // Exercises with data, most recently logged first.
  const logged = useMemo(() => {
    if (!entries || !exercises) return [];
    const last = new Map<number, string>();
    entries.forEach((e) => last.set(e.exerciseId, e.date));
    return exercises.filter((e) => last.has(e.id!)).sort((a, b) => last.get(b.id!)!.localeCompare(last.get(a.id!)!));
  }, [entries, exercises]);

  const [exId, setExId] = useState<number | null>(null);
  const ex = logged.find((e) => e.id === exId) ?? logged[0];

  const days = useMemo(() => {
    const m = new Map<string, Entry[]>();
    entries?.filter((e) => e.exerciseId === ex?.id).forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]));
    return [...m.entries()];
  }, [entries, ex?.id]);

  const bodyweightOnly = ex?.type === 'strength' && !ex.assisted && days.every(([, es]) => es.every((e) => !e.weight));
  const metrics: Metric[] =
    ex?.type === 'cardio' ? ['distance', 'time', 'pace']
    : ex?.type === 'hold' ? ['longestHold']
    : ex?.type === 'carry' ? ['topWeight', 'carryDistance']
    : ex?.assisted ? ['assistance', 'maxReps']
    : bodyweightOnly ? ['maxReps', 'volume']
    : ['topWeight', 'est1rm', 'volume', 'maxReps'];
  const [metric, setMetric] = useState<Metric>('topWeight');
  useEffect(() => setMetric(metrics[0]), [ex?.id, bodyweightOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = metrics.includes(metric) ? metric : metrics[0];

  if (!entries || !exercises) return null;
  if (!ex) return <div className="view"><p className="empty">{t.noExercisesLogged}</p></div>;

  const value = (es: Entry[]): number | null => {
    switch (m) {
      case 'topWeight': return Math.max(...es.map((e) => e.weight ?? 0));
      case 'assistance': return Math.min(...es.map((e) => e.weight ?? 0));
      case 'est1rm': return Math.max(...es.map((e) => e1rm(e.weight ?? 0, e.reps ?? 0)));
      case 'volume': return bodyweightOnly ? sum(es, (e) => e.reps ?? 0) : sum(es, (e) => (e.weight ?? 0) * (e.reps ?? 0));
      case 'maxReps': return Math.max(...es.map((e) => e.reps ?? 0));
      case 'longestHold': return Math.max(...es.map((e) => e.seconds ?? 0));
      case 'carryDistance': return Math.max(...es.map((e) => e.meters ?? 0));
      case 'distance': return sum(es, (e) => e.distance ?? 0) || null;
      case 'time': return sum(es, (e) => e.minutes ?? 0) || null;
      case 'pace': {
        const both = es.filter((e) => e.minutes && e.distance);
        const km = sum(both, (e) => e.distance!);
        return km ? sum(both, (e) => e.minutes!) / km : null;
      }
    }
  };

  const points: Point[] = days
    .map(([date, es]) => ({ date, value: value(es) }))
    .filter((p): p is Point => p.value != null);

  const format = (v: number) => {
    switch (m) {
      case 'pace': return `${fmtPace(v)}/km`;
      case 'time': return `${fmtNum(v, 0)} min`;
      case 'distance': return `${fmtNum(v, 1)} km`;
      case 'longestHold': return `${fmtNum(v, 0)} s`;
      case 'carryDistance': return `${fmtNum(v, 0)} m`;
      case 'maxReps': return fmtNum(v, 0);
      case 'volume': return bodyweightOnly ? fmtNum(v, 0) : `${fmtNum(v, 0)} kg`;
      default: return `${fmtNum(v, 1)} kg`;
    }
  };

  // Personal records across all entries.
  const all = days.flatMap(([, es]) => es);
  const records: [string, string, string][] = [];
  const rec = (label: string, e: Entry) => records.push([label, describe(e, ex), e.date]);
  if (ex.type === 'cardio') {
    const dayTotals = days.map(([date, es]) => ({
      date, km: sum(es, (e) => e.distance ?? 0), min: sum(es, (e) => e.minutes ?? 0),
    }));
    const longest = dayTotals.reduce((b, d) => (d.km > b.km ? d : b));
    const longestT = dayTotals.reduce((b, d) => (d.min > b.min ? d : b));
    const paced = all.filter((e) => e.minutes && e.distance);
    if (longest.km) records.push([t.distance, `${fmtNum(longest.km, 2)} km`, longest.date]);
    if (longestT.min) records.push([t.time, `${fmtNum(longestT.min, 0)} min`, longestT.date]);
    if (paced.length) {
      const bp = maxBy(paced, (e) => -e.minutes! / e.distance!);
      records.push([t.pace, `${fmtPace(bp.minutes! / bp.distance!)}/km`, bp.date]);
    }
  } else if (ex.type === 'hold') {
    rec(t.longestHold, maxBy(all, (e) => e.seconds ?? 0));
  } else if (ex.type === 'carry') {
    rec(t.topWeight, maxBy(all, (e) => (e.weight ?? 0) * 1e4 + (e.meters ?? 0)));
    rec(t.carryDistance, maxBy(all, (e) => (e.meters ?? 0) * 1e4 + (e.weight ?? 0)));
  } else if (ex.assisted) {
    rec(t.leastAssist, maxBy(all, (e) => -(e.weight ?? 0) * 1e4 + (e.reps ?? 0)));
    rec(t.maxReps, maxBy(all, (e) => (e.reps ?? 0) * 1e4 - (e.weight ?? 0)));
  } else {
    if (!bodyweightOnly) {
      rec(t.topWeight, maxBy(all, (e) => (e.weight ?? 0) * 1e4 + (e.reps ?? 0)));
      const best1 = maxBy(all, (e) => e1rm(e.weight ?? 0, e.reps ?? 0));
      records.push([t.est1rm, `${fmtNum(e1rm(best1.weight ?? 0, best1.reps ?? 0), 1)} kg`, best1.date]);
    }
    rec(t.maxReps, maxBy(all, (e) => (e.reps ?? 0) * 1e4 + (e.weight ?? 0)));
  }

  return (
    <div className="view">
      <label className="field">
        <span>{t.exercise}</span>
        <select value={ex.id} onChange={(e) => setExId(Number(e.target.value))}>
          {logged.map((e) => <option key={e.id} value={e.id}>{exName(e)}</option>)}
        </select>
      </label>

      {metrics.length > 1 && (
        <div className="seg">
          {metrics.map((k) => (
            <button key={k} className={m === k ? 'on' : ''} onClick={() => setMetric(k)}>{t[k]}</button>
          ))}
        </div>
      )}

      <section className="card">
        {points.length >= 2
          ? <Chart points={points} format={format} fmtDate={(d) => fmtDate(d, { day: 'numeric', month: 'short' })} invert={m === 'pace' || m === 'assistance'} />
          : <p className="empty">{t.noData}</p>}
      </section>

      <section className="card">
        <h2>{t.records}</h2>
        <ul className="records">
          {records.map(([label, val, date]) => (
            <li key={label}><span>{label}</span><strong>{val}</strong><span className="muted">{fmtDate(date)}</span></li>
          ))}
          <li><span>{t.sessions}</span><strong>{days.length}</strong><span /></li>
        </ul>
      </section>
    </div>
  );
}
