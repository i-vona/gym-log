import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './i18n';
import { beep, finishedSignal, keepAwake, unlockAudio } from './sound';

interface Rest {
  endAt: number;
  total: number;
}

interface TimerApi {
  startRest: (seconds: number) => void;
  stopRest: () => void;
}

const Ctx = createContext<TimerApi | null>(null);

const REST_KEY = 'defaultRest';

/** Rest after sets of exercises that aren't in a plan (0 = off). Per-device preference. */
// eslint-disable-next-line react-refresh/only-export-components
export function getDefaultRest(): number {
  try {
    const v = localStorage.getItem(REST_KEY);
    return v == null ? 90 : Number(v) || 0;
  } catch { return 90; }
}
// eslint-disable-next-line react-refresh/only-export-components
export function setDefaultRest(s: number) {
  try { localStorage.setItem(REST_KEY, String(s)); } catch { /* ignore */ }
}

// eslint-disable-next-line react-refresh/only-export-components
export function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(Date.now());
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const startRest = useCallback((seconds: number) => {
    unlockAudio();
    setDoneAt(null);
    setRest({ endAt: Date.now() + seconds * 1000, total: seconds });
    void keepAwake(true);
  }, []);

  const stopRest = useCallback(() => {
    setRest(null);
    setDoneAt(null);
    void keepAwake(false);
  }, []);

  useEffect(() => {
    if (!rest && !doneAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest, doneAt]);

  // Countdown beeps for the last 3 seconds, then the finish signal.
  const left = rest ? (rest.endAt - now) / 1000 : 0;
  const whole = Math.ceil(left);
  useEffect(() => {
    if (!rest) return;
    if (left <= 0) {
      finishedSignal();
      setRest(null);
      setDoneAt(Date.now());
      void keepAwake(false);
    } else if (whole <= 3) {
      beep(660, 90);
    }
  }, [whole <= 0 ? 0 : whole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide the "rest over" message after a few seconds.
  useEffect(() => {
    if (doneAt && now - doneAt > 4000) setDoneAt(null);
  }, [now, doneAt]);

  const adjust = (d: number) =>
    setRest((r) => (r ? { endAt: Math.max(Date.now() + 1000, r.endAt + d * 1000), total: Math.max(1, r.total + d) } : r));

  return (
    <Ctx.Provider value={{ startRest, stopRest }}>
      {children}
      {(rest || doneAt) && (
        <div className={rest ? 'rest-bar' : 'rest-bar rest-done'} role="timer" aria-live="polite">
          {rest ? (
            <>
              <div className="rest-progress" style={{ width: `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%` }} />
              <button className="rest-adj" onClick={() => adjust(-15)}>−15</button>
              <div className="rest-main">
                <span>{t.restTimer}</span>
                <strong>{fmtClock(left)}</strong>
              </div>
              <button className="rest-adj" onClick={() => adjust(15)}>+15</button>
              <button className="rest-adj" onClick={stopRest}>{t.skip}</button>
            </>
          ) : (
            <button className="rest-main" onClick={stopRest}><strong>{t.restDone}</strong></button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTimer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTimer outside provider');
  return c;
}
