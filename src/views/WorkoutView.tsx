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
import { applySwaps, type SwappedItem } from '../swap';
import { SwapSheet } from '../components/SwapSheet';
import { WorkoutSummary } from '../components/WorkoutSummary';
import { ExerciseLibrary } from '../components/ExerciseLibrary';
import { getSchedule, weekdayIndex, type Schedule } from '../schedule';
import { useBackClose } from '../useBack';
import { iso, weekStart } from '../analytics';

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
  const [summary, setSummary] = useState(false);
  const [library, setLibrary] = useState(false);
  /** Exercise being swapped: a plan item (loc = "section-item") or an added exercise. */
  const [swapping, setSwapping] = useState<{ ex: Exercise; loc?: string; original?: Exercise } | null>(null);

  useEffect(() => setPending([]), [date]);

  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const day = useLiveQuery(() => db.days.get(date), [date]);
  const rawPlan = useLiveQuery(async () => (day?.planId ? db.plans.get(day.planId) : undefined), [day?.planId]);
  const plan = useMemo(() => (rawPlan ? applySwaps(rawPlan, day?.swaps) : undefined), [rawPlan, day?.swaps]);
  const schedule = useLiveQuery(getSchedule);
  const scheduledPlan = useLiveQuery(async () => {
    const id = schedule?.[weekdayIndex(date)];
    return id ? db.plans.get(id) : undefined;
  }, [schedule, date]);
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);
  const exByKey = useMemo(() => new Map(exercises?.filter((e) => e.key).map((e) => [e.key!, e])), [exercises]);
  const exOf = (it: PlanItem) => (it.ex ? exByKey.get(it.ex) : it.exId ? exById.get(it.exId) : undefined);

  /** Use another exercise for a plan item today (or undo that with null). */
  const setSwap = async (loc: string, ex: Exercise | null) => {
    const swaps = { ...(day?.swaps ?? {}) };
    if (ex) swaps[loc] = ex.key ? { ex: ex.key } : { exId: ex.id };
    else delete swaps[loc];
    await db.days.put({ ...(day ?? { date }), swaps });
  };
  const pickSwap = async (ex: Exercise | null) => {
    if (!swapping) return;
    if (swapping.loc) await setSwap(swapping.loc, ex);
    else if (ex) setPending((p) => p.map((x) => (x === swapping.ex.id ? ex.id! : x)));
    setSwapping(null);
  };

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
  const card = (ex: Exercise, item?: PlanItem, midSuperset = false, loc?: string) => {
    const from = (item as SwappedItem | undefined)?.from;
    const original = from ? exOf(from) : undefined;
    const fresh = entriesFor(ex.id!).length === 0;
    return (
      <ExerciseCard
        key={loc ?? ex.id}
        exercise={ex}
        date={date}
        entries={entriesFor(ex.id!)}
        item={item}
        rest={midSuperset ? 0 : item ? item.rest ?? 0 : ex.type === 'cardio' ? 0 : getDefaultRest() < 0 ? recommendedRest(ex).set : getDefaultRest()}
        targetText={item ? target(item) : undefined}
        onClose={item ? undefined : () => setPending((p) => p.filter((x) => x !== ex.id))}
        original={original}
        onSwap={(loc || fresh) && ex.key ? () => setSwapping({ ex, loc, original }) : undefined}
      />
    );
  };

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
      <WeekStrip date={date} setDate={setDate} schedule={schedule} />

      {!plan && scheduledPlan && (
        <section className="card planned">
          <span className="muscles-label">{t.plannedToday}</span>
          <h2>{lt(scheduledPlan.name)}</h2>
          <button className="primary wide" onClick={() => attachPlan(scheduledPlan.id!)}>▶ {t.startThisPlan}</button>
        </section>
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
                  if (ex) group.push(card(ex, sec.items[j], !last, `${si}-${j}`));
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
              if (ex) blocks.push(card(ex, it, false, `${si}-${i}`));
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

      {!plan && <button className={scheduledPlan ? 'ghost wide start-btn' : 'primary wide start-btn'} onClick={() => setBuilding(true)}>✨ {t.buildWorkout}</button>}
      <div className="row-actions">
        {!plan && <button className="ghost" onClick={() => setPicking('plan')}>{t.startPlan}</button>}
        <button className="primary" onClick={() => setPicking('exercise')}>+ {t.addExercise}</button>
      </div>
      {entries && entries.length > 0 && (
        <button className="ghost wide" onClick={() => setSummary(true)}>✓ {t.finishWorkout}</button>
      )}
      <button className="link-btn center" onClick={() => setLibrary(true)}>{t.library} ›</button>

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
      {swapping && (
        <SwapSheet
          exercise={swapping.ex}
          original={swapping.original}
          onPick={(ex) => void pickSwap(ex)}
          onRestore={swapping.original ? () => void pickSwap(null) : undefined}
          onClose={() => setSwapping(null)}
        />
      )}
      {summary && entries && <SummaryPage date={date} entries={entries} onClose={() => setSummary(false)} />}
      {library && <ExerciseLibrary onClose={() => setLibrary(false)} />}
      {focus && plan && (
        <FocusView
          plan={plan}
          date={date}
          day={day}
          entries={entries ?? []}
          exOf={exOf}
          onClose={() => setFocus(false)}
          onToggle={toggleDone}
          onSwap={(loc, ex, original) => setSwapping({ ex, loc, original })}
        />
      )}
    </div>
  );
}

function ExerciseCard({ exercise, date, entries, item, rest, targetText, onClose, onSwap, original }: {
  exercise: Exercise;
  date: string;
  entries: Entry[];
  item?: PlanItem;
  rest: number;
  targetText?: string;
  onClose?: () => void;
  onSwap?: () => void;
  /** The exercise this one replaces today. */
  original?: Exercise;
}) {
  const { t, exName, fmtDate, fill } = useI18n();
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
      {original && <p className="swapped-note">⇄ {fill(t.insteadOf, { x: exName(original) })}</p>}
      {onSwap && !done && <button className="swap-link" onClick={onSwap}>⇄ {t.equipBusy}</button>}
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

/** Full-page summary of a day's workout. */
function SummaryPage({ date, entries, onClose }: { date: string; entries: Entry[]; onClose: () => void }) {
  const { t, fmtDate } = useI18n();
  useBackClose(onClose);
  return (
    <div className="page" role="dialog" aria-label={t.summary}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={() => history.back()}>‹</button>
        <h1>{t.summary}</h1>
      </header>
      <main className="page-body">
        <p className="hint">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <WorkoutSummary date={date} entries={entries} />
        <button className="primary wide" onClick={() => history.back()}>{t.done}</button>
      </main>
    </div>
  );
}

type DayStatus = 'done' | 'missed' | 'planned' | 'rest' | 'future';

/** Monday–Sunday of the selected week: trained, missed (planned but nothing logged), planned, rest. */
function WeekStrip({ date, setDate, schedule }: { date: string; setDate: (d: string) => void; schedule: Schedule | undefined }) {
  const { t, fmtDate } = useI18n();
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = weekStart(new Date(date + 'T12:00:00'));
    d.setDate(d.getDate() + i);
    return iso(d);
  });
  const info = useLiveQuery(async () => {
    const logged = new Set((await db.entries.where('date').between(days[0], days[6], true, true).toArray()).map((e) => e.date));
    const attached = new Map((await db.days.where('date').between(days[0], days[6], true, true).toArray()).map((d) => [d.date, d.planId]));
    return { logged, attached };
  }, [days[0]]);
  if (!info) return <div className="week-strip" />;
  const status = (d: string): DayStatus => {
    if (info.logged.has(d)) return 'done';
    const planned = info.attached.get(d) != null || schedule?.[weekdayIndex(d)] != null;
    if (d > today) return planned ? 'planned' : 'future';
    if (planned) return d === today ? 'planned' : 'missed';
    return 'rest';
  };
  return (
    <div className="week-strip">
      {days.map((d) => {
        const st = status(d);
        const label = st === 'future' ? '' : t[`status_${st}`];
        return (
          <button
            key={d}
            className={`wk wk-${st}${d === date ? ' wk-sel' : ''}${d === today ? ' wk-today' : ''}`}
            disabled={d > today}
            onClick={() => setDate(d)}
            aria-label={`${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${label ? `: ${label}` : ''}`}
            aria-current={d === date ? 'date' : undefined}
          >
            <span className="wk-day">{fmtDate(d, { weekday: 'narrow' })}</span>
            <span className="wk-num">{Number(d.slice(8))}</span>
            <span className="wk-dot" aria-hidden="true">{st === 'done' ? '✓' : st === 'missed' ? '×' : st === 'planned' ? '•' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
