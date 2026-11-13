import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayISO, type Entry, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlanPicker } from '../components/PlanPicker';
import { useExerciseFormat } from '../exerciseFormat';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { SetInputs, SetList, setCount, useSetLogger } from '../components/SetLogger';
import { FocusView } from './FocusView';
import { GeneratorView } from './GeneratorView';
import { getDefaultRest, useTimer } from '../timer';
import { recommendedRest } from '../rest';

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function WorkoutView({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { t, lt, fmtDate } = useI18n();
  const { target } = useExerciseFormat();
  const [picking, setPicking] = useState<'exercise' | 'plan' | null>(null);
  // Exercises opened for this day that have no entries yet.
  const [pending, setPending] = useState<number[]>([]);
  const [focus, setFocus] = useState(false);
  const [building, setBuilding] = useState(false);

  useEffect(() => setPending([]), [date]);

  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const day = useLiveQuery(() => db.days.get(date), [date]);
  const plan = useLiveQuery(async () => (day?.planId ? db.plans.get(day.planId) : undefined), [day?.planId]);
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);
  const exByKey = useMemo(() => new Map(exercises?.filter((e) => e.key).map((e) => [e.key!, e])), [exercises]);
  const exOf = (it: PlanItem) => (it.ex ? exByKey.get(it.ex) : it.exId ? exById.get(it.exId) : undefined);

  const planExIds = new Set(
    plan?.sections.flatMap((s) => s.items.map((it) => exOf(it)?.id)).filter(Boolean),
  );
  const order: number[] = [];
  entries?.forEach((e) => { if (!order.includes(e.exerciseId)) order.push(e.exerciseId); });
  pending.forEach((id) => { if (!order.includes(id)) order.push(id); });
  const others = order.filter((id) => !planExIds.has(id));

  const isToday = date === todayISO();
  const entriesFor = (id: number) => entries?.filter((e) => e.exerciseId === id) ?? [];

  const toggleDone = async (id: string) => {
    const done = new Set(day?.done ?? []);
    if (done.has(id)) done.delete(id); else done.add(id);
    await db.days.put({ ...(day ?? { date }), done: [...done] });
  };

  const attachPlan = async (planId: number) => {
    await db.days.put({ ...(day ?? { date }), planId });
    setPicking(null);
    setFocus(true);
  };

  const detachPlan = async () => {
    if (confirm(t.removePlan)) await db.days.put({ ...(day ?? { date }), planId: undefined, done: [] });
  };

  // Rest after a set: the plan's rest, nothing mid-superset, the default otherwise.
  const card = (ex: Exercise, item?: PlanItem, midSuperset = false) => (
    <ExerciseCard
      key={ex.id}
      exercise={ex}
      date={date}
      entries={entriesFor(ex.id!)}
      item={item}
      rest={midSuperset ? 0 : item ? item.rest ?? 0 : ex.type === 'cardio' ? 0 : getDefaultRest() < 0 ? recommendedRest(ex).set : getDefaultRest()}
      targetText={item ? target(item) : undefined}
      onClose={item ? undefined : () => setPending((p) => p.filter((x) => x !== ex.id))}
    />
  );

  return (
    <div className="view">
      <div className="date-bar">
        <button className="icon-btn" aria-label="previous day" onClick={() => setDate(shiftDate(date, -1))}>‹</button>
        <label className="date-label">
          <span>{isToday ? t.today : fmtDate(date, { weekday: 'long' })}</span>
          <strong>{fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="icon-btn" aria-label="next day" disabled={isToday} onClick={() => setDate(shiftDate(date, 1))}>›</button>
      </div>
      {!isToday && (
        <button className="link-btn center" onClick={() => setDate(todayISO())}>{t.today}</button>
      )}

      {plan && (
        <>
          <div className="plan-head">
            <h2>{lt(plan.name)}</h2>
            <button className="icon-btn small" aria-label={t.removePlan} onClick={detachPlan}>×</button>
          </div>
          <button className="primary wide start-btn" onClick={() => setFocus(true)}>
            ▶ {entries?.length ? t.continueWorkout : t.startWorkout}
          </button>
          {plan.sections.map((sec, si) => {
            // Group consecutive superset items together.
            const blocks: ReactNode[] = [];
            for (let i = 0; i < sec.items.length; i++) {
              const it = sec.items[i];
              if (it.text) {
                const id = `${si}-${i}`;
                const on = day?.done?.includes(id);
                blocks.push(
                  <label key={id} className={on ? 'check on' : 'check'}>
                    <input type="checkbox" checked={!!on} onChange={() => toggleDone(id)} />
                    <span>{lt(it.text)}</span>
                  </label>,
                );
                continue;
              }
              if (it.superset) {
                const group: ReactNode[] = [];
                let j = i;
                while (j < sec.items.length && sec.items[j].superset === it.superset) {
                  const ex = exOf(sec.items[j]);
                  const last = sec.items[j + 1]?.superset !== it.superset;
                  if (ex) group.push(card(ex, sec.items[j], !last));
                  j++;
                }
                blocks.push(
                  <div key={`ss-${si}-${i}`} className="superset">
                    <span className="superset-label">{t.superset}</span>
                    {group}
                  </div>,
                );
                i = j - 1;
                continue;
              }
              const ex = exOf(it);
              if (ex) blocks.push(card(ex, it));
            }
            return (
              <section key={si} className="plan-section">
                <h3 className="group-title">{lt(sec.title)}</h3>
                {sec.note && <p className="hint">{lt(sec.note)}</p>}
                {blocks}
              </section>
            );
          })}
          {others.length > 0 && <h3 className="group-title">{t.otherExercises}</h3>}
        </>
      )}

      {entries && !plan && order.length === 0 && <p className="empty">{t.emptyDay}</p>}

      {others.map((id) => {
        const ex = exById.get(id);
        return ex ? card(ex) : null;
      })}

      {!plan && <button className="primary wide start-btn" onClick={() => setBuilding(true)}>✨ {t.buildWorkout}</button>}
      <div className="row-actions">
        {!plan && <button className="ghost" onClick={() => setPicking('plan')}>{t.startPlan}</button>}
        <button className="primary" onClick={() => setPicking('exercise')}>+ {t.addExercise}</button>
      </div>

      {plan?.notes?.length ? (
        <section className="card notes">
          <h2>{t.notes}</h2>
          <ul>{plan.notes.map((n, i) => <li key={i}>{lt(n)}</li>)}</ul>
        </section>
      ) : null}

      {picking === 'exercise' && (
        <ExercisePicker
          onPick={(id) => { setPending((p) => [...p, id]); setPicking(null); }}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === 'plan' && <PlanPicker onPick={attachPlan} onClose={() => setPicking(null)} />}
      {building && <GeneratorView date={date} onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); setFocus(true); }} />}
      {focus && plan && (
        <FocusView
          plan={plan}
          date={date}
          day={day}
          entries={entries ?? []}
          exOf={exOf}
          onClose={() => setFocus(false)}
          onToggle={toggleDone}
        />
      )}
    </div>
  );
}

function ExerciseCard({ exercise, date, entries, item, rest, targetText, onClose }: {
  exercise: Exercise;
  date: string;
  entries: Entry[];
  item?: PlanItem;
  rest: number;
  targetText?: string;
  onClose?: () => void;
}) {
  const { t, exName, fmtDate } = useI18n();
  const { describe } = useExerciseFormat();
  const { startRest } = useTimer();
  const [info, setInfo] = useState(false);

  const logger = useSetLogger(exercise, date, entries, item, () => {
    const isLastSet = item?.sets != null && setCount(entries, exercise) + 1 >= item.sets;
    if (rest > 0 && !isLastSet) startRest(rest);
  });
  const { previous } = logger;
  const n = setCount(entries, exercise);
  const done = item?.sets != null && n >= item.sets;

  return (
    <section className={done ? 'card card-done' : 'card'}>
      <header className="card-head">
        <h2>{exName(exercise)}</h2>
        <button className="info-btn" aria-label={t.aboutExercise} onClick={() => setInfo(true)}>i</button>
        {item?.sets != null && <span className="set-count">{n}/{item.sets}</span>}
        {onClose && entries.length === 0 && <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>}
      </header>
      {targetText && <p className="target">{targetText}</p>}
      {previous && previous.length > 0 && (
        <p className="hint">
          {t.lastTime} ({fmtDate(previous[0].date)}): {previous.map((e) => describe(e, exercise)).join(', ')}
        </p>
      )}
      <SetList exercise={exercise} entries={entries} />
      <SetInputs exercise={exercise} logger={logger} item={item} />
      {info && <ExerciseInfo exercise={exercise} planRest={item?.rest} onClose={() => setInfo(false)} />}
    </section>
  );
}
