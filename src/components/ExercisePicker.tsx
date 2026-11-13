import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, EXERCISE_TYPES, type ExerciseType } from '../db';
import { useI18n } from '../i18n';

export function ExercisePicker({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  const { t, exName } = useI18n();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<ExerciseType>('strength');
  const [oneSide, setOneSide] = useState(false);

  const exercises = useLiveQuery(() => db.exercises.toArray());
  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const filtered = (exercises ?? [])
    .filter((e) => norm(exName(e)).includes(norm(q.trim())))
    .sort((a, b) => exName(a).localeCompare(exName(b)));

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    const id = await db.exercises.add({ name, type, unilateral: type !== 'cardio' && oneSide });
    onPick(id as number);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.addExercise}>
        <header className="card-head">
          <h2>{creating ? t.newExercise : t.addExercise}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>
        </header>
        <input
          className="search"
          autoFocus
          placeholder={creating ? t.name : t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {creating ? (
          <>
            <div className="seg">
              {EXERCISE_TYPES.map((ty) => (
                <button key={ty} className={type === ty ? 'on' : ''} onClick={() => setType(ty)}>{t[ty]}</button>
              ))}
            </div>
            {type !== 'cardio' && (
              <label className="check">
                <input type="checkbox" checked={oneSide} onChange={(e) => setOneSide(e.target.checked)} />
                <span>{t.oneSide}</span>
              </label>
            )}
            <div className="row-end">
              <button className="ghost" onClick={() => setCreating(false)}>{t.cancel}</button>
              <button className="primary" disabled={!q.trim()} onClick={create}>{t.create}</button>
            </div>
          </>
        ) : (
          <>
            <div className="pick-list">
              {EXERCISE_TYPES.map((ty) => {
                const list = filtered.filter((e) => e.type === ty);
                if (!list.length) return null;
                return (
                  <div key={ty}>
                    <h3 className="group-title">{t[ty]}</h3>
                    {list.map((e) => (
                      <button key={e.id} className="pick-item" onClick={() => onPick(e.id!)}>{exName(e)}</button>
                    ))}
                  </div>
                );
              })}
            </div>
            <button className="ghost wide" onClick={() => setCreating(true)}>+ {t.newExercise}{q.trim() ? `: “${q.trim()}”` : ''}</button>
          </>
        )}
      </div>
    </div>
  );
}
