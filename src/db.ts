import Dexie, { type EntityTable } from 'dexie';
import { SEED_PLANS } from './plans';

/**
 * strength: kg × reps · cardio: minutes + km · hold: seconds (+ optional kg) · carry: kg × metres
 */
export type ExerciseType = 'strength' | 'cardio' | 'hold' | 'carry';
export const EXERCISE_TYPES: ExerciseType[] = ['strength', 'cardio', 'hold', 'carry'];

/** Built-in exercises have a `key` (translated via i18n); custom ones have a `name`. */
export interface Exercise {
  id?: number;
  key?: string;
  name?: string;
  type: ExerciseType;
  /** Machine/band-assisted: the logged weight is assistance, so lower is better. */
  assisted?: boolean;
}

/** One logged set (strength/hold/carry) or one cardio session. `date` is YYYY-MM-DD. */
export interface Entry {
  id?: number;
  date: string;
  exerciseId: number;
  weight?: number;
  reps?: number;
  minutes?: number;
  distance?: number;
  seconds?: number;
  meters?: number;
  createdAt: number;
}

export interface BodyWeight {
  id?: number;
  date: string;
  kg: number;
}

/** Text that is either plain (user-made) or provided in both languages (built-in). */
export type LText = string | { en: string; hr: string };

export interface PlanItem {
  /** Built-in exercise key → this item is logged as an exercise card. */
  ex?: string;
  /** Otherwise a plain checklist line (warm-up moves, stretching…). */
  text?: LText;
  sets?: number;
  /** Target per set, e.g. "10-12", "30-45". */
  target?: string;
  unit?: 'reps' | 's' | 'm' | 'min';
  perSide?: boolean;
  rest?: number;
  /** Consecutive items with the same label are shown as one superset. */
  superset?: string;
}

export interface PlanSection {
  title: LText;
  note?: LText;
  items: PlanItem[];
}

export interface Plan {
  id?: number;
  key?: string;
  name: LText;
  sections: PlanSection[];
  notes?: LText[];
}

/** Per-day info: which plan is attached and which checklist lines are ticked. */
export interface Day {
  date: string;
  planId?: number;
  done?: string[];
}

export const BUILTIN_EXERCISES: { key: string; type: ExerciseType; assisted?: boolean }[] = [
  { key: 'squat', type: 'strength' },
  { key: 'bench', type: 'strength' },
  { key: 'deadlift', type: 'strength' },
  { key: 'ohp', type: 'strength' },
  { key: 'row', type: 'strength' },
  { key: 'pullup', type: 'strength' },
  { key: 'latPulldown', type: 'strength' },
  { key: 'dips', type: 'strength' },
  { key: 'legPress', type: 'strength' },
  { key: 'lunge', type: 'strength' },
  { key: 'hipThrust', type: 'strength' },
  { key: 'rdl', type: 'strength' },
  { key: 'legCurl', type: 'strength' },
  { key: 'legExtension', type: 'strength' },
  { key: 'calfRaise', type: 'strength' },
  { key: 'curl', type: 'strength' },
  { key: 'triceps', type: 'strength' },
  { key: 'lateralRaise', type: 'strength' },
  { key: 'chestFly', type: 'strength' },
  { key: 'assistedPullup', type: 'strength', assisted: true },
  { key: 'dbRow', type: 'strength' },
  { key: 'dbOhp', type: 'strength' },
  { key: 'reverseFly', type: 'strength' },
  { key: 'hangingKneeRaise', type: 'strength' },
  { key: 'plateCrunch', type: 'strength' },
  { key: 'abWheel', type: 'strength' },
  { key: 'woodchopper', type: 'strength' },
  { key: 'deadBug', type: 'strength' },
  { key: 'russianTwist', type: 'strength' },
  { key: 'gluteBridge', type: 'strength' },
  { key: 'plank', type: 'hold' },
  { key: 'sidePlank', type: 'hold' },
  { key: 'hollowHold', type: 'hold' },
  { key: 'suitcaseCarry', type: 'carry' },
  { key: 'farmerCarry', type: 'carry' },
  { key: 'running', type: 'cardio' },
  { key: 'treadmill', type: 'cardio' },
  { key: 'cycling', type: 'cardio' },
  { key: 'rowing', type: 'cardio' },
  { key: 'elliptical', type: 'cardio' },
  { key: 'stairs', type: 'cardio' },
  { key: 'walking', type: 'cardio' },
  { key: 'swimming', type: 'cardio' },
];

export const db = new Dexie('gym-log') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  entries: EntityTable<Entry, 'id'>;
  body: EntityTable<BodyWeight, 'id'>;
  plans: EntityTable<Plan, 'id'>;
  days: EntityTable<Day, 'date'>;
  meta: EntityTable<{ key: string; value: unknown }, 'key'>;
};

db.version(1).stores({
  exercises: '++id, &key, type',
  entries: '++id, date, exerciseId, [exerciseId+date]',
  body: '++id, &date',
});
db.version(2).stores({
  plans: '++id, &key',
  days: '&date',
  meta: '&key',
});

/**
 * Adds any built-in exercises and plans that are missing. Runs on every start, so new
 * built-ins reach existing installs. Plans are seeded once each, so deleting one sticks.
 */
export async function ensureSeed() {
  await db.transaction('rw', db.exercises, db.plans, db.meta, async () => {
    const have = new Set((await db.exercises.toArray()).map((e) => e.key).filter(Boolean));
    const missing = BUILTIN_EXERCISES.filter((e) => !have.has(e.key));
    if (missing.length) await db.exercises.bulkAdd(missing.map((e) => ({ ...e })));

    const seeded = ((await db.meta.get('seededPlans'))?.value as string[] | undefined) ?? [];
    const newPlans = SEED_PLANS.filter((p) => !seeded.includes(p.key!));
    if (newPlans.length) {
      await db.plans.bulkAdd(newPlans.map((p) => structuredClone(p)));
      await db.meta.put({ key: 'seededPlans', value: [...seeded, ...newPlans.map((p) => p.key!)] });
    }
  });
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parses user input like "62,5" or "62.5"; returns undefined for empty/invalid. */
export function parseNum(s: string): number | undefined {
  const n = parseFloat(s.replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

export async function exportData() {
  return {
    app: 'gym-log',
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    entries: await db.entries.toArray(),
    body: await db.body.toArray(),
    plans: await db.plans.toArray(),
    days: await db.days.toArray(),
    meta: await db.meta.toArray(),
  };
}

export async function importData(data: unknown) {
  const d = data as Partial<Awaited<ReturnType<typeof exportData>>>;
  if (d?.app !== 'gym-log' || !Array.isArray(d.exercises) || !Array.isArray(d.entries) || !Array.isArray(d.body)) {
    throw new Error('invalid backup');
  }
  await db.transaction('rw', [db.exercises, db.entries, db.body, db.plans, db.days, db.meta], async () => {
    await Promise.all([db.exercises, db.entries, db.body, db.plans, db.days, db.meta].map((t) => t.clear()));
    await db.exercises.bulkAdd(d.exercises!);
    await db.entries.bulkAdd(d.entries!);
    await db.body.bulkAdd(d.body!);
    await db.plans.bulkAdd(d.plans ?? []);
    await db.days.bulkAdd(d.days ?? []);
    await db.meta.bulkAdd(d.meta ?? []);
  });
  await ensureSeed();
}
