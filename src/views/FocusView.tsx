import { useEffect, useMemo, useState } from 'react';
import type { Day, Entry, Exercise, LText, Plan, PlanItem } from '../db';
import { useI18n } from '../i18n';
import { useExerciseFormat } from '../exerciseFormat';
import { fmtClock, useTimer } from '../timer';
import { keepAwake } from '../sound';
import { recommendedRest } from '../rest';
import { MOVES } from '../anim/moves';
import { MUSCLES } from '../anim/muscles';
import { ExerciseAnim } from '../components/ExerciseAnim';
import { Ring } from '../components/Ring';
import { WorkoutSummary } from '../components/WorkoutSummary';
import type { SwappedItem } from '../swap';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { SetInputs, SetList, setCount, useSetLogger } from '../components/SetLogger';

type Step =
  | { kind: 'check'; si: number; items: { id: string; text: LText }[] }
  | {
      kind: 'ex';
      si: number;
      item: PlanItem;
      ex: Exercise;
      /** Step indices of the superset or circuit this step belongs to. */
      group?: number[];
      groupKind?: 'superset' | 'circuit';
    }
  | { kind: 'done' };

function buildSteps(plan: Plan, exOf: (it: PlanItem) => Exercise | undefined): Step[] {
  const steps: Step[] = [];
  plan.sections.forEach((sec, si) => {
    const checks = sec.items.flatMap((it, i) => (it.text ? [{ id: `${si}-${i}`, text: it.text }] : []));
    if (checks.length) steps.push({ kind: 'check', si, items: checks });
    const start = steps.length;
    for (const it of sec.items) {
      const ex = exOf(it);
      if (ex) steps.push({ kind: 'ex', si, item: it, ex });
    }
    const exSteps = steps.slice(start).map((_, k) => start + k);
    if (sec.circuit && exSteps.length) {
      for (const k of exSteps) Object.assign(steps[k], { group: exSteps, groupKind: 'circuit' });
    } else {
      // Consecutive items sharing a superset label.
      for (let k = 0; k < exSteps.length; k++) {
        const s = steps[exSteps[k]] as Extract<Step, { kind: 'ex' }>;
        if (!s.item.superset || s.group) continue;
        const g: number[] = [];
        for (let n = k; n < exSteps.length; n++) {
          const it = (steps[exSteps[n]] as Extract<Step, { kind: 'ex' }>).item;
          if (it.superset !== s.item.superset) break;
          g.push(exSteps[n]);
        }
        for (const idx of g) Object.assign(steps[idx], { group: g, groupKind: 'superset' });
      }
    }
  });
  steps.push({ kind: 'done' });
  return steps;
}

export function FocusView({ plan, date, day, entries, exOf, onClose, onToggle, onSwap }: {
  plan: Plan;
  date: string;
  day: Day | undefined;
  entries: Entry[];
  exOf: (it: PlanItem) => Exercise | undefined;
  onClose: () => void;
  onToggle: (id: string) => void;
  /** "Equipment busy?" for the plan item at "section-item". */
  onSwap?: (loc: string, ex: Exercise, original?: Exercise) => void;
}) {
  const { t, lt, exName } = useI18n();
  const timer = useTimer();
  const steps = useMemo(() => buildSteps(plan, exOf), [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const countFor = (ex: Exercise) => setCount(entries.filter((e) => e.exerciseId === ex.id), ex);
  const setsFor = (s: Step) => (s.kind === 'ex' ? s.item.sets ?? plan.sections[s.si].circuit?.rounds : undefined);

  const isComplete = (s: Step) => {
    if (s.kind === 'check') return s.items.every((i) => day?.done?.includes(i.id));
    if (s.kind === 'ex') { const n = setsFor(s); return n != null && countFor(s.ex) >= n; }
    return false;
  };
  // Open at the first unfinished step.
  const [idx, setIdx] = useState(() => Math.max(0, steps.findIndex((s) => !isComplete(s))));
  const step = steps[Math.min(idx, steps.length - 1)];

  // Keep the screen on and hide the small rest bar while this screen is open.
  useEffect(() => {
    timer.setBarHidden(true);
    void keepAwake(true);
    return () => { timer.setBarHidden(false); void keepAwake(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => { setIdx(Math.max(0, Math.min(steps.length - 1, i))); window.scrollTo(0, 0); };

  /** Rest before moving on to step i: the recommended rest before that exercise. */
  const restBefore = (i: number) => {
    const s = steps[i];
    return s?.kind === 'ex' ? recommendedRest(s.ex).next : 0;
  };
  const rest = (seconds: number) => { if (seconds > 0) timer.startRest(seconds); };

  /** After a set: move through supersets/circuits and start the right rest. */
  const afterSet = (s: Extract<Step, { kind: 'ex' }>) => {
    const count = countFor(s.ex) + 1;
    const sets = setsFor(s);
    const g = s.group;
    if (g && s.groupKind) {
      const pos = g.indexOf(idx);
      if (pos < g.length - 1) return go(g[pos + 1]); // no rest inside a superset/circuit round
      const first = steps[g[0]] as Extract<Step, { kind: 'ex' }>;
      const firstDone = (g[0] === idx ? count : countFor(first.ex)) >= (setsFor(first) ?? 1);
      if (firstDone) {
        const nextIdx = g[g.length - 1] + 1;
        rest(restBefore(nextIdx));
        return go(nextIdx);
      }
      rest(s.groupKind === 'circuit' ? plan.sections[s.si].circuit!.rest : s.item.rest ?? recommendedRest(s.ex).set);
      return go(g[0]);
    }
    if (sets != null && count >= sets) {
      rest(restBefore(idx + 1));
      go(idx + 1);
    } else {
      rest(s.item.rest ?? recommendedRest(s.ex).set);
    }
  };

  const section = step.kind === 'done' ? undefined : plan.sections[step.si];
  const nextStep = steps[idx];
  const nextName = nextStep?.kind === 'ex' ? exName(nextStep.ex) : nextStep?.kind === 'check' ? lt(plan.sections[nextStep.si].title) : t.workoutDone;

  return (
    <div className="focus" role="dialog" aria-label={lt(plan.name)}>
      <header className="focus-head">
        <button className="icon-btn" aria-label={t.close} onClick={onClose}>×</button>
        <div className="focus-title">
          <span>{t.step} {Math.min(idx + 1, steps.length - 1)} / {steps.length - 1}</span>
          <strong>{section ? lt(section.title) : lt(plan.name)}</strong>
        </div>
        <span className="icon-btn ghost-space" />
      </header>
      <div className="focus-progress"><div style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} /></div>

      <main className="focus-body">
        {timer.rest && (
          <section className="focus-rest" role="timer">
            <Ring value={timer.left / timer.rest.total} size={220} stroke={12} className={timer.rest.pausedLeft != null ? 'ring-paused' : ''}>
              <span className="focus-rest-label">{timer.rest.pausedLeft != null ? t.paused : t.restTimer}</span>
              <strong>{fmtClock(timer.left)}</strong>
            </Ring>
            <div className="rest-controls">
              <button className="ghost" onClick={() => timer.adjust(-15)}>−15</button>
              <button className="ghost" onClick={timer.togglePause}>{timer.rest.pausedLeft != null ? `▶ ${t.resume}` : `❚❚ ${t.pause}`}</button>
              <button className="ghost" onClick={() => timer.adjust(15)}>+15</button>
            </div>
            <button className="primary wide" onClick={timer.stopRest}>{t.skip}</button>
            <p className="focus-next">{t.nextUp}: <b>{nextName}</b></p>
          </section>
        )}

        {step.kind === 'check' && (
          <section className="focus-check">
            {step.items.map((i) => {
              const on = day?.done?.includes(i.id);
              return (
                <label key={i.id} className={on ? 'check big on' : 'check big'}>
                  <input type="checkbox" checked={!!on} onChange={() => onToggle(i.id)} />
                  <span>{lt(i.text)}</span>
                </label>
              );
            })}
            <button className="primary wide" onClick={() => go(idx + 1)}>{t.checklistNext} ›</button>
          </section>
        )}

        {step.kind === 'ex' && (
          <ExerciseStep
            key={idx}
            step={step}
            sets={setsFor(step)}
            date={date}
            entries={entries.filter((e) => e.exerciseId === step.ex.id)}
            resting={!!timer.rest}
            onLogged={() => afterSet(step)}
            onNext={() => go(idx + 1)}
            groupPos={step.group ? step.group.indexOf(idx) : -1}
            original={(step.item as SwappedItem).from ? exOf((step.item as SwappedItem).from!) : undefined}
            onSwap={onSwap && step.ex.key ? () => {
              const from = (step.item as SwappedItem).from;
              onSwap(`${step.si}-${plan.sections[step.si].items.indexOf(step.item)}`, step.ex, from ? exOf(from) : undefined);
            } : undefined}
          />
        )}

        {step.kind === 'done' && (
          <section className="focus-done">
            <div className="focus-done-icon" aria-hidden="true">✓</div>
            <h2>{t.workoutDone}</h2>
            <WorkoutSummary date={date} entries={entries} />
            <button className="primary wide" onClick={onClose}>{t.finish}</button>
          </section>
        )}
      </main>

      <footer className="focus-foot">
        <button className="ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>‹ {t.prev}</button>
        <button className="ghost" disabled={step.kind === 'done'} onClick={() => go(idx + 1)}>{t.next} ›</button>
      </footer>
    </div>
  );
}

function ExerciseStep({ step, sets, date, entries, resting, onLogged, onNext, groupPos, onSwap, original }: {
  step: Extract<Step, { kind: 'ex' }>;
  sets: number | undefined;
  date: string;
  entries: Entry[];
  resting: boolean;
  onLogged: () => void;
  onNext: () => void;
  groupPos: number;
  onSwap?: () => void;
  original?: Exercise;
}) {
  const { t, exName, fmtDate, fill } = useI18n();
  const { describe, target } = useExerciseFormat();
  const { ex, item } = step;
  const logger = useSetLogger(ex, date, entries, item, onLogged);
  const [info, setInfo] = useState(false);
  const move = ex.key ? MOVES[ex.key] : undefined;
  const targets = ex.key ? MUSCLES[ex.key] : undefined;
  const n = setCount(entries, ex);
  const done = sets != null && n >= sets;
  const current = Math.min(n + 1, sets ?? n + 1);

  return (
    <section className="focus-ex">
      {!resting && move && <ExerciseAnim move={move} targets={targets} label={exName(ex)} big />}
      <div className="focus-name">
        {step.groupKind && step.group && (
          <span className="badge">
            {step.groupKind === 'superset' ? t.superset : t.round} {step.groupKind === 'superset' ? `${groupPos + 1}/${step.group.length}` : `${current}/${sets}`}
          </span>
        )}
        <div className="focus-name-row">
          <h2>{exName(ex)}</h2>
          <button className="info-btn big" aria-label={t.aboutExercise} onClick={() => setInfo(true)}>i</button>
        </div>
        <p className="target">{target(item)}</p>
        {original && <p className="swapped-note">⇄ {fill(t.insteadOf, { x: exName(original) })}</p>}
      </div>

      {sets != null && (
        <div className="set-dots" aria-label={`${t.setWord} ${current} ${t.ofWord} ${sets}`}>
          {Array.from({ length: sets }, (_, i) => <span key={i} className={i < n ? 'on' : i === n ? 'cur' : ''} />)}
          <span className="set-dots-label">{done ? t.allSetsDone : `${t.setWord} ${current} ${t.ofWord} ${sets}`}</span>
        </div>
      )}

      {logger.previous && logger.previous.length > 0 && (
        <p className="hint">{t.lastTime} ({fmtDate(logger.previous[0].date)}): {logger.previous.map((e) => describe(e, ex)).join(', ')}</p>
      )}

      {onSwap && !done && n === 0 && <button className="swap-link" onClick={onSwap}>⇄ {t.equipBusy}</button>}
      {ex.unilateral && !done && <p className="side-hint">{t.sidesShortHint}</p>}
      {done
        ? <button className="primary wide" onClick={onNext}>{t.next} ›</button>
        : <SetInputs exercise={ex} logger={logger} item={item} big addLabel={t.logSet} />}

      <SetList exercise={ex} entries={entries} />
      {info && <ExerciseInfo exercise={ex} planRest={item.rest} onClose={() => setInfo(false)} />}
    </section>
  );
}
