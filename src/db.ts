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
  /** Trained one side at a time: each set is logged for the left and the right. */
  unilateral?: boolean;
  /** Done with body weight only: no kg field. */
  bodyweight?: boolean;
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
  /** Left or right, for one-sided exercises. */
  side?: 'L' | 'R';
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
  /** Or a custom exercise by id. */
  exId?: number;
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
  /** Do the items one after another, then rest, for this many rounds. */
  circuit?: { rounds: number; rest: number };
}

export interface Plan {
  id?: number;
  key?: string;
  /** Version of a built-in plan; a higher version in code replaces the stored copy. */
  v?: number;
  /** Made by the workout builder (hidden from the plan list unless kept). */
  generated?: boolean;
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

export const BUILTIN_EXERCISES: { key: string; type: ExerciseType; assisted?: boolean; unilateral?: boolean; bodyweight?: boolean }[] = [
  { key: 'squat', type: 'strength' },
  { key: 'bench', type: 'strength' },
  { key: 'deadlift', type: 'strength' },
  { key: 'ohp', type: 'strength' },
  { key: 'row', type: 'strength' },
  { key: 'pullup', type: 'strength', bodyweight: true },
  { key: 'latPulldown', type: 'strength' },
  { key: 'dips', type: 'strength', bodyweight: true },
  { key: 'legPress', type: 'strength' },
  { key: 'lunge', type: 'strength', unilateral: true },
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
  { key: 'dbRow', type: 'strength', unilateral: true },
  { key: 'dbOhp', type: 'strength' },
  { key: 'reverseFly', type: 'strength' },
  { key: 'hangingKneeRaise', type: 'strength', bodyweight: true },
  { key: 'plateCrunch', type: 'strength' },
  { key: 'abWheel', type: 'strength', bodyweight: true },
  { key: 'woodchopper', type: 'strength', unilateral: true },
  { key: 'deadBug', type: 'strength', bodyweight: true },
  { key: 'russianTwist', type: 'strength', bodyweight: true },
  { key: 'gluteBridge', type: 'strength' },
  { key: 'plank', type: 'hold', bodyweight: true },
  { key: 'sidePlank', type: 'hold', unilateral: true, bodyweight: true },
  { key: 'hollowHold', type: 'hold', bodyweight: true },
  { key: 'suitcaseCarry', type: 'carry', unilateral: true },
  { key: 'farmerCarry', type: 'carry' },
  { key: 'bwSquat', type: 'strength', bodyweight: true },
  { key: 'gobletSquat', type: 'strength' },
  { key: 'pushUp', type: 'strength', bodyweight: true },
  { key: 'dbBench', type: 'strength' },
  { key: 'dbRdl', type: 'strength' },
  { key: 'facePull', type: 'strength' },
  { key: 'tricepsPushdown', type: 'strength' },
  { key: 'cableRow', type: 'strength' },
  { key: 'bandPullApart', type: 'strength', bodyweight: true },
  { key: 'bandLateralWalk', type: 'strength', bodyweight: true },
  { key: 'kbSwing', type: 'strength' },
  { key: 'frontSquat', type: 'strength' },
  { key: 'bulgarianSplitSquat', type: 'strength', unilateral: true },
  { key: 'stepUp', type: 'strength', unilateral: true },
  { key: 'sumoSquat', type: 'strength' },
  { key: 'goodMorning', type: 'strength' },
  { key: 'singleLegRdl', type: 'strength', unilateral: true },
  { key: 'cableKickback', type: 'strength', unilateral: true },
  { key: 'hipAbduction', type: 'strength' },
  { key: 'wallSit', type: 'hold', bodyweight: true },
  { key: 'inclineBench', type: 'strength' },
  { key: 'inclineDbPress', type: 'strength' },
  { key: 'machineChestPress', type: 'strength' },
  { key: 'arnoldPress', type: 'strength' },
  { key: 'landminePress', type: 'strength', unilateral: true },
  { key: 'frontRaise', type: 'strength' },
  { key: 'cableLateralRaise', type: 'strength', unilateral: true },
  { key: 'inclinePushUp', type: 'strength', bodyweight: true },
  { key: 'kneePushUp', type: 'strength', bodyweight: true },
  { key: 'skullCrusher', type: 'strength' },
  { key: 'benchDip', type: 'strength', bodyweight: true },
  { key: 'tBarRow', type: 'strength' },
  { key: 'chestSupportedRow', type: 'strength' },
  { key: 'invertedRow', type: 'strength', bodyweight: true },
  { key: 'straightArmPulldown', type: 'strength' },
  { key: 'hammerCurl', type: 'strength' },
  { key: 'cableCurl', type: 'strength' },
  { key: 'preacherCurl', type: 'strength' },
  { key: 'cableCrunch', type: 'strength' },
  { key: 'lyingLegRaise', type: 'strength', bodyweight: true },
  { key: 'hangingLegRaise', type: 'strength', bodyweight: true },
  { key: 'mountainClimber', type: 'strength', bodyweight: true },
  { key: 'pallofPress', type: 'strength' },
  { key: 'bicycleCrunch', type: 'strength', bodyweight: true },
  { key: 'birdDog', type: 'strength', bodyweight: true, unilateral: true },
  { key: 'burpee', type: 'strength', bodyweight: true },
  { key: 'jumpingJacks', type: 'strength', bodyweight: true },
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
    const stored = await db.exercises.toArray();
    const have = new Set(stored.map((e) => e.key).filter(Boolean));
    // Keep flags of built-ins in step with the code.
    for (const b of BUILTIN_EXERCISES) {
      const e = stored.find((x) => x.key === b.key);
      if (e && (!!e.unilateral !== !!b.unilateral || !!e.assisted !== !!b.assisted || !!e.bodyweight !== !!b.bodyweight)) {
        await db.exercises.update(e.id!, { unilateral: b.unilateral, assisted: b.assisted, bodyweight: b.bodyweight });
      }
    }
    const missing = BUILTIN_EXERCISES.filter((e) => !have.has(e.key));
    if (missing.length) await db.exercises.bulkAdd(missing.map((e) => ({ ...e })));

    const seeded = ((await db.meta.get('seededPlans'))?.value as string[] | undefined) ?? [];
    for (const p of SEED_PLANS) {
      const stored = await db.plans.where('key').equals(p.key!).first();
      if (stored && (stored.v ?? 0) < (p.v ?? 0)) await db.plans.put({ ...structuredClone(p), id: stored.id });
    }
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
