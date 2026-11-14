import { useEffect, useState } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, parseNum, type Entry, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import { fieldsFor, planDefault, useExerciseFormat, type Field } from '../exerciseFormat';
import { fmtClock, useTimer } from '../timer';
import { useUndo } from '../undo';
import { Ring } from './Ring';
import { beep, finishedSignal, keepAwake, unlockAudio } from '../sound';

type Side = 'L' | 'R';
type Vals = Partial<Record<Field, number | undefined>>;

/** Working sets logged (warm-ups don't count); for one-sided exercises a left + right pair counts as one set. */
// eslint-disable-next-line react-refresh/only-export-components
export function setCount(all: Entry[], ex: Exercise) {
  const entries = all.filter((e) => !e.warmup);
  if (!ex.unilateral) return entries.length;
  const l = entries.filter((e) => e.side === 'L').length;
  const r = entries.filter((e) => e.side === 'R').length;
  return Math.max(l, r) + entries.filter((e) => !e.side).length;
}

/**
 * Input state for logging sets of one exercise. Prefills from the last set today, else
 * the first set last time, else the plan target. One-sided exercises get a pair of
 * inputs for each side.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSetLogger(exercise: Exercise, date: string, entries: Entry[], item: PlanItem | undefined, onLogged: () => void) {
  const { fields, required } = fieldsFor(exercise);
  // fb is the main field (reps/seconds/...); fa is the optional first one (kg, minutes), null for body-weight exercises.
  const fb = fields[fields.length - 1];
  const fa: Field | null = fields.length > 1 ? fields[0] : null;
  const uni = !!exercise.unilateral;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [aR, setAR] = useState('');
  const [bR, setBR] = useState('');
  const [warm, setWarm] = useState(false);
  const showUndo = useUndo();
  const timer = useTimer();
  const { t } = useI18n();

  const previous = useLiveQuery(async () => {
    const prior = await db.entries
      .where('[exerciseId+date]')
      .between([exercise.id!, Dexie.minKey], [exercise.id!, date], true, false)
      .filter((e) => !e.warmup)
      .toArray();
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    return prior.filter((e) => e.date === lastDate);
  }, [exercise.id, date]);

  const str = (v: number | undefined) => (v != null ? String(v) : '');
  const sourceFor = (side?: Side) => {
    const match = (e: Entry) => !uni || !side || e.side === side || !e.side;
    return [...entries].reverse().find(match) ?? previous?.find(match);
  };
  const srcL = sourceFor(uni ? 'L' : undefined);
  const srcR = sourceFor('R');
  useEffect(() => {
    if (srcL) { setA(fa ? str(srcL[fa]) : ''); setB(str(srcL[fb])); }
    else if (previous === null) { setA(''); setB(planDefault(item)); }
    if (uni) {
      const s = srcR ?? srcL;
      if (s) { setAR(fa ? str(s[fa]) : ''); setBR(str(s[fb])); }
      else if (previous === null) { setAR(''); setBR(planDefault(item)); }
    }
  }, [srcL?.id, srcR?.id, previous === null, exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = (v: Vals) => (required.length ? required.every((f) => v[f] != null) : (fa != null && v[fa] != null) || v[fb] != null);
  const vals = (x: string, y: string): Vals => ({ ...(fa ? { [fa]: parseNum(x) } : {}), [fb]: parseNum(y) });
  const valsL = vals(a, b);
  const valsR = vals(aR, bR);
  const canAdd = uni ? valid(valsL) || valid(valsR) : valid(valsL);

  const record = (v: Vals, side: Side | undefined, at: number): Entry => {
    const rec: Entry = { date, exerciseId: exercise.id!, createdAt: at };
    if (side) rec.side = side;
    if (warm) rec.warmup = true;
    for (const f of fields) {
      let x = v[f];
      if (f === 'weight') x = x ?? 0;
      if (f === 'reps' && x != null) x = Math.round(x);
      if (x != null) rec[f] = x;
    }
    return rec;
  };

  const add = async (override?: Vals) => {
    unlockAudio();
    const now = Date.now();
    let ids: number[];
    if (uni) {
      const recs = [valid(valsL) && record(valsL, 'L', now), valid(valsR) && record(valsR, 'R', now + 1)].filter(Boolean) as Entry[];
      if (!recs.length) return;
      ids = (await db.entries.bulkAdd(recs, { allKeys: true })) as number[];
    } else {
      const v = { ...valsL, ...override };
      if (!valid(v)) return;
      ids = [(await db.entries.add(record(v, undefined, now))) as number];
    }
    const wasWarm = warm;
    setWarm(false);
    showUndo(wasWarm ? `${t.setLogged} (${t.warmupSet.toLowerCase()})` : t.setLogged, async () => {
      await db.entries.bulkDelete(ids);
      if (!wasWarm) timer.stopRest();
    });
    // Warm-up sets don't count towards the plan, so they don't start rest or move on.
    if (!wasWarm) onLogged();
  };

  return { fa, fb, uni, a, b, setA, setB, aR, bR, setAR, setBR, canAdd, add, previous, warm, setWarm };
}

type Logger = ReturnType<typeof useSetLogger>;

/** Inputs + save button; one row per side for one-sided exercises; stopwatch for holds. */
export function SetInputs({ exercise, logger, item, big, addLabel }: {
  exercise: Exercise; logger: Logger; item?: PlanItem; big?: boolean; addLabel?: string;
}) {
  const { t } = useI18n();
  const { fieldLabel } = useExerciseFormat();
  const { fa, fb, uni, a, b, setA, setB, aR, bR, setAR, setBR, canAdd, add, warm, setWarm } = logger;
  const hold = exercise.type === 'hold';
  // Warm-up sets make sense for loaded lifts.
  const warmToggle = exercise.type === 'strength' && fa === 'weight' && !exercise.assisted && (
    <label className={warm ? 'warm-toggle on' : 'warm-toggle'}>
      <input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} />
      <span>{t.warmupSet}</span>
    </label>
  );
  const target = parseNum(planDefault(item) || b) ?? 0;

  const inputs = (va: string, sa: (s: string) => void, vb: string, sb: (s: string) => void, showLabels: boolean) => (
    <>
      {fa && <label>
        {showLabels && <span>{fieldLabel(fa, exercise)}</span>}
        <input inputMode="decimal" aria-label={fieldLabel(fa, exercise)} value={va} onChange={(e) => sa(e.target.value)} onFocus={(e) => e.target.select()} />
      </label>}
      <label>
        {showLabels && <span>{fieldLabel(fb, exercise)}</span>}
        <input inputMode={fb === 'reps' ? 'numeric' : 'decimal'} aria-label={fieldLabel(fb, exercise)} value={vb} onChange={(e) => sb(e.target.value)} onFocus={(e) => e.target.select()} />
      </label>
    </>
  );

  if (uni) {
    return (
      <form className={big ? 'side-form big' : 'side-form'} onSubmit={(e) => { e.preventDefault(); void add(); }}>
        {warmToggle}
        <div className={fa ? 'side-row side-head' : 'side-row side-head single'}>
          <span />
          {fa && <span>{fieldLabel(fa, exercise)}</span>}
          <span>{fieldLabel(fb, exercise)}</span>
        </div>
        <div className={fa ? 'side-row' : 'side-row single'}>
          <span className="side-tag">{t.leftShort}</span>
          {inputs(a, setA, b, setB, false)}
        </div>
        {hold && <HoldTimer label={t.left} target={target} onDone={(s) => setB(String(s))} />}
        <div className={fa ? 'side-row' : 'side-row single'}>
          <span className="side-tag">{t.rightShort}</span>
          {inputs(aR, setAR, bR, setBR, false)}
        </div>
        {hold && <HoldTimer label={t.right} target={target} onDone={(s) => setBR(String(s))} />}
        <button className="primary wide" disabled={!canAdd}>{addLabel ?? t.add}</button>
      </form>
    );
  }

  return (
    <>
      {warmToggle}
      <form className={big ? 'add-row big' : 'add-row'} onSubmit={(e) => { e.preventDefault(); void add(); }}>
        {inputs(a, setA, b, setB, true)}
        <button className="primary" disabled={!canAdd}>{addLabel ?? t.add}</button>
      </form>
      {hold && <HoldTimer target={target} onDone={(sec) => void add({ seconds: sec })} />}
    </>
  );
}

/** Today's logged sets with delete buttons; left/right pairs share one row. */
export function SetList({ exercise, entries }: { exercise: Exercise; entries: Entry[] }) {
  const { t } = useI18n();
  const showUndo = useUndo();
  const { describe } = useExerciseFormat();
  if (!entries.length) return null;

  const rows: Entry[][] = [];
  // Warm-ups first (they're done first), then working sets; left/right pairs share a row.
  for (const group of [entries.filter((e) => e.warmup), entries.filter((e) => !e.warmup)]) {
    if (exercise.unilateral) {
      const L = group.filter((e) => e.side === 'L');
      const R = group.filter((e) => e.side === 'R');
      for (let i = 0; i < Math.max(L.length, R.length); i++) rows.push([L[i], R[i]].filter(Boolean));
      group.filter((e) => !e.side).forEach((e) => rows.push([e]));
    } else group.forEach((e) => rows.push([e]));
  }

  // Delete straight away; the undo message brings it back.
  const remove = async (row: Entry[]) => {
    await db.entries.bulkDelete(row.map((e) => e.id!));
    showUndo(t.setDeleted, async () => { await db.entries.bulkPut(row); });
  };
  let n = 0;

  return (
    <ol className="sets">
      {rows.map((row) => (
        <li key={row[0].id} className={row[0].warmup ? 'warm' : undefined}>
          <span className={row[0].warmup ? 'set-no warm' : 'set-no'} title={row[0].warmup ? t.warmupSet : undefined}>{row[0].warmup ? t.warmupShort : ++n}</span>
          <span className="set-val">
            {row.map((e) => (
              <span key={e.id} className="side-val">
                {e.side && <b>{e.side === 'L' ? t.leftShort : t.rightShort}</b>} {describe(e, exercise)}
              </span>
            ))}
          </span>
          <button className="icon-btn small" aria-label={t.delete} onClick={() => remove(row)}>×</button>
        </li>
      ))}
    </ol>
  );
}

/** Stopwatch for timed holds: 3 s to get in position, then counts up; beeps at the target. */
export function HoldTimer({ target, onDone, label }: { target: number; onDone: (seconds: number) => void; label?: string }) {
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
    if (s > 0) onDone(s);
  };

  if (startAt == null) {
    return (
      <button type="button" className="ghost wide hold-btn" onClick={start}>
        ⏱ {t.holdStart}{label ? ` – ${label}` : ''}{target ? ` (${target} s)` : ''}
      </button>
    );
  }
  const progress = elapsed < 0 ? 1 + elapsed / 3 : target ? elapsed / target : (elapsed % 60) / 60;
  return (
    <button type="button" className={elapsed < 0 ? 'hold-run ready' : target && elapsed >= target ? 'hold-run reached' : 'hold-run'} onClick={stop}>
      <Ring value={progress} size={150} stroke={10}>
        <strong>{elapsed < 0 ? Math.ceil(-elapsed) : fmtClock(elapsed)}</strong>
        {target > 0 && elapsed >= 0 && <small>/ {fmtClock(target)}</small>}
      </Ring>
      <span>{elapsed < 0 ? t.getReady : label ? `${t.stop} – ${label}` : t.holdStop}</span>
    </button>
  );
}
