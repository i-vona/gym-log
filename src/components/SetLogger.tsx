import { useEffect, useState } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, parseNum, type Entry, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import { FIELDS, planDefault, useExerciseFormat, type Field } from '../exerciseFormat';
import { fmtClock } from '../timer';
import { beep, finishedSignal, keepAwake, unlockAudio } from '../sound';

/**
 * Input state for logging sets of one exercise: prefills from the last set today,
 * else the first set last time, else the plan target.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSetLogger(exercise: Exercise, date: string, entries: Entry[], item: PlanItem | undefined, onLogged: () => void) {
  const { fields, required } = FIELDS[exercise.type];
  const [fa, fb] = fields;
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const previous = useLiveQuery(async () => {
    const prior = await db.entries
      .where('[exerciseId+date]')
      .between([exercise.id!, Dexie.minKey], [exercise.id!, date], true, false)
      .toArray();
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    return prior.filter((e) => e.date === lastDate);
  }, [exercise.id, date]);

  const source = entries[entries.length - 1] ?? previous?.[0];
  const str = (v: number | undefined) => (v != null ? String(v) : '');
  useEffect(() => {
    if (source) {
      setA(str(source[fa]));
      setB(str(source[fb]));
    } else if (previous === null) {
      setA('');
      setB(planDefault(item));
    }
  }, [source?.id, previous === null, exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vals: Partial<Record<Field, number | undefined>> = { [fa]: parseNum(a), [fb]: parseNum(b) };
  const valid = (v: Partial<Record<Field, number | undefined>>) =>
    required.length ? required.every((f) => v[f] != null) : v[fa] != null || v[fb] != null;

  const add = async (override?: Partial<Record<Field, number | undefined>>) => {
    const v0 = { ...vals, ...override };
    if (!valid(v0)) return;
    unlockAudio();
    const rec: Entry = { date, exerciseId: exercise.id!, createdAt: Date.now() };
    for (const f of fields) {
      let v = v0[f];
      if (f === 'weight') v = v ?? 0;
      if (f === 'reps' && v != null) v = Math.round(v);
      if (v != null) rec[f] = v;
    }
    await db.entries.add(rec);
    onLogged();
  };

  return { fa, fb, a, b, setA, setB, canAdd: valid(vals), add, previous };
}

type Logger = ReturnType<typeof useSetLogger>;

/** The two inputs + add button (and a stopwatch for timed holds). */
export function SetInputs({ exercise, logger, item, big, addLabel }: {
  exercise: Exercise; logger: Logger; item?: PlanItem; big?: boolean; addLabel?: string;
}) {
  const { t } = useI18n();
  const { fieldLabel } = useExerciseFormat();
  const { fa, fb, a, b, setA, setB, canAdd, add } = logger;
  return (
    <>
      <form className={big ? 'add-row big' : 'add-row'} onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>
          <span>{fieldLabel(fa, exercise)}</span>
          <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <label>
          <span>{fieldLabel(fb, exercise)}</span>
          <input inputMode={fb === 'reps' ? 'numeric' : 'decimal'} value={b} onChange={(e) => setB(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <button className="primary" disabled={!canAdd}>{addLabel ?? t.add}</button>
      </form>
      {exercise.type === 'hold' && (
        <HoldTimer target={parseNum(planDefault(item) || b) ?? 0} onDone={(sec) => void add({ seconds: sec })} />
      )}
    </>
  );
}

/** Today's logged sets with delete buttons. */
export function SetList({ exercise, entries }: { exercise: Exercise; entries: Entry[] }) {
  const { t } = useI18n();
  const { describe } = useExerciseFormat();
  if (!entries.length) return null;
  return (
    <ol className="sets">
      {entries.map((e, i) => (
        <li key={e.id}>
          <span className="set-no">{i + 1}</span>
          <span className="set-val">{describe(e, exercise)}</span>
          <button className="icon-btn small" aria-label={t.delete} onClick={() => confirm(t.confirmDelete) && db.entries.delete(e.id!)}>×</button>
        </li>
      ))}
    </ol>
  );
}

/** Stopwatch for timed holds: 3 s to get in position, then counts up; beeps at the target. */
export function HoldTimer({ target, onDone }: { target: number; onDone: (seconds: number) => void }) {
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
    return <button className="ghost wide hold-btn" onClick={start}>⏱ {t.holdStart}{target ? ` (${target} s)` : ''}</button>;
  }
  return (
    <button className={elapsed < 0 ? 'hold-run ready' : target && elapsed >= target ? 'hold-run reached' : 'hold-run'} onClick={stop}>
      <span>{elapsed < 0 ? t.getReady : t.holdStop}</span>
      <strong>{elapsed < 0 ? Math.ceil(-elapsed) : fmtClock(elapsed)}</strong>
    </button>
  );
}
