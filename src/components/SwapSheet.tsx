import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db';
import { useI18n } from '../i18n';
import { alternatives, userEquipment } from '../swap';

/** "Equipment busy?": pick an alternative for the same main muscle. Nothing changes until you choose. */
export function SwapSheet({ exercise, original, onPick, onRestore, onClose }: {
  exercise: Exercise;
  /** Set when this exercise already replaced another one today. */
  original?: Exercise;
  onPick: (ex: Exercise) => void;
  onRestore?: () => void;
  onClose: () => void;
}) {
  const { t, exName, muscleName, fill } = useI18n();
  const data = useLiveQuery(async () => ({ all: await db.exercises.toArray(), equip: await userEquipment() }));
  const base = original ?? exercise;
  const alts = data ? alternatives(base, data.all, data.equip).filter((a) => a.ex.id !== exercise.id) : [];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.swapTitle}>
        <header className="card-head">
          <h2>{t.swapTitle}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>
        </header>
        <p className="hint">{t.swapHint}</p>
        {original && onRestore && (
          <button className="ghost wide" onClick={onRestore}>↺ {t.useOriginal}: {exName(original)}</button>
        )}
        {data && (alts.length ? (
          <div className="pick-list">
            {alts.map((a) => (
              <button key={a.ex.id} className="pick-item" onClick={() => onPick(a.ex)}>
                {exName(a.ex)}
                <span className="pick-sub muted">
                  {a.sameMovement ? `${t.sameMovement} · ` : ''}{t.sameMuscle}: {a.shared.map(muscleName).join(', ')}
                </span>
              </button>
            ))}
          </div>
        ) : <p className="empty">{t.noAlternatives}</p>)}
        {original && <p className="hint small-print">{fill(t.insteadOf, { x: exName(original) })}</p>}
      </div>
    </div>
  );
}
