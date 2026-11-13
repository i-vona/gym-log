import type { Exercise } from '../db';
import { useI18n } from '../i18n';
import { MOVES } from '../anim/moves';
import { MUSCLES } from '../anim/muscles';
import { ExerciseAnim, MuscleChips } from './ExerciseAnim';

/** Sheet with the animation, worked muscles and a link to search for a video. */
export function ExerciseInfo({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t, exName } = useI18n();
  const move = exercise.key ? MOVES[exercise.key] : undefined;
  const targets = exercise.key ? MUSCLES[exercise.key] : undefined;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={exName(exercise)}>
        <header className="card-head">
          <h2>{exName(exercise)}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>
        </header>
        {move ? <ExerciseAnim move={move} targets={targets} label={t.howTo} /> : <p className="hint">{t.noAnim}</p>}
        {targets && (
          <section className="info-section">
            <h3 className="group-title">{t.musclesWorked}</h3>
            <MuscleChips targets={targets} />
          </section>
        )}
        <VideoLink exercise={exercise} />
      </div>
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
