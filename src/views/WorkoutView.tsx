import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, parseNum, todayISO, type Entry, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlanPicker } from '../components/PlanPicker';
import { FIELDS, planDefault, useExerciseFormat, type Field } from '../exerciseFormat';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { fmtClock, getDefaultRest, useTimer } from '../timer';
import { beep, finishedSignal, keepAwake, unlockAudio } from '../sound';

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

  useEffect(() => setPending([]), [date]);

  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const day = useLiveQuery(() => db.days.get(date), [date]);
  const plan = useLiveQuery(async () => (day?.planId ? db.plans.get(day.planId) : undefined), [day?.planId]);
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);
  const exByKey = useMemo(() => new Map(exercises?.filter((e) => e.key).map((e) => [e.key!, e])), [exercises]);

  const planExIds = new Set(
    plan?.sections.flatMap((s) => s.items.map((it) => (it.ex ? exByKey.get(it.ex)?.id : undefined))).filter(Boolean),
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
      rest={midSuperset ? 0 : item ? item.rest ?? 0 : ex.type === 'cardio' ? 0 : getDefaultRest()}
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
                  const ex = exByKey.get(sec.items[j].ex!);
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
              const ex = it.ex ? exByKey.get(it.ex) : undefined;
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
  const { fieldLabel, describe } = useExerciseFormat();
  const { startRest } = useTimer();
  const [info, setInfo] = useState(false);
  const { fields, required } = FIELDS[exercise.type];
  const [fa, fb] = fields;
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  // Most recent entries for this exercise on an earlier day, to show "last time" and prefill.
  const previous = useLiveQuery(async () => {
    const prior = await db.entries
      .where('[exerciseId+date]')
      .between([exercise.id!, Dexie.minKey], [exercise.id!, date], true, false)
      .toArray();
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    return prior.filter((e) => e.date === lastDate);
  }, [exercise.id, date]);

  // Prefill: last set today → first set last time → plan target.
  const source = entries[entries.length - 1] ?? previous?.[0];
  const str = (v: number | undefined) => (v != null ? String(v) : '');
  useEffect(() => {
    if (source) {
      setA(str(source[fa]));
      setB(str(source[fb]));
    } else if (previous === null && item) {
      setB(planDefault(item));
    }
  }, [source?.id, previous === null, exercise.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const va = parseNum(a);
  const vb = parseNum(b);
  const vals: Partial<Record<Field, number | undefined>> = { [fa]: va, [fb]: vb };
  const canAdd = required.length ? required.every((f) => vals[f] != null) : va != null || vb != null;

  const add = async (override?: Partial<Record<Field, number | undefined>>) => {
    const v0 = { ...vals, ...override };
    const ok = required.length ? required.every((f) => v0[f] != null) : v0[fa] != null || v0[fb] != null;
    if (!ok) return;
    unlockAudio();
    const rec: Entry = { date, exerciseId: exercise.id!, createdAt: Date.now() };
    for (const f of fields) {
      let v = v0[f];
      if (f === 'weight') v = v ?? 0;
      if (f === 'reps' && v != null) v = Math.round(v);
      if (v != null) rec[f] = v;
    }
    await db.entries.add(rec);
    const isLastSet = item?.sets != null && entries.length + 1 >= item.sets;
    if (rest > 0 && !isLastSet) startRest(rest);
  };

  const remove = async (id: number) => {
    if (confirm(t.confirmDelete)) await db.entries.delete(id);
  };

  const done = item?.sets != null && entries.length >= item.sets;

  return (
    <section className={done ? 'card card-done' : 'card'}>
      <header className="card-head">
        <h2>{exName(exercise)}</h2>
        <button className="info-btn" aria-label={t.howTo} onClick={() => setInfo(true)}>?</button>
        {item?.sets != null && <span className="set-count">{entries.length}/{item.sets}</span>}
        {onClose && entries.length === 0 && <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>}
      </header>
      {targetText && <p className="target">{targetText}</p>}
      {previous && previous.length > 0 && (
        <p className="hint">
          {t.lastTime} ({fmtDate(previous[0].date)}): {previous.map((e) => describe(e, exercise)).join(', ')}
        </p>
      )}
      {entries.length > 0 && (
        <ol className="sets">
          {entries.map((e, i) => (
            <li key={e.id}>
              <span className="set-no">{i + 1}</span>
              <span className="set-val">{describe(e, exercise)}</span>
              <button className="icon-btn small" aria-label={t.delete} onClick={() => remove(e.id!)}>×</button>
            </li>
          ))}
        </ol>
      )}
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label>
          <span>{fieldLabel(fa, exercise)}</span>
          <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <label>
          <span>{fieldLabel(fb, exercise)}</span>
          <input inputMode={fb === 'reps' ? 'numeric' : 'decimal'} value={b} onChange={(e) => setB(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <button className="primary" disabled={!canAdd}>{t.add}</button>
      </form>
      {exercise.type === 'hold' && (
        <HoldTimer target={parseNum(planDefault(item) || b) ?? 0} onDone={(sec) => add({ seconds: sec })} />
      )}
      {info && <ExerciseInfo exercise={exercise} onClose={() => setInfo(false)} />}
    </section>
  );
}

/** Stopwatch for timed holds: 3 s to get in position, then counts up; beeps at the target. */
function HoldTimer({ target, onDone }: { target: number; onDone: (seconds: number) => void }) {
  const { t } = useI18n();
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startAt]);

  const elapsed = startAt == null ? 0 : (now - startAt) / 1000; // negative while getting ready
  const sec = Math.floor(elapsed);
  useEffect(() => {
    if (startAt == null) return;
    if (sec < 0) beep(660, 90);
    else if (sec === 0) beep(1320, 200);
    else if (target > 0 && sec === target) finishedSignal();
  }, [sec]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    unlockAudio();
    void keepAwake(true);
    setNow(Date.now());
    setStartAt(Date.now() + 3000);
  };
  const stop = () => {
    const s = Math.max(0, Math.round(elapsed));
    setStartAt(null);
    void keepAwake(false);
    if (s > 0) onDone(s);
  };

  if (startAt == null) {
    return <button className="ghost wide hold-btn" onClick={start}>⏱ {t.holdStart}{target ? ` (${target} s)` : ''}</button>;
  }
  return (
    <button className={elapsed < 0 ? 'hold-run ready' : target && elapsed >= target ? 'hold-run reached' : 'hold-run'} onClick={stop}>
      <span>{elapsed < 0 ? t.getReady : t.holdStop}</span>
      <strong>{elapsed < 0 ? Math.ceil(-elapsed) : fmtClock(elapsed)}</strong>
    </button>
  );
}
