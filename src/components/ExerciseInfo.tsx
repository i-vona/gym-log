import type { Exercise } from '../db';
import { useI18n } from '../i18n';
import { MOVES } from '../anim/moves';
import { ExerciseAnim } from './ExerciseAnim';

/** Sheet with the animation and a link to search for a video of the exercise. */
export function ExerciseInfo({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { t, exName, enName } = useI18n();
  const move = exercise.key ? MOVES[exercise.key] : undefined;
  const query = encodeURIComponent(`${enName(exercise)} exercise proper form`);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={exName(exercise)}>
        <header className="card-head">
          <h2>{exName(exercise)}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>
        </header>
        {move ? <ExerciseAnim move={move} label={t.howTo} /> : <p className="hint">{t.noAnim}</p>}
        {move && <p className="hint center-text">{t.animHint}</p>}
        <a className="ghost wide link-as-btn" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer">
          ▶ {t.watchVideo}
        </a>
      </div>
    </div>
  );
}
