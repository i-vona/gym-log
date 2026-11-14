import type { Entry, Exercise } from './db';
import type { Muscle } from './anim/figure';
import { MUSCLES } from './anim/muscles';

/*
 * Muscle analytics from logged sets.
 *
 * How sets are counted:
 * - A set of an exercise counts as one DIRECT set for each of the exercise's primary muscles.
 * - It counts as one INDIRECT set for each secondary (helper) muscle. Indirect sets are always
 *   shown separately, never added to direct sets.
 * - Warm-up sets and cardio sessions are not counted. One-sided exercises count a left + right
 *   pair as one set.
 * - Custom exercises have no muscle mapping, so they don't appear here.
 */

/** Muscle groups shown on the map, with the view(s) they're visible in. */
export const MAP_MUSCLES: { m: Muscle; view: 'front' | 'back' | 'both' }[] = [
  { m: 'chest', view: 'front' },
  { m: 'frontDelts', view: 'front' },
  { m: 'sideDelts', view: 'both' },
  { m: 'rearDelts', view: 'back' },
  { m: 'traps', view: 'both' },
  { m: 'upperBack', view: 'back' },
  { m: 'lats', view: 'back' },
  { m: 'lowerBack', view: 'back' },
  { m: 'biceps', view: 'front' },
  { m: 'triceps', view: 'back' },
  { m: 'forearms', view: 'both' },
  { m: 'abs', view: 'front' },
  { m: 'obliques', view: 'both' },
  { m: 'hipFlexors', view: 'front' },
  { m: 'glutes', view: 'back' },
  { m: 'quads', view: 'front' },
  { m: 'adductors', view: 'both' },
  { m: 'hamstrings', view: 'back' },
  { m: 'calves', view: 'both' },
];

export type Period = 'week' | '7' | '30' | '90' | '180';
export const PERIODS: Period[] = ['week', '7', '30', '90', '180'];

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing `d`. */
export function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** First day (inclusive) of a period ending today, and its length in days. */
export function periodRange(p: Period, today = new Date()): { from: string; days: number } {
  if (p === 'week') {
    const ws = weekStart(today);
    return { from: iso(ws), days: Math.round((today.getTime() - ws.getTime()) / 864e5) + 1 };
  }
  const n = Number(p);
  const d = new Date(today);
  d.setDate(d.getDate() - (n - 1));
  return { from: iso(d), days: n };
}

export interface MuscleStat {
  direct: number;
  indirect: number;
  /** Days with at least one direct set. */
  sessions: Set<string>;
  /** Direct/indirect sets per exercise id. */
  byExercise: Map<number, { direct: number; indirect: number }>;
  /** Most recent day with a direct set. */
  last?: string;
}

const empty = (): MuscleStat => ({ direct: 0, indirect: 0, sessions: new Set(), byExercise: new Map() });

/** Working sets per (day, exercise): a left + right pair counts once. */
export function workingSets(entries: Entry[], exById: Map<number, Exercise>) {
  const groups = new Map<string, { date: string; ex: Exercise; n: number }>();
  const sides = new Map<string, { L: number; R: number; none: number }>();
  for (const e of entries) {
    if (e.warmup) continue;
    const ex = exById.get(e.exerciseId);
    if (!ex || ex.type === 'cardio') continue;
    const k = `${e.date}|${e.exerciseId}`;
    const s = sides.get(k) ?? { L: 0, R: 0, none: 0 };
    if (e.side === 'L') s.L++; else if (e.side === 'R') s.R++; else s.none++;
    sides.set(k, s);
    groups.set(k, { date: e.date, ex, n: 0 });
  }
  for (const [k, g] of groups) {
    const s = sides.get(k)!;
    g.n = Math.max(s.L, s.R) + s.none;
  }
  return [...groups.values()];
}

export function muscleStats(entries: Entry[], exById: Map<number, Exercise>, from: string, to = '9999'): Map<Muscle, MuscleStat> {
  const out = new Map<Muscle, MuscleStat>();
  for (const g of workingSets(entries.filter((e) => e.date >= from && e.date <= to), exById)) {
    const tg = g.ex.key ? MUSCLES[g.ex.key] : undefined;
    if (!tg) continue;
    const add = (m: Muscle, kind: 'direct' | 'indirect') => {
      if (m === 'cardio') return;
      const st = out.get(m) ?? empty();
      st[kind] += g.n;
      const be = st.byExercise.get(g.ex.id!) ?? { direct: 0, indirect: 0 };
      be[kind] += g.n;
      st.byExercise.set(g.ex.id!, be);
      if (kind === 'direct') {
        st.sessions.add(g.date);
        if (!st.last || g.date > st.last) st.last = g.date;
      }
      out.set(m, st);
    };
    tg.p.forEach((m) => add(m, 'direct'));
    tg.s.forEach((m) => add(m, 'indirect'));
  }
  return out;
}

/** Map shading from direct sets per week: 0 = none, 1 = 1–2, 2 = 3–5, 3 = 6–9, 4 = 10+. */
export function heatLevel(direct: number, days: number): 0 | 1 | 2 | 3 | 4 {
  if (direct <= 0) return 0;
  const perWeek = (direct * 7) / Math.max(7, days);
  return perWeek >= 10 ? 4 : perWeek >= 6 ? 3 : perWeek >= 3 ? 2 : 1;
}

/** Direct and indirect sets for a muscle in each of the last `weeks` weeks (oldest first). */
export function weeklySets(entries: Entry[], exById: Map<number, Exercise>, m: Muscle, weeks: number, today = new Date()) {
  const ws = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() - 7 * (weeks - 1 - i));
    return iso(d);
  });
  const rows = starts.map((start) => ({ start, direct: 0, indirect: 0 }));
  for (const g of workingSets(entries.filter((e) => e.date >= starts[0]), exById)) {
    const tg = g.ex.key ? MUSCLES[g.ex.key] : undefined;
    if (!tg) continue;
    let i = rows.length - 1;
    while (i > 0 && g.date < rows[i].start) i--;
    if (tg.p.includes(m)) rows[i].direct += g.n;
    if (tg.s.includes(m)) rows[i].indirect += g.n;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Observations: short, factual notes from logged data. No advice, no diagnosis.

export type Observation =
  | { k: 'notRecently'; m: Muscle; days: number }
  | { k: 'lower'; a: Muscle[]; b: Muscle[]; av: number; bv: number }
  | { k: 'up'; m: Muscle; before: number; now: number }
  | { k: 'twice'; m: Muscle; n: number };

const MAJOR: Muscle[] = ['chest', 'lats', 'upperBack', 'quads', 'hamstrings', 'glutes', 'frontDelts', 'sideDelts', 'biceps', 'triceps', 'calves', 'abs'];

export function observations(entries: Entry[], exById: Map<number, Exercise>, today = new Date()): Observation[] {
  const day = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
  const recent14 = muscleStats(entries, exById, day(13));
  const prior = muscleStats(entries, exById, day(89), day(14));
  const last4 = muscleStats(entries, exById, day(27));
  const prev4 = muscleStats(entries, exById, day(55), day(28));
  const week = muscleStats(entries, exById, iso(weekStart(today)));
  const out: Observation[] = [];

  // Muscles you used to train directly but haven't in the last 2 weeks.
  for (const m of MAJOR) {
    if ((prior.get(m)?.direct ?? 0) >= 4 && !(recent14.get(m)?.direct)) out.push({ k: 'notRecently', m, days: 14 });
  }

  // Pushing vs pulling over the last 4 weeks.
  const sum = (ms: Muscle[]) => ms.reduce((s, m) => s + (last4.get(m)?.direct ?? 0), 0);
  const push: Muscle[] = ['chest'];
  const pull: Muscle[] = ['lats', 'upperBack'];
  const pu = sum(push);
  const pl = sum(pull);
  if (pu >= 6 && pl < pu * 0.67) out.push({ k: 'lower', a: pull, b: push, av: pl, bv: pu });
  else if (pl >= 6 && pu < pl * 0.5) out.push({ k: 'lower', a: push, b: pull, av: pu, bv: pl });

  // Clear increases compared with the 4 weeks before.
  for (const m of MAJOR) {
    const now = last4.get(m)?.direct ?? 0;
    const before = prev4.get(m)?.direct ?? 0;
    if (before >= 4 && now >= before * 1.5) out.push({ k: 'up', m, before, now });
  }

  // Trained on two or more days this week.
  for (const [m, st] of week) {
    if (st.sessions.size >= 2 && MAJOR.includes(m)) out.push({ k: 'twice', m, n: st.sessions.size });
  }

  const order = { notRecently: 0, lower: 1, up: 2, twice: 3 };
  return out.sort((a, b) => order[a.k] - order[b.k]).slice(0, 4);
}
