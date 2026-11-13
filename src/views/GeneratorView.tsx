import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import { useExerciseFormat } from '../exerciseFormat';
import {
  candidates, conflicts, DEFAULT_INPUT, estimateSeconds, FOCUS_NAMES, generate, normalizeInput, patternOf, prescribe,
  recovering, suggestFocus, toPlan,
  type Draft, type Equip, type Focus, type GenInput, type Goal, type Level, type Recent, type Sex,
} from '../generator';
import { MUSCLES } from '../anim/muscles';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseInfo } from '../components/ExerciseInfo';

const FOCUSES: Focus[] = ['full', 'upper', 'lower', 'back', 'push', 'arms', 'core', 'cardio'];
const MINUTES = [20, 30, 45, 60, 75, 90];

/** "Build me a workout": a few questions, then a preview where exercises can be swapped. */
export function GeneratorView({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const { t, lt, exName, lang, muscleName } = useI18n();
  const { target } = useExerciseFormat();
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exByKey = useMemo(() => new Map(exercises?.filter((e) => e.key).map((e) => [e.key!, e])), [exercises]);
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);

  const [input, setInput] = useState<GenInput>(DEFAULT_INPUT);

  // Hours since each muscle was last trained as a main muscle (last 4 days).
  const recent = useLiveQuery(async () => {
    const since = new Date(Date.now() - 4 * 86400e3).toISOString().slice(0, 10);
    const [es, exs] = await Promise.all([db.entries.where('date').aboveOrEqual(since).toArray(), db.exercises.toArray()]);
    const keyOf = new Map(exs.map((e) => [e.id!, e.key]));
    const r: Recent = {};
    for (const e of es) {
      const key = keyOf.get(e.exerciseId);
      const hours = (Date.now() - e.createdAt) / 3.6e6;
      for (const m of (key && MUSCLES[key]?.p) || []) r[m] = Math.min(r[m] ?? Infinity, hours);
    }
    return r;
  }, []) ?? {};
  const rec = recovering(recent);
  const suggestion = suggestFocus(recent);
  const clash = conflicts(input.focus, recent);
  const ago = (h: number) => (lang === 'hr' ? `prije ${Math.round(h)} h` : `${Math.round(h)} h ago`);
  const left = (h: number) => (lang === 'hr' ? `još ${h} h` : `${h} h left`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keep, setKeep] = useState(false);
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState<Exercise | null>(null);

  // Remember the answers for next time.
  useEffect(() => {
    void db.meta.get('genInput').then((m) => m && setInput(normalizeInput(m.value as GenInput)));
  }, []);
  const set = <K extends keyof GenInput>(k: K, v: GenInput[K]) => setInput((i) => ({ ...i, [k]: v }));
  const toggleFocus = (f: Focus) =>
    set('focus', input.focus.includes(f) ? input.focus.filter((x) => x !== f) : f === 'full' ? ['full', ...input.focus.filter((x) => x === 'cardio')] : [...input.focus.filter((x) => x !== 'full'), f]);

  const build = () => {
    void db.meta.put({ key: 'genInput', value: input });
    setDraft(generate(input, exByKey, Date.now(), recent));
  };

  const exFor = (it: PlanItem) => (it.ex ? exByKey.get(it.ex) : undefined);
  const updateList = (list: 'main' | 'cardio', fn: (items: PlanItem[]) => PlanItem[]) =>
    setDraft((d) => (d ? { ...d, [list]: fn(d[list]) } : d));

  const swap = (list: 'main' | 'cardio', i: number) => {
    if (!draft) return;
    const it = draft[list][i];
    const used = new Set([...draft.main, ...draft.cardio].map((x) => x.ex));
    const opts = candidates(patternOf(it.ex) ?? '', input, exByKey);
    if (opts.length < 2) return;
    const start = opts.findIndex((e) => e.key === it.ex);
    for (let k = 1; k <= opts.length; k++) {
      const next = opts[(start + k) % opts.length];
      if (!used.has(next.key)) {
        const rx = list === 'cardio' ? { ...it, ex: next.key } : prescribe(next, input);
        return updateList(list, (items) => items.map((x, j) => (j === i ? rx : x)));
      }
    }
  };

  const addExercise = (id: number) => {
    const ex = exById.get(id);
    setAdding(false);
    if (!ex) return;
    // Custom exercises have no key, so give them a generic prescription by id.
    const item = ex.key ? prescribe(ex, input) : { ...prescribe(ex, input), ex: undefined, exId: ex.id };
    updateList('main', (items) => [...items, item as PlanItem]);
  };

  const save = async () => {
    if (!draft) return;
    const plan = toPlan(draft, input);
    if (keep) plan.generated = false;
    const planId = (await db.plans.add(plan)) as number;
    const day = await db.days.get(date);
    await db.days.put({ ...(day ?? { date }), planId, done: [] });
    onSaved();
  };

  const minutes = draft ? Math.round(estimateSeconds(draft, exByKey) / 60) : 0;
  const goals: Goal[] = ['strength', 'muscle', 'endurance'];
  const levels: Level[] = [1, 2, 3];
  const equips: Equip[] = ['gym', 'db', 'kb', 'band'];
  // Gym means everything; picking a specific item means training elsewhere.
  const toggleEquip = (e: Equip) =>
    set('equip', input.equip.includes(e) ? input.equip.filter((x) => x !== e) : e === 'gym' ? ['gym'] : [...input.equip.filter((x) => x !== 'gym'), e]);
  const sexes: Sex[] = ['f', 'm', 'x'];

  const row = (list: 'main' | 'cardio', it: PlanItem, i: number) => {
    const ex = exFor(it) ?? (it.exId ? exById.get(it.exId) : undefined);
    const canSwap = candidates(patternOf(it.ex) ?? '', input, exByKey).length > 1;
    return (
      <li key={`${list}-${i}-${it.ex ?? it.exId}`} className="gen-item">
        <button className="gen-name" onClick={() => ex && setInfo(ex)}>
          <strong>{exName(ex)}</strong>
          <span className="target">{target(it)}</span>
        </button>
        <div className="gen-actions">
          <button className="ghost small-btn" disabled={!canSwap} onClick={() => swap(list, i)} aria-label={t.swap}>↻ {t.swap}</button>
          <button className="icon-btn small" aria-label={t.delete} onClick={() => updateList(list, (items) => items.filter((_, j) => j !== i))}>×</button>
        </div>
      </li>
    );
  };

  return (
    <div className="page" role="dialog" aria-label={t.buildWorkout}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={draft ? () => setDraft(null) : onClose}>‹</button>
        <h1>{t.buildWorkout}</h1>
      </header>
      <main className="page-body">
        {!draft ? (
          <>
            <section className="card">
              <h2>{t.recoveryTitle}</h2>
              {rec.length ? (
                <ul className="recovery">
                  {rec.map((r) => (
                    <li key={r.muscle}><span className="chip chip-m1">{muscleName(r.muscle)}</span><span className="muted">{ago(r.ago)} · {left(r.left)}</span></li>
                  ))}
                </ul>
              ) : <p className="hint">{t.allRecovered}</p>}
              <p className="hint">{t.recoveryHint}</p>
              {suggestion && (
                <button className="suggest" onClick={() => set('focus', [suggestion, ...input.focus.filter((f) => f === 'cardio')])}>
                  <span>{t.suggestToday}</span><strong>{lt(FOCUS_NAMES[suggestion])}</strong>
                </button>
              )}
            </section>
            <section className="card">
              <h2>{t.genFocus}</h2>
              <div className="chips">
                {FOCUSES.map((f) => (
                  <button key={f} className={input.focus.includes(f) ? 'chip-btn on' : 'chip-btn'} onClick={() => toggleFocus(f)}>{lt(FOCUS_NAMES[f])}</button>
                ))}
              </div>
              {clash.length > 0 && (
                <p className="warn">⚠ {clash.map((f) => lt(FOCUS_NAMES[f])).join(', ')}: {t.conflictWarn}</p>
              )}
            </section>
            <section className="card">
              <h2>{t.genTime}</h2>
              <div className="seg">{MINUTES.map((m) => <button key={m} className={input.minutes === m ? 'on' : ''} onClick={() => set('minutes', m)}>{m}</button>)}</div>
              <p className="hint">{t.genTimeHint}</p>
            </section>
            <section className="card">
              <h2>{t.genGoal}</h2>
              <div className="seg">{goals.map((g) => <button key={g} className={input.goal === g ? 'on' : ''} onClick={() => set('goal', g)}>{t[`goal_${g}`]}</button>)}</div>
              <p className="hint">{t[`goalHint_${input.goal}`]}</p>
            </section>
            <section className="card">
              <h2>{t.genLevel}</h2>
              <div className="seg">{levels.map((l) => <button key={l} className={input.level === l ? 'on' : ''} onClick={() => set('level', l)}>{t[`level_${l}`]}</button>)}</div>
            </section>
            <section className="card">
              <h2>{t.genEquip}</h2>
              <div className="chips">{equips.map((e) => <button key={e} className={input.equip.includes(e) ? 'chip-btn on' : 'chip-btn'} onClick={() => toggleEquip(e)}>{t[`equip_${e}`]}</button>)}</div>
              <p className="hint">{input.equip.length ? t.genEquipHint : t.genEquipNone}</p>
            </section>
            <section className="card">
              <h2>{t.genSex}</h2>
              <div className="seg">{sexes.map((s) => <button key={s} className={input.sex === s ? 'on' : ''} onClick={() => set('sex', s)}>{t[`sex_${s}`]}</button>)}</div>
              <p className="hint">{t.genSexHint}</p>
            </section>
            <button className="primary wide" disabled={!input.focus.length || !exercises} onClick={build}>✨ {t.buildWorkout}</button>
          </>
        ) : (
          <>
            <section className="card">
              <h2>{lt(toPlan(draft, input).name)}</h2>
              <p className="hint">≈ {minutes} min · {t.genPreviewHint}</p>
              {draft.notes.length > 0 && <ul className="advice">{draft.notes.map((n, i) => <li key={i}>{lt(n)}</li>)}</ul>}
            </section>
            {draft.warmup.length > 0 && (
              <section>
                <h3 className="group-title">{t.genWarmup}</h3>
                <ul className="gen-text">{draft.warmup.map((w, i) => <li key={i}>{lt(w)}</li>)}</ul>
              </section>
            )}
            <section>
              <h3 className="group-title">{t.genMain}</h3>
              <ul className="gen-list">{draft.main.map((it, i) => row('main', it, i))}</ul>
              <button className="ghost wide" onClick={() => setAdding(true)}>+ {t.addExercise}</button>
            </section>
            {draft.cardio.length > 0 && (
              <section>
                <h3 className="group-title">{lt(FOCUS_NAMES.cardio)}</h3>
                <ul className="gen-list">{draft.cardio.map((it, i) => row('cardio', it, i))}</ul>
              </section>
            )}
            {draft.cooldown.length > 0 && (
              <section>
                <h3 className="group-title">{t.genCooldown}</h3>
                <ul className="gen-text">{draft.cooldown.map((w, i) => <li key={i}>{lt(w)}</li>)}</ul>
              </section>
            )}
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              <span>{t.genKeep}</span>
            </label>
            <div className="row-actions">
              <button className="ghost" onClick={build}>↻ {t.genAgain}</button>
              <button className="primary" disabled={!draft.main.length && !draft.cardio.length} onClick={save}>▶ {t.genStart}</button>
            </div>
          </>
        )}
      </main>
      {adding && <ExercisePicker onPick={addExercise} onClose={() => setAdding(false)} />}
      {info && <ExerciseInfo exercise={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
