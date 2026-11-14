import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db';
import { useI18n } from '../i18n';
import { MUSCLES } from '../anim/muscles';
import type { Muscle } from '../anim/figure';
import { MAP_MUSCLES } from '../analytics';
import { metaOf, type Equip } from '../generator';
import { useBackClose } from '../useBack';
import { ExerciseInfo } from './ExerciseInfo';

const EQUIPS: Equip[] = ['gym', 'db', 'kb', 'band', 'none'];

/** Browse every exercise: search by name, filter by muscle and equipment. */
export function ExerciseLibrary({ onClose, muscle: initialMuscle }: { onClose: () => void; muscle?: Muscle }) {
  const { t, exName, muscleName } = useI18n();
  useBackClose(onClose);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(initialMuscle ?? null);
  const [equip, setEquip] = useState<Equip | null>(null);
  const [info, setInfo] = useState<Exercise | null>(null);

  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const query = norm(q.trim());
  const list = (exercises ?? [])
    .filter((e) => {
      const tg = e.key ? MUSCLES[e.key] : undefined;
      const meta = metaOf(e.key);
      if (muscle && !tg?.p.includes(muscle)) return false;
      // "Gym" = machines, cables and barbells; the other chips match their own equipment.
      if (equip && meta?.eq !== equip) return false;
      if (!query) return true;
      // Search by name or by muscle name.
      return norm(exName(e)).includes(query) || [...(tg?.p ?? []), ...(tg?.s ?? [])].some((m) => m !== 'cardio' && norm(muscleName(m)).includes(query));
    })
    .sort((a, b) => exName(a).localeCompare(exName(b)));

  return (
    <div className="page" role="dialog" aria-label={t.library}>
      <header className="page-head">
        <button className="icon-btn" aria-label={t.close} onClick={() => history.back()}>‹</button>
        <h1>{t.library}</h1>
      </header>
      <main className="page-body">
        <input className="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chip-scroll">
          <button className={!muscle ? 'chip-btn on' : 'chip-btn'} onClick={() => setMuscle(null)}>{t.allMuscles}</button>
          {MAP_MUSCLES.map(({ m }) => (
            <button key={m} className={muscle === m ? 'chip-btn on' : 'chip-btn'} onClick={() => setMuscle(muscle === m ? null : m)}>{muscleName(m)}</button>
          ))}
        </div>
        <div className="chip-scroll">
          <button className={!equip ? 'chip-btn on' : 'chip-btn'} onClick={() => setEquip(null)}>{t.anyEquipment}</button>
          {EQUIPS.map((e) => (
            <button key={e} className={equip === e ? 'chip-btn on' : 'chip-btn'} onClick={() => setEquip(equip === e ? null : e)}>{t[`libEquip_${e}`]}</button>
          ))}
        </div>
        {list.length ? (
          <div className="lib-list">
            {list.map((e) => {
              const tg = e.key ? MUSCLES[e.key] : undefined;
              const meta = metaOf(e.key);
              return (
                <button key={e.id} className="lib-item" onClick={() => setInfo(e)}>
                  <span className="lib-name">{exName(e)}</span>
                  <span className="lib-sub">
                    {tg?.p.filter((m) => m !== 'cardio').map(muscleName).join(', ')}
                    {meta ? ` · ${t[`libEquip_${meta.eq}`]} · ${t[`level_${meta.lvl}`]}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        ) : <p className="empty">{t.noResults}</p>}
      </main>
      {info && <ExerciseInfo exercise={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
