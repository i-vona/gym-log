// Short beeps and vibration for timers. Browsers only allow sound after the user has
// tapped something, so call unlockAudio() from a click handler first.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio available */ }
}

export function beep(freq = 880, ms = 160, delay = 0) {
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + delay / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

/** Signal that a timer finished: three beeps + vibration. */
export function finishedSignal() {
  beep(880, 150, 0);
  beep(880, 150, 220);
  beep(1320, 300, 440);
  vibrate([200, 100, 200, 100, 300]);
}

/** Keeps the screen on while a timer runs (where supported). */
let lock: WakeLockSentinel | null = null;
export async function keepAwake(on: boolean) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { /* not allowed (e.g. page hidden) */ }
}
