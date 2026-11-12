import { useRef, useState } from 'react';
import { fmtClock, getDefaultRest, setDefaultRest } from '../timer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportData, importData, todayISO } from '../db';
import { useI18n } from '../i18n';

export function SettingsView() {
  const { t, lang, setLang, exName, lt } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const custom = useLiveQuery(() => db.exercises.filter((e) => !e.key).toArray());
  const plans = useLiveQuery(() => db.plans.toArray());
  const [rest, setRest] = useState(getDefaultRest);

  const deletePlan = async (id: number) => {
    if (!confirm(t.confirmDeletePlan)) return;
    await db.transaction('rw', db.plans, db.days, async () => {
      await db.plans.delete(id);
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
          {[0, 60, 90, 120, 180].map((s) => (
            <button key={s} className={rest === s ? 'on' : ''} onClick={() => { setDefaultRest(s); setRest(s); }}>
              {s ? fmtClock(s) : t.off}
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
