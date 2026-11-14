import { useRef, useState } from 'react';
import { fmtClock, getDefaultRest, setDefaultRest } from '../timer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportData, importData, todayISO } from '../db';
import { useI18n } from '../i18n';
import { EMPTY_SCHEDULE, getSchedule, setScheduleDay } from '../schedule';

export function SettingsView() {
  const { t, lang, setLang, exName, lt, fmtDate } = useI18n();
  const schedule = useLiveQuery(getSchedule);
  // 2024-01-01 was a Monday.
  const weekdayName = (i: number) => fmtDate('2024-01-0' + (i + 1), { weekday: 'long' });
  const fileRef = useRef<HTMLInputElement>(null);
  const custom = useLiveQuery(() => db.exercises.filter((e) => !e.key).toArray());
  const plans = useLiveQuery(() => db.plans.filter((p) => !p.generated).toArray());
  const [rest, setRest] = useState(getDefaultRest);

  const deletePlan = async (id: number) => {
    if (!confirm(t.confirmDeletePlan)) return;
    await db.transaction('rw', db.plans, db.days, db.meta, async () => {
      await db.plans.delete(id);
      const sch = await getSchedule();
      if (sch.includes(id)) await db.meta.put({ key: 'schedule', value: sch.map((x) => (x === id ? null : x)) });
      await db.days.where('date').above('').modify((d) => { if (d.planId === id) d.planId = undefined; });
    });
  };

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportData(), null, 1)], { type: 'application/json' });
    const name = `gym-log-${todayISO()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    // On phones, the share sheet lets you save to Drive, send to yourself, etc.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch { /* cancelled: fall back */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm(t.importConfirm)) return;
      await importData(data);
      alert(t.importDone);
    } catch {
      alert(t.importFail);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteExercise = async (id: number) => {
    if (await db.entries.where('exerciseId').equals(id).count()) return alert(t.cantDelete);
    if (confirm(t.confirmDeleteExercise)) await db.exercises.delete(id);
  };

  return (
    <div className="view">
      <section className="card">
        <h2>{t.language}</h2>
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'hr' ? 'on' : ''} onClick={() => setLang('hr')}>Hrvatski</button>
        </div>
      </section>

      <section className="card">
        <h2>{t.defaultRest}</h2>
        <p className="hint">{t.defaultRestHint}</p>
        <div className="seg">
          {[-1, 0, 60, 90, 120, 180].map((s) => (
            <button key={s} className={rest === s ? 'on' : ''} onClick={() => { setDefaultRest(s); setRest(s); }}>
              {s < 0 ? t.recommended : s ? fmtClock(s) : t.off}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t.backup}</h2>
        <p className="hint">{t.backupHint}</p>
        <div className="row-end">
          <button className="ghost" onClick={() => fileRef.current?.click()}>{t.import}</button>
          <button className="primary" onClick={doExport}>{t.export}</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
      </section>

      <section className="card">
        <h2>{t.plans}</h2>
        {plans?.length ? (
          <ol className="sets">
            {plans.map((p) => (
              <li key={p.id}>
                <span className="set-val">{lt(p.name)}</span>
                <button className="icon-btn small" aria-label={t.delete} onClick={() => deletePlan(p.id!)}>×</button>
              </li>
            ))}
          </ol>
        ) : <p className="hint">{t.plansEmpty}</p>}
      </section>

      <section className="card">
        <h2>{t.schedule}</h2>
        <p className="hint">{t.scheduleHint}</p>
        <ul className="schedule">
          {(schedule ?? EMPTY_SCHEDULE).map((planId, i) => (
            <li key={i}>
              <span>{weekdayName(i)}</span>
              <select
                value={planId ?? ''}
                onChange={(e) => void setScheduleDay(i, e.target.value ? Number(e.target.value) : null)}
                aria-label={weekdayName(i)}
              >
                <option value="">{t.restDay}</option>
                {plans?.map((p) => <option key={p.id} value={p.id}>{lt(p.name)}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t.myExercises}</h2>
        {custom?.length ? (
          <ol className="sets">
            {custom.map((e) => (
              <li key={e.id}>
                <span className="set-val">{exName(e)}</span>
                <span className="muted">{t[e.type]}</span>
                <button className="icon-btn small" aria-label={t.delete} onClick={() => deleteExercise(e.id!)}>×</button>
              </li>
            ))}
          </ol>
        ) : <p className="hint">{t.myExercisesEmpty}</p>}
      </section>
    </div>
  );
}
