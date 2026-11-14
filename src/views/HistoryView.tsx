import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Entry } from '../db';
import { useI18n } from '../i18n';
import { bestEntry, useExerciseFormat } from '../exerciseFormat';
import { setCount } from '../components/SetLogger';

function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export function HistoryView({ openDay }: { openDay: (date: string) => void }) {
  const { t, exName, fmtDate, fmtNum } = useI18n();
  const { describe } = useExerciseFormat();
  const entries = useLiveQuery(() => db.entries.orderBy('date').reverse().toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);

  const days = useMemo(() => {
    const m = new Map<string, Entry[]>();
    entries?.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]));
    return [...m.entries()];
  }, [entries]);

  if (!entries) return null;
  if (!days.length) return <div className="view"><p className="empty">{t.historyEmpty}</p></div>;

  const ws = weekStart(new Date()).getTime();
  const thisWeek = days.filter(([d]) => new Date(d + 'T12:00:00').getTime() >= ws).length;

  return (
    <div className="view">
      <div className="stats">
        <div className="stat"><strong>{days.length}</strong><span>{t.workouts}</span></div>
        <div className="stat"><strong>{thisWeek}</strong><span>{t.thisWeek}</span></div>
      </div>
      {days.map(([date, list]) => {
        const byEx = new Map<number, Entry[]>();
        [...list].sort((a, b) => a.createdAt - b.createdAt)
          .forEach((e) => byEx.set(e.exerciseId, [...(byEx.get(e.exerciseId) ?? []), e]));
        return (
          <button key={date} className="card day-card" onClick={() => openDay(date)}>
            <h2>{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <ul>
              {[...byEx.entries()].map(([id, es]) => {
                const ex = exById.get(id);
                let summary: string;
                if (ex?.type === 'cardio') {
                  const min = es.reduce((s, e) => s + (e.minutes ?? 0), 0);
                  const km = es.reduce((s, e) => s + (e.distance ?? 0), 0);
                  summary = [min && `${fmtNum(min)} min`, km && `${fmtNum(km, 2)} km`].filter(Boolean).join(' · ');
                } else {
                  summary = `${t.sets}: ${ex ? setCount(es, ex) : es.length} · ${t.best} ${describe(bestEntry(es.some((e) => !e.warmup) ? es.filter((e) => !e.warmup) : es, ex), ex)}`;
                }
                return (
                  <li key={id}><span>{exName(ex)}</span><span className="muted">{summary}</span></li>
                );
              })}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
