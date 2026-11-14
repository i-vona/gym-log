import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type PlanItem } from '../db';
import { useI18n } from '../i18n';
import {
  AREA_MUSCLES, candidates, conflicts, DEFAULT_INPUT, estimateSeconds, FOCUS_NAMES, generate, normalizeInput, patternOf, prescribe,
  recovering, suggestFocus, toPlan,
  type Draft, type Equip, type Focus, type GenInput, type Goal, type Level, type Recent, type Sex,
} from '../generator';
import { MUSCLES } from '../anim/muscles';
import { MOVES } from '../anim/moves';
import { draw, poseAt, type Cls, type Move, type Muscle, type Pose } from '../anim/figure';
import { bounds, FigurePrims } from '../components/Figure';
import { MuscleMap } from '../components/MuscleMap';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseInfo } from '../components/ExerciseInfo';

const FOCUSES: Focus[] = ['full', 'upper', 'lower', 'back', 'push', 'arms', 'core', 'cardio'];
const MINUTES = [20, 30, 45, 60, 75, 90];
const GOALS: Goal[] = ['strength', 'muscle', 'endurance'];
const LEVELS: Level[] = [1, 2, 3];
const EQUIPS: Equip[] = ['gym', 'db', 'kb', 'band'];
const SEXES: Sex[] = ['f', 'm', 'x'];
const STEPS = ['focus', 'time', 'goal', 'level', 'equip', 'sex'] as const;
type Step = (typeof STEPS)[number];

const STAND: Pose = { view: 'front', t: 90, ua: -77, fa: -84, th: -93, sh: -91, at: ['ground', 100] };
const STILL: Move = { frames: [STAND], noFloor: true };

/** A small standing figure with the muscles of a training area highlighted. */
function AreaFigure({ focus }: { focus: Focus }) {
  const svg = useMemo(() => {
    const view = focus === 'back' ? 'back' : 'front';
    const tg = focus === 'cardio' ? { p: ['cardio' as Muscle], s: [] } : { p: AREA_MUSCLES[focus], s: [] };
    const prims = draw(STILL, { ...STAND, view }, tg);
    return { prims, vb: bounds(prims, 2) };
  }, [focus]);
  return (
    <svg className="area-fig" viewBox={svg.vb.join(' ')} aria-hidden="true">
      <FigurePrims prims={svg.prims} />
    </svg>
  );
}

/** Still frame of an exercise animation, cropped to the drawing. */
function ExThumb({ exKey }: { exKey?: string }) {
  const svg = useMemo(() => {
    const move = exKey ? MOVES[exKey] : undefined;
    if (!move) return null;
    const prims = draw(move, poseAt(move, 0), MUSCLES[exKey!]);
    return { prims, vb: bounds(prims, 3) };
  }, [exKey]);
  if (!svg) return <span className="rx-thumb rx-thumb-empty" aria-hidden="true">•</span>;
  return (
    <svg className="rx-thumb" viewBox={svg.vb.join(' ')} aria-hidden="true">
      <FigurePrims prims={svg.prims} />
    </svg>
  );
}

/** "Build me a workout": one question per card with a progress bar, then the workout overview. */
export function GeneratorView({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const { t, lt, exName, lang, muscleName, fill } = useI18n();
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exByKey = useMemo(() => new Map(exercises?.filter((e) => e.key).map((e) => [e.key!, e])), [exercises]);
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);

  const [input, setInput] = useState<GenInput>(DEFAULT_INPUT);
  const [step, setStep] = useState(0);

  // Hours since each muscle was last trained as a main muscle (last 4 days).
  const recentQ = useLiveQuery(async () => {
    const since = new Date(Date.now() - 4 * 86400e3).toISOString().slice(0, 10);
    const [es, exs] = await Promise.all([db.entries.where('date').aboveOrEqual(since).filter((e) => !e.warmup).toArray(), db.exercises.toArray()]);
    const keyOf = new Map(exs.map((e) => [e.id!, e.key]));
    const r: Recent = {};
    for (const e of es) {
      const key = keyOf.get(e.exerciseId);
      const hours = (Date.now() - e.createdAt) / 3.6e6;
      for (const m of (key && MUSCLES[key]?.p) || []) r[m] = Math.min(r[m] ?? Infinity, hours);
    }
    return r;
  }, []);
  const recent = useMemo<Recent>(() => recentQ ?? {}, [recentQ]);
  const rec = recovering(recent);
  const recSet = new Set(rec.map((r) => r.muscle));
  const suggestion = suggestFocus(recent);
  const clash = conflicts(input.focus, recent);
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
  // Gym means everything; picking a specific item means training elsewhere.
  const toggleEquip = (e: Equip) =>
    set('equip', input.equip.includes(e) ? input.equip.filter((x) => x !== e) : e === 'gym' ? ['gym'] : [...input.equip.filter((x) => x !== 'gym'), e]);

  const build = useCallback((inp: GenInput) => {
    void db.meta.put({ key: 'genInput', value: inp });
    setDraft(generate(inp, exByKey, Date.now(), recent));
    document.querySelector('.page')?.scrollTo({ top: 0 });
  }, [exByKey, recent]);

  const last = step === STEPS.length - 1;
  const next = () => (last ? build(input) : setStep((s) => s + 1));
  /** Single-choice questions move on by themselves after a short beat. */
  const choose = <K extends keyof GenInput>(k: K, v: GenInput[K]) => {
    const nextInput = { ...input, [k]: v };
    setInput(nextInput);
    window.setTimeout(() => (last ? build(nextInput) : setStep((s) => s + 1)), 180);
  };

  const exFor = (it: PlanItem) => (it.ex ? exByKey.get(it.ex) : it.exId ? exById.get(it.exId) : undefined);
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
      const nx = opts[(start + k) % opts.length];
      if (!used.has(nx.key)) {
        const rx = list === 'cardio' ? { ...it, ex: nx.key } : prescribe(nx, input);
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

  // Muscles of the whole workout: main muscles red, supporting ones orange.
  const workTargets = useMemo(() => {
    const p = new Set<Muscle>();
    const s = new Set<Muscle>();
    for (const it of draft ? [...draft.main, ...draft.cardio] : []) {
      const tg = it.ex ? MUSCLES[it.ex] : undefined;
      tg?.p.forEach((m) => p.add(m));
      tg?.s.forEach((m) => s.add(m));
    }
    p.forEach((m) => s.delete(m));
    return { p, s };
  }, [draft]);
  const paint = useCallback((m: Muscle): Cls => (workTargets.p.has(m) ? 'm1' : workTargets.s.has(m) ? 'm2' : 'mu'), [workTargets]);

  const goBack = () => {
    if (draft) setDraft(null);
    else if (step > 0) setStep((s) => s - 1);
    else onClose();
  };

  const prescriptionOf = (it: PlanItem) => {
    if (!it.target) return '';
    const unit = it.unit === 's' ? ' s' : it.unit === 'm' ? ' m' : it.unit === 'min' ? ' min' : '';
    return `${it.sets ? `${it.sets} × ` : ''}${it.target}${unit}${it.perSide ? ` ${t.perSide}` : ''}`;
  };

  const rxCard = (list: 'main' | 'cardio', it: PlanItem, i: number, n: number) => {
    const ex = exFor(it);
    const canSwap = candidates(patternOf(it.ex) ?? '', input, exByKey).length > 1;
    const main = it.ex ? MUSCLES[it.ex]?.p.filter((m) => m !== 'cardio') ?? [] : [];
    const prev = draft?.[list][i - 1];
    const ss = it.superset && (prev?.superset !== it.superset);
    return (
      <li key={`${list}-${i}-${it.ex ?? it.exId}`} className={it.superset ? 'rx in-superset' : 'rx'}>
        {ss && <span className="rx-ss">{t.supersetLabel} {it.superset}</span>}
        <div className="rx-row">
          <span className="rx-num">{n}</span>
          <button className="rx-main" onClick={() => ex && setInfo(ex)}>
            <ExThumb exKey={ex?.key} />
            <span className="rx-text">
              <strong>{exName(ex)}</strong>
              <span className="rx-target">{prescriptionOf(it)}</span>
              <span className="rx-meta">
                {it.rest ? <span>⏱ {it.rest} s</span> : null}
                {main.slice(0, 2).map((m) => <span key={m} className="rx-mu">{muscleName(m)}</span>)}
              </span>
            </span>
          </button>
          <div className="rx-actions">
            <button className="icon-btn small" disabled={!canSwap} onClick={() => swap(list, i)} aria-label={t.swap} title={t.swap}>↻</button>
            <button className="icon-btn small" onClick={() => updateList(list, (items) => items.filter((_, j) => j !== i))} aria-label={t.delete} title={t.delete}>×</button>
          </div>
        </div>
      </li>
    );
  };

  const option = (on: boolean, onClick: () => void, title: string, sub?: string, extra?: ReactNode) => (
    <button key={title} className={on ? 'opt on' : 'opt'} onClick={onClick} aria-pressed={on}>
      <span className="opt-text"><strong>{title}</strong>{sub && <span>{sub}</span>}</span>
      {extra}
      <span className="opt-check" aria-hidden="true">{on ? '✓' : ''}</span>
    </button>
  );

  const question = (s: Step) => {
    switch (s) {
      case 'focus':
        return (
          <>
            <h2 className="wiz-q">{t.wizFocusTitle}</h2>
            <p className="wiz-sub">{t.wizFocusSub}</p>
            {suggestion && (
              <button className="suggest" onClick={() => set('focus', [suggestion, ...input.focus.filter((f) => f === 'cardio')])}>
                <span>{t.suggestToday}</span><strong>{lt(FOCUS_NAMES[suggestion])}</strong>
              </button>
            )}
            <div className="area-grid">
              {FOCUSES.map((f) => {
                const on = input.focus.includes(f);
                const tired = f !== 'cardio' && f !== 'full' && AREA_MUSCLES[f].some((m) => recSet.has(m));
                return (
                  <button key={f} className={on ? 'area on' : 'area'} onClick={() => toggleFocus(f)} aria-pressed={on}>
                    <AreaFigure focus={f} />
                    <span className="area-name">{lt(FOCUS_NAMES[f])}</span>
                    {tired && <span className="area-badge">{t.recovering}</span>}
                    <span className="opt-check" aria-hidden="true">{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
            {clash.length > 0 && <p className="warn">⚠ {clash.map((f) => lt(FOCUS_NAMES[f])).join(', ')}: {t.conflictWarn}</p>}
            {rec.length > 0 && (
              <details className="wiz-rec">
                <summary>{t.recoveryTitle} · {rec.length}</summary>
                <ul className="recovery">
                  {rec.map((r) => (
                    <li key={r.muscle}><span className="chip chip-m1">{muscleName(r.muscle)}</span><span className="muted">{left(r.left)}</span></li>
                  ))}
                </ul>
                <p className="hint">{t.recoveryHint}</p>
              </details>
            )}
          </>
        );
      case 'time':
        return (
          <>
            <h2 className="wiz-q">{t.wizTimeTitle}</h2>
            <p className="wiz-sub">{t.genTimeHint}</p>
            <div className="time-grid">
              {MINUTES.map((m) => (
                <button key={m} className={input.minutes === m ? 'time on' : 'time'} onClick={() => choose('minutes', m)} aria-pressed={input.minutes === m}>
                  <strong>{m}</strong><span>{t.minutesShort}</span>
                </button>
              ))}
            </div>
          </>
        );
      case 'goal':
        return (
          <>
            <h2 className="wiz-q">{t.wizGoalTitle}</h2>
            <div className="opts">{GOALS.map((g) => option(input.goal === g, () => choose('goal', g), t[`goal_${g}`], t[`goalHint_${g}`]))}</div>
          </>
        );
      case 'level':
        return (
          <>
            <h2 className="wiz-q">{t.wizLevelTitle}</h2>
            <div className="opts">
              {LEVELS.map((l) => option(input.level === l, () => choose('level', l), t[`level_${l}`], t[`levelHint_${l}`],
                <span className="opt-bars" aria-hidden="true">{[1, 2, 3].map((b) => <i key={b} className={b <= l ? 'on' : ''} />)}</span>))}
            </div>
          </>
        );
      case 'equip':
        return (
          <>
            <h2 className="wiz-q">{t.wizEquipTitle}</h2>
            <p className="wiz-sub">{t.wizEquipSub}</p>
            <div className="opts">{EQUIPS.map((e) => option(input.equip.includes(e), () => toggleEquip(e), t[`equip_${e}`], t[`equipHint_${e}`]))}</div>
            <p className="hint">{input.equip.length ? t.genEquipHint : t.genEquipNone}</p>
          </>
        );
      case 'sex':
        return (
          <>
            <h2 className="wiz-q">{t.wizSexTitle}</h2>
            <p className="wiz-sub">{t.genSexHint}</p>
            <div className="opts">{SEXES.map((s2) => option(input.sex === s2, () => choose('sex', s2), t[`sex_${s2}`]))}</div>
          </>
        );
    }
  };

  // Questions with several answers need an explicit "Next".
  const multi = STEPS[step] === 'focus' || STEPS[step] === 'equip';
  const canNext = STEPS[step] !== 'focus' || input.focus.length > 0;

  const totalSets = draft ? draft.main.reduce((s, it) => s + (it.sets ?? 0), 0) : 0;
  const minutes = draft ? Math.round(estimateSeconds(draft, exByKey) / 60) : 0;

  return (
    <div className="page" role="dialog" aria-label={t.buildWorkout}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={goBack}>‹</button>
        <h1>{t.buildWorkout}</h1>
      </header>
      {!draft && (
        <div className="wiz-progress" aria-label={fill(t.wizStepOf, { n: step + 1, total: STEPS.length })}>
          <div className="wiz-bars">
            {STEPS.map((s, i) => (
              <button key={s} className={i < step ? 'done' : i === step ? 'cur' : ''} onClick={() => i < step && setStep(i)} disabled={i >= step} aria-label={`${t.step} ${i + 1}`} />
            ))}
          </div>
          <span>{fill(t.wizStepOf, { n: step + 1, total: STEPS.length })}</span>
        </div>
      )}
      <main className="page-body">
        {!draft ? (
          <>
            <section key={step} className="wiz-card">{question(STEPS[step])}</section>
            <div className="wiz-foot">
              {step > 0 && <button className="ghost" onClick={() => setStep((s) => s - 1)}>‹ {t.wizBack}</button>}
              {(multi || last) && (
                <button className="primary" disabled={!canNext || !exercises} onClick={next}>
                  {last ? `✨ ${t.buildWorkout}` : `${t.wizNext} ›`}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <section className="res-hero">
              <p className="res-kicker">{t[`goal_${input.goal}`]} · {t[`level_${input.level}`]}</p>
              <h2>{input.focus.map((f) => lt(FOCUS_NAMES[f])).join(' + ')}</h2>
              <div className="res-stats">
                <div><strong>≈{minutes}</strong><span>{t.resMinutes}</span></div>
                <div><strong>{draft.main.length + draft.cardio.length}</strong><span>{t.resExercises}</span></div>
                <div><strong>{totalSets}</strong><span>{t.resSets}</span></div>
              </div>
              {(workTargets.p.size > 0 || workTargets.s.size > 0) && (
                <div className="res-map">
                  <span className="muscles-label">{t.resMuscles}</span>
                  <MuscleMap paint={paint} small />
                  <div className="res-legend">
                    <span><i className="chip-dot m1" />{t.primaryMuscles}</span>
                    <span><i className="chip-dot m2" />{t.secondaryMuscles}</span>
                  </div>
                </div>
              )}
            </section>

            {draft.notes.length > 0 && (
              <div className="res-notes">{draft.notes.map((n, i) => <p key={i}>💡 {lt(n)}</p>)}</div>
            )}

            <ol className="tl">
              {draft.warmup.length > 0 && (
                <li className="tl-sec">
                  <h3><span className="tl-dot" />{t.genWarmup}<span className="tl-meta">≈ {draft.warmupMin} min</span></h3>
                  <ul className="tl-pills">{draft.warmup.map((w, i) => <li key={i}>{lt(w)}</li>)}</ul>
                </li>
              )}
              {draft.cardioFirst && draft.cardio.length > 0 && (
                <li className="tl-sec">
                  <h3><span className="tl-dot" />{lt(FOCUS_NAMES.cardio)}</h3>
                  <ul className="rx-list">{draft.cardio.map((it, i) => rxCard('cardio', it, i, i + 1))}</ul>
                </li>
              )}
              <li className="tl-sec">
                <h3><span className="tl-dot accent" />{t.genMain}<span className="tl-meta">{draft.main.length} · {totalSets} {t.resSets}</span></h3>
                <ul className="rx-list">{draft.main.map((it, i) => rxCard('main', it, i, i + 1))}</ul>
                <button className="ghost wide" onClick={() => setAdding(true)}>+ {t.addExercise}</button>
              </li>
              {!draft.cardioFirst && draft.cardio.length > 0 && (
                <li className="tl-sec">
                  <h3><span className="tl-dot" />{lt(FOCUS_NAMES.cardio)}</h3>
                  <ul className="rx-list">{draft.cardio.map((it, i) => rxCard('cardio', it, i, draft.main.length + i + 1))}</ul>
                </li>
              )}
              {draft.cooldown.length > 0 && (
                <li className="tl-sec">
                  <h3><span className="tl-dot" />{t.genCooldown}</h3>
                  <ul className="tl-pills">{draft.cooldown.map((w, i) => <li key={i}>{lt(w)}</li>)}</ul>
                </li>
              )}
            </ol>
            <p className="hint small-print">{t.genPreviewHint}</p>

            <div className="wiz-foot res-foot">
              <label className="check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                <span>{t.genKeep}</span>
              </label>
              <div className="row-actions">
                <button className="ghost" onClick={() => build(input)}>↻ {t.genAgain}</button>
                <button className="primary" disabled={!draft.main.length && !draft.cardio.length} onClick={save}>▶ {t.genStart}</button>
              </div>
              <button className="link-btn" onClick={() => { setDraft(null); setStep(0); }}>{t.resChange}</button>
            </div>
          </>
        )}
      </main>
      {adding && <ExercisePicker onPick={addExercise} onClose={() => setAdding(false)} />}
      {info && <ExerciseInfo exercise={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
