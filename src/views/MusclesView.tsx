import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db';
import { useI18n } from '../i18n';
import type { Cls, Muscle } from '../anim/figure';
import { MUSCLES } from '../anim/muscles';
import {
  heatLevel, MAP_MUSCLES, muscleStats, observations, periodRange, PERIODS, weeklySets,
  type MuscleStat, type Observation, type Period,
} from '../analytics';
import { HeatLegend, MuscleMap } from '../components/MuscleMap';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { useBackClose } from '../useBack';

const PERIOD_KEY = 'musclePeriod';

function savedPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY) as Period | null;
    return v && PERIODS.includes(v) ? v : '7';
  } catch { return '7'; }
}

/** Muscle analytics: front/back map coloured by direct sets, tap a muscle for details. */
export function MusclesView() {
  const { t, muscleName, fmtDate, fill } = useI18n();
  const entries = useLiveQuery(() => db.entries.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const exById = useMemo(() => new Map(exercises?.map((e) => [e.id!, e])), [exercises]);
  const [period, setPeriodState] = useState<Period>(savedPeriod);
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [detail, setDetail] = useState<Muscle | null>(null);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try { localStorage.setItem(PERIOD_KEY, p); } catch { /* ignore */ }
  };

  const { from, days } = periodRange(period);
  const stats = useMemo(() => (entries ? muscleStats(entries, exById, from) : new Map<Muscle, MuscleStat>()), [entries, exById, from]);
  const obs = useMemo(() => (entries ? observations(entries, exById) : []), [entries, exById]);
  const paint = useCallback((m: Muscle): Cls => {
    const lv = heatLevel(stats.get(m)?.direct ?? 0, days);
    return lv ? (`h${lv}` as Cls) : 'mu';
  }, [stats, days]);

  if (!entries || !exercises) return null;
  const hasCustom = exercises.some((e) => !e.key) && entries.some((e) => !exById.get(e.exerciseId)?.key);
  const sel = selected ? stats.get(selected) : undefined;
  const list = MAP_MUSCLES
    .map(({ m }) => ({ m, st: stats.get(m) }))
    .sort((a, b) => (b.st?.direct ?? 0) - (a.st?.direct ?? 0) || (b.st?.indirect ?? 0) - (a.st?.indirect ?? 0));
  const maxDirect = Math.max(1, ...list.map((x) => x.st?.direct ?? 0));

  const obsText = (o: Observation) => {
    const names = (ms: Muscle[]) => ms.map(muscleName).join(' + ');
    switch (o.k) {
      case 'notRecently': return fill(t.obsNotRecently, { m: muscleName(o.m), d: o.days });
      case 'lower': return fill(t.obsLower, { a: names(o.a), av: o.av, b: names(o.b), bv: o.bv });
      case 'up': return fill(t.obsUp, { m: muscleName(o.m), before: o.before, now: o.now });
      case 'twice': return fill(t.obsTwice, { m: muscleName(o.m), n: o.n });
    }
  };

  return (
    <div className="view">
      <div className="seg seg-sm">
        {PERIODS.map((p) => (
          <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{t[`period_${p}`]}</button>
        ))}
      </div>

      <section className="card">
        <MuscleMap paint={paint} selected={selected} onPick={(m) => setSelected(m === selected ? null : m)} />
        {selected ? (
          <button className="mmap-summary" onClick={() => setDetail(selected)}>
            <span className="mmap-summary-name">{muscleName(selected)}</span>
            <span className="mmap-summary-vals">
              <b>{sel?.direct ?? 0}</b> {t.directSets.toLowerCase()} · {sel?.indirect ?? 0} {t.indirectShort}
              {sel?.last ? ` · ${fmtDate(sel.last)}` : ''}
            </span>
            <span className="mmap-summary-go" aria-hidden="true">›</span>
          </button>
        ) : <p className="hint center-text">{t.tapMuscle}</p>}
        <HeatLegend />
        <p className="hint small-print">{t.mapNote}</p>
      </section>

      {entries.length === 0 && <p className="empty">{t.muscleEmpty}</p>}

      {obs.length > 0 && (
        <section className="card">
          <h2>{t.observations}</h2>
          <ul className="obs">{obs.map((o, i) => <li key={i}>{obsText(o)}</li>)}</ul>
          <p className="hint small-print">{t.obsNote}</p>
        </section>
      )}

      <section className="card">
        <div className="mlist-head"><span>{t.muscles}</span><span>{t.directSets}</span><span>{t.indirectShort}</span></div>
        <ul className="mlist">
          {list.map(({ m, st }) => (
            <li key={m}>
              <button onClick={() => setDetail(m)}>
                <span className="mlist-name">{muscleName(m)}</span>
                <span className="mlist-bar"><i style={{ width: `${((st?.direct ?? 0) / maxDirect) * 100}%` }} /></span>
                <strong>{st?.direct ?? 0}</strong>
                <span className="muted">{st?.indirect ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
        {hasCustom && <p className="hint small-print">{t.customNotCounted}</p>}
      </section>

      {detail && (
        <MuscleDetail
          muscle={detail}
          period={period}
          setPeriod={setPeriod}
          exercises={exercises}
          exById={exById}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function MuscleDetail({ muscle, period, setPeriod, exercises, exById, onClose }: {
  muscle: Muscle;
  period: Period;
  setPeriod: (p: Period) => void;
  exercises: Exercise[];
  exById: Map<number, Exercise>;
  onClose: () => void;
}) {
  const { t, muscleName, exName, fmtDate } = useI18n();
  const entries = useLiveQuery(() => db.entries.toArray());
  const [info, setInfo] = useState<Exercise | null>(null);

  useBackClose(onClose);

  const { from } = periodRange(period);
  const st = useMemo(() => (entries ? muscleStats(entries, exById, from).get(muscle) : undefined), [entries, exById, from, muscle]);
  const weeks = useMemo(() => (entries ? weeklySets(entries, exById, muscle, 8) : []), [entries, exById, muscle]);
  const paint = useCallback((m: Muscle): Cls => (m === muscle ? 'h4' : 'mu'), [muscle]);

  if (!entries) return null;
  const where = MAP_MUSCLES.find((x) => x.m === muscle)?.view ?? 'front';
  const top = st ? [...st.byExercise.entries()].sort((a, b) => b[1].direct - a[1].direct || b[1].indirect - a[1].indirect).slice(0, 6) : [];

  // Recent days with sets for this muscle (direct or indirect), newest first.
  const recent = new Map<string, Set<number>>();
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    if (e.warmup || e.date < from) continue;
    const ex = exById.get(e.exerciseId);
    const tg = ex?.key ? MUSCLES[ex.key] : undefined;
    if (!tg || (!tg.p.includes(muscle) && !tg.s.includes(muscle))) continue;
    if (!recent.has(e.date)) { if (recent.size >= 5) break; recent.set(e.date, new Set()); }
    recent.get(e.date)!.add(e.exerciseId);
  }
  const suited = exercises.filter((e) => e.key && MUSCLES[e.key]?.p.includes(muscle)).sort((a, b) => exName(a).localeCompare(exName(b)));
  const maxWeek = Math.max(1, ...weeks.map((w) => Math.max(w.direct, w.indirect)));

  return (
    <div className="page" role="dialog" aria-label={muscleName(muscle)}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={() => history.back()}>‹</button>
        <h1>{muscleName(muscle)}</h1>
      </header>
      <main className="page-body">
        <div className="muscle-hero">
          <MuscleMap paint={paint} small />
          <span className="badge">{where === 'both' ? t.bothSides : where === 'front' ? t.front : t.back}</span>
        </div>

        <div className="seg seg-sm">
          {(['7', '30', '90', '180'] as Period[]).map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{t[`period_${p}`]}</button>
          ))}
        </div>

        <div className="stats">
          <div className="stat"><strong>{st?.direct ?? 0}</strong><span>{t.directSets}</span></div>
          <div className="stat stat-quiet"><strong>{st?.indirect ?? 0}</strong><span>{t.indirectSets}</span></div>
          <div className="stat"><strong>{st?.sessions.size ?? 0}</strong><span>{t.trainingDays}</span></div>
          <div className="stat"><strong>{st?.byExercise.size ?? 0}</strong><span>{t.exercisesUsed}</span></div>
        </div>
        <section className="card">
          <ul className="records">
            <li><span>{t.lastTrained}</span><strong>{st?.last ? fmtDate(st.last, { weekday: 'long', day: 'numeric', month: 'short' }) : t.notInPeriod}</strong></li>
          </ul>
          <p className="hint small-print">{t.directHint} {t.indirectHint}</p>
        </section>

        <section className="card">
          <h2>{t.weeklyTrend}</h2>
          <div className="wbars" role="img" aria-label={t.weeklyTrend}>
            {weeks.map((w) => (
              <div key={w.start} className="wbar">
                <span className="wbar-val">{w.direct || ''}</span>
                <div className="wbar-cols">
                  <i className="wbar-d" style={{ height: `${(w.direct / maxWeek) * 100}%` }} />
                  <i className="wbar-i" style={{ height: `${(w.indirect / maxWeek) * 100}%` }} />
                </div>
                <span className="wbar-lab">{fmtDate(w.start, { day: 'numeric', month: 'numeric' })}</span>
              </div>
            ))}
          </div>
          <div className="wbar-legend">
            <span><i className="wbar-d" />{t.directSets}</span>
            <span><i className="wbar-i" />{t.indirectSets}</span>
          </div>
        </section>

        <section className="card">
          <h2>{t.topExercises}</h2>
          {top.length ? (
            <ul className="records">
              {top.map(([id, v]) => (
                <li key={id}>
                  <span>{exName(exById.get(id))}</span>
                  <strong>{v.direct ? `${v.direct} ${t.sets.toLowerCase()}` : ''}{v.direct && v.indirect ? ' · ' : ''}{v.indirect ? `${v.indirect} ${t.indirectShort}` : ''}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="hint">{t.noMuscleData}</p>}
        </section>

        {recent.size > 0 && (
          <section className="card">
            <h2>{t.recentSessions}</h2>
            <ul className="records">
              {[...recent.entries()].map(([date, ids]) => (
                <li key={date}>
                  <span>{fmtDate(date)}</span>
                  <span className="muted">{[...ids].map((id) => exName(exById.get(id))).join(', ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>{t.exercisesFor}</h2>
          <div className="pick-list flat">
            {suited.map((e) => <button key={e.id} className="pick-item" onClick={() => setInfo(e)}>{exName(e)} <span className="muted">›</span></button>)}
          </div>
        </section>
      </main>
      {info && <ExerciseInfo exercise={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
