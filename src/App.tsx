import { useState, type ReactNode } from 'react';
import { useI18n } from './i18n';
import { todayISO } from './db';
import { WorkoutView } from './views/WorkoutView';
import { HistoryView } from './views/HistoryView';
import { ProgressView } from './views/ProgressView';
import { BodyView } from './views/BodyView';
import { SettingsView } from './views/SettingsView';

type Tab = 'workout' | 'history' | 'progress' | 'body' | 'settings';

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const ICONS: Record<Tab, ReactNode> = {
  workout: icon(<><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" /></>),
  history: icon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>),
  progress: icon(<><path d="M3 20h18" /><path d="M4 16l5-5 4 3 7-8" /></>),
  body: icon(<><circle cx="12" cy="13" r="8" /><path d="M12 13l3-3M8 6.5L9 9" /></>),
  settings: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
};

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>('workout');
  const [date, setDate] = useState(todayISO());

  const labels: Record<Tab, string> = {
    workout: t.tabWorkout, history: t.tabHistory, progress: t.tabProgress, body: t.tabBody, settings: t.tabSettings,
  };

  return (
    <div className="app">
      <header className="top">
        <h1>{labels[tab]}</h1>
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'hr' : 'en')} aria-label={t.language}>
          <span className={lang === 'en' ? 'on' : ''}>EN</span>
          <span className={lang === 'hr' ? 'on' : ''}>HR</span>
        </button>
      </header>

      <main>
        {tab === 'workout' && <WorkoutView date={date} setDate={setDate} />}
        {tab === 'history' && <HistoryView openDay={(d) => { setDate(d); setTab('workout'); }} />}
        {tab === 'progress' && <ProgressView />}
        {tab === 'body' && <BodyView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav className="tabs">
        {(Object.keys(ICONS) as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); window.scrollTo(0, 0); }} aria-current={tab === k ? 'page' : undefined}>
            {ICONS[k]}
            <span>{labels[k]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
