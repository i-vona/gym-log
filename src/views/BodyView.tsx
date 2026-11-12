import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, parseNum, todayISO } from '../db';
import { useI18n } from '../i18n';
import { Chart } from '../components/Chart';

export function BodyView() {
  const { t, fmtDate, fmtNum } = useI18n();
  const rows = useLiveQuery(() => db.body.orderBy('date').toArray());
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState('');

  const save = async () => {
    const v = parseNum(kg);
    if (v == null || v <= 0) return;
    const existing = await db.body.where('date').equals(date).first();
    await db.body.put({ id: existing?.id, date, kg: v });
    setKg('');
  };

  if (!rows) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = first && last ? last.kg - first.kg : 0;

  return (
    <div className="view">
      <section className="card">
        <h2>{t.bodyWeight}</h2>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>
            <span>{t.date}</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label>
            <span>{t.kg}</span>
            <input inputMode="decimal" value={kg} placeholder={last ? String(last.kg) : ''} onChange={(e) => setKg(e.target.value)} />
          </label>
          <button className="primary" disabled={!parseNum(kg)}>{t.save}</button>
        </form>
      </section>

      {rows.length === 0 ? <p className="empty">{t.bodyEmpty}</p> : (
        <>
          <div className="stats">
            <div className="stat"><strong>{fmtNum(last.kg)} kg</strong><span>{t.latest}</span></div>
            <div className="stat">
              <strong>{diff > 0 ? '+' : ''}{fmtNum(diff)} kg</strong>
              <span>{t.change} {t.sinceStart}</span>
            </div>
          </div>
          {rows.length >= 2 && (
            <section className="card">
              <Chart
                points={rows.map((r) => ({ date: r.date, value: r.kg }))}
                format={(v) => `${fmtNum(v)} kg`}
                fmtDate={(d) => fmtDate(d, { day: 'numeric', month: 'short' })}
              />
            </section>
          )}
          <section className="card">
            <ol className="sets">
              {[...rows].reverse().map((r) => (
                <li key={r.id}>
                  <span className="set-val">{fmtDate(r.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <strong>{fmtNum(r.kg)} kg</strong>
                  <button className="icon-btn small" aria-label={t.delete} onClick={() => confirm(t.confirmDelete) && db.body.delete(r.id!)}>×</button>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
