import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db';
import { useI18n } from '../i18n';
import { MOVES } from '../anim/moves';
import { MUSCLES } from '../anim/muscles';
import { bestEntry, useExerciseFormat } from '../exerciseFormat';
import { ExerciseAnim, MuscleChips } from './ExerciseAnim';

const CROSSOVER_STUDY = 'https://pure.solent.ac.uk/en/publications/non-local-muscle-fatigue-effects-on-muscle-strength-power-and-end-2/';

/** Full page about one exercise: animation, muscles, left/right advice, your results, video. */
export function ExerciseInfo({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t, exName, fmtDate } = useI18n();
  const { describe } = useExerciseFormat();
  const move = exercise.key ? MOVES[exercise.key] : undefined;
  const targets = exercise.key ? MUSCLES[exercise.key] : undefined;

  const stats = useLiveQuery(async () => {
    const all = await db.entries.where('exerciseId').equals(exercise.id!).sortBy('date');
    if (!all.length) return null;
    const lastDate = all[all.length - 1].date;
    return {
      sessions: new Set(all.map((e) => e.date)).size,
      last: all.filter((e) => e.date === lastDate),
      best: bestEntry(all, exercise),
    };
  }, [exercise.id]);

  // Close with the phone's back gesture / browser back.
  useEffect(() => {
    history.pushState({ exercisePage: true }, '');
    const onPop = () => onClose();
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => history.back();

  return (
    <div className="page" role="dialog" aria-label={exName(exercise)}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={close}>‹</button>
        <h1>{exName(exercise)}</h1>
      </header>
      <main className="page-body">
        {move ? <ExerciseAnim move={move} targets={targets} label={t.howTo} big /> : <p className="hint">{t.noAnim}</p>}

        {targets && (
          <section className="card">
            <h2>{t.musclesWorked}</h2>
            <MuscleChips targets={targets} />
          </section>
        )}

        {exercise.unilateral && (
          <section className="card">
            <h2>{t.sidesTitle}</h2>
            <ul className="advice">
              <li>{t.sidesAdvice1}</li>
              <li>{t.sidesAdvice2}</li>
            </ul>
            <p className="hint">{t.sidesWhy}</p>
            <a className="link-btn" href={CROSSOVER_STUDY} target="_blank" rel="noreferrer">{t.sidesSource} ↗</a>
          </section>
        )}

        <section className="card">
          <h2>{t.myResults}</h2>
          {stats ? (
            <ul className="records">
              <li><span>{t.lastTime}</span><strong>{fmtDate(stats.last[0].date)}</strong><span className="muted">{stats.last.map((e) => describe(e, exercise)).join(', ')}</span></li>
              <li><span>{t.bestSet}</span><strong>{describe(stats.best, exercise)}</strong><span className="muted">{fmtDate(stats.best.date)}</span></li>
              <li><span>{t.sessions}</span><strong>{stats.sessions}</strong><span /></li>
            </ul>
          ) : <p className="hint">{t.noEntriesYet}</p>}
        </section>

        <VideoLink exercise={exercise} />
      </main>
    </div>
  );
}

export function VideoLink({ exercise }: { exercise: Exercise }) {
  const { t, enName } = useI18n();
  const query = encodeURIComponent(`${enName(exercise)} exercise proper form`);
  return (
    <a className="ghost wide link-as-btn" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer">
      ▶ {t.watchVideo}
    </a>
  );
}
