import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useI18n } from '../i18n';

export function PlanPicker({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  const { t, lt } = useI18n();
  const plans = useLiveQuery(() => db.plans.filter((p) => !p.generated).toArray());

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.choosePlan}>
        <header className="card-head">
          <h2>{t.choosePlan}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>×</button>
        </header>
        <div className="pick-list">
          {plans?.length === 0 && <p className="empty">{t.plansEmpty}</p>}
          {plans?.map((p) => (
            <button key={p.id} className="pick-item" onClick={() => onPick(p.id!)}>
              <strong>{lt(p.name)}</strong>
              <span className="muted pick-sub">{p.sections.map((s) => lt(s.title)).join(' · ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
