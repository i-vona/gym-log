import type { Exercise, LText, Plan, PlanItem, PlanSection } from './db';
import { recommendedRest, restCategory, type RestCategory } from './rest';

// Builds a workout from a few answers: focus, time, goal, level, equipment.
// Exercises are chosen per movement pattern (big lifts first, small muscles and core
// last), and sets/reps/rest follow the goal (see rest.ts for the research behind rests).

export type Focus = 'full' | 'upper' | 'lower' | 'back' | 'push' | 'arms' | 'core' | 'cardio';
export type Goal = 'strength' | 'muscle' | 'endurance';
export type Level = 1 | 2 | 3;
export type Equip = 'gym' | 'db' | 'none';
export type Sex = 'f' | 'm' | 'x';

export interface GenInput {
  focus: Focus[];
  minutes: number;
  goal: Goal;
  level: Level;
  equip: Equip;
  sex: Sex;
}

export const DEFAULT_INPUT: GenInput = { focus: ['full'], minutes: 45, goal: 'muscle', level: 1, equip: 'gym', sex: 'x' };

type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'glute' | 'hamCurl' | 'quadIso' | 'calf'
  | 'pushH' | 'pushV' | 'pullV' | 'pullH' | 'fly' | 'lateral' | 'rearDelt' | 'biceps' | 'triceps'
  | 'coreFlex' | 'coreAntiExt' | 'coreRot' | 'carry' | 'cardio';

/** Movement pattern, minimum equipment and difficulty of each built-in exercise. */
const META: Record<string, { p: Pattern; eq: Equip; lvl: Level }> = {
  squat: { p: 'squat', eq: 'gym', lvl: 2 },
  legPress: { p: 'squat', eq: 'gym', lvl: 1 },
  gobletSquat: { p: 'squat', eq: 'db', lvl: 1 },
  bwSquat: { p: 'squat', eq: 'none', lvl: 1 },
  deadlift: { p: 'hinge', eq: 'gym', lvl: 3 },
  rdl: { p: 'hinge', eq: 'gym', lvl: 2 },
  dbRdl: { p: 'hinge', eq: 'db', lvl: 1 },
  lunge: { p: 'lunge', eq: 'none', lvl: 1 },
  hipThrust: { p: 'glute', eq: 'gym', lvl: 2 },
  gluteBridge: { p: 'glute', eq: 'none', lvl: 1 },
  legCurl: { p: 'hamCurl', eq: 'gym', lvl: 1 },
  legExtension: { p: 'quadIso', eq: 'gym', lvl: 1 },
  calfRaise: { p: 'calf', eq: 'none', lvl: 1 },
  bench: { p: 'pushH', eq: 'gym', lvl: 2 },
  dbBench: { p: 'pushH', eq: 'db', lvl: 1 },
  pushUp: { p: 'pushH', eq: 'none', lvl: 1 },
  dips: { p: 'pushH', eq: 'gym', lvl: 3 },
  ohp: { p: 'pushV', eq: 'gym', lvl: 2 },
  dbOhp: { p: 'pushV', eq: 'db', lvl: 1 },
  pullup: { p: 'pullV', eq: 'gym', lvl: 3 },
  assistedPullup: { p: 'pullV', eq: 'gym', lvl: 1 },
  latPulldown: { p: 'pullV', eq: 'gym', lvl: 1 },
  row: { p: 'pullH', eq: 'gym', lvl: 2 },
  dbRow: { p: 'pullH', eq: 'db', lvl: 1 },
  chestFly: { p: 'fly', eq: 'gym', lvl: 1 },
  lateralRaise: { p: 'lateral', eq: 'db', lvl: 1 },
  reverseFly: { p: 'rearDelt', eq: 'db', lvl: 1 },
  curl: { p: 'biceps', eq: 'db', lvl: 1 },
  triceps: { p: 'triceps', eq: 'db', lvl: 1 },
  hangingKneeRaise: { p: 'coreFlex', eq: 'gym', lvl: 2 },
  plateCrunch: { p: 'coreFlex', eq: 'db', lvl: 1 },
  abWheel: { p: 'coreAntiExt', eq: 'gym', lvl: 2 },
  deadBug: { p: 'coreAntiExt', eq: 'none', lvl: 1 },
  plank: { p: 'coreAntiExt', eq: 'none', lvl: 1 },
  hollowHold: { p: 'coreAntiExt', eq: 'none', lvl: 2 },
  woodchopper: { p: 'coreRot', eq: 'db', lvl: 1 },
  russianTwist: { p: 'coreRot', eq: 'none', lvl: 1 },
  sidePlank: { p: 'coreRot', eq: 'none', lvl: 1 },
  suitcaseCarry: { p: 'carry', eq: 'db', lvl: 1 },
  farmerCarry: { p: 'carry', eq: 'db', lvl: 1 },
  treadmill: { p: 'cardio', eq: 'gym', lvl: 1 },
  cycling: { p: 'cardio', eq: 'gym', lvl: 1 },
  rowing: { p: 'cardio', eq: 'gym', lvl: 1 },
  elliptical: { p: 'cardio', eq: 'gym', lvl: 1 },
  stairs: { p: 'cardio', eq: 'gym', lvl: 1 },
  running: { p: 'cardio', eq: 'none', lvl: 1 },
  walking: { p: 'cardio', eq: 'none', lvl: 1 },
};

/** Order of movement patterns per focus: big multi-joint lifts first, core last. */
const TEMPLATES: Record<Exclude<Focus, 'cardio'>, Pattern[]> = {
  full: ['squat', 'pushH', 'pullV', 'hinge', 'pushV', 'pullH', 'lunge', 'coreAntiExt', 'coreRot', 'glute', 'biceps', 'triceps'],
  upper: ['pushH', 'pullV', 'pushV', 'pullH', 'lateral', 'rearDelt', 'biceps', 'triceps', 'fly', 'coreAntiExt'],
  lower: ['squat', 'hinge', 'lunge', 'glute', 'hamCurl', 'quadIso', 'calf', 'coreRot'],
  back: ['pullV', 'pullH', 'hinge', 'rearDelt', 'biceps', 'carry', 'coreAntiExt'],
  push: ['pushH', 'pushV', 'fly', 'lateral', 'triceps', 'coreRot'],
  arms: ['biceps', 'triceps', 'pushH', 'pullH', 'lateral', 'carry'],
  core: ['coreFlex', 'coreAntiExt', 'coreRot', 'carry', 'coreAntiExt', 'coreRot', 'coreFlex'],
};

const RANK: Record<Equip, number> = { none: 0, db: 1, gym: 2 };

type Rx = [sets: number, target: string, unit?: PlanItem['unit']];
const RX: Record<Goal, Record<Exclude<RestCategory, 'cardio'>, Rx>> = {
  strength: { compound: [4, '4-6'], moderate: [3, '6-8'], isolation: [3, '8-10'], light: [3, '10-12'], core: [3, '8-12'], hold: [3, '20-30', 's'], carry: [3, '30', 'm'] },
  muscle: { compound: [3, '6-10'], moderate: [3, '8-12'], isolation: [3, '10-15'], light: [3, '12-15'], core: [3, '10-15'], hold: [3, '30-45', 's'], carry: [3, '30', 'm'] },
  endurance: { compound: [3, '12-15'], moderate: [3, '12-15'], isolation: [2, '15-20'], light: [2, '15-20'], core: [3, '15-20'], hold: [3, '45-60', 's'], carry: [3, '40', 'm'] },
};

/** Sets, reps and rest for an exercise, adjusted for goal, level and sex. */
export function prescribe(ex: Exercise, input: GenInput): PlanItem {
  const cat = restCategory(ex);
  if (cat === 'cardio') return { ex: ex.key, target: '20', unit: 'min' };
  // Body-weight moves can't be loaded heavier, so "strength" uses the muscle-building ranges.
  const goal = ex.bodyweight && input.goal === 'strength' ? 'muscle' : input.goal;
  const [baseSets, baseTarget, unit] = RX[goal][cat];
  let sets = baseSets;
  let target = baseTarget;
  if (input.level === 1) {
    sets = Math.max(2, sets - (cat === 'compound' || cat === 'moderate' ? 1 : 0));
    if (cat === 'hold') target = goal === 'endurance' ? '30-45' : '20-30';
  }
  if (input.level === 3 && cat === 'compound') sets += 1;

  let rest = recommendedRest(ex).set;
  if (input.goal === 'strength' && cat === 'compound') rest = 180;
  if (input.goal === 'endurance') rest = Math.max(30, Math.round((rest * 0.6) / 15) * 15);
  // Some studies find women fatigue less and recover faster between sets (evidence is mixed),
  // so smaller-muscle work gets 15 s less rest.
  if (input.sex === 'f' && cat !== 'compound') rest = Math.max(30, rest - 15);

  return { ex: ex.key, sets, target, unit, perSide: ex.unilateral || undefined, rest };
}

/** Rough duration in seconds of one plan item, including the rest before it. */
export function itemSeconds(it: PlanItem, ex: Exercise | undefined, first: boolean): number {
  if (it.unit === 'min') return Number(it.target ?? 0) * 60 + (first ? 0 : 60);
  const top = Number((it.target ?? '10').split('-').pop());
  const perSet = (it.unit === 's' ? top : it.unit === 'm' ? 45 : top * 3.5 + 10) * (it.perSide ? 2 : 1);
  const sets = it.sets ?? 1;
  const before = first || !ex ? 0 : recommendedRest(ex).next;
  return sets * perSet + (sets - 1) * (it.rest ?? 0) + before;
}

/** A generated workout, before it's saved as a plan. */
export interface Draft {
  warmup: LText[];
  /** Minutes the warm-up takes (shorter for short workouts). */
  warmupMin: number;
  main: PlanItem[];
  cardio: PlanItem[];
  cooldown: LText[];
}

const T = (en: string, hr: string): LText => ({ en, hr });

const WARMUP: Record<'start' | 'upper' | 'lower' | 'core' | 'heavy', LText[]> = {
  start: [T('5 min easy cardio (bike, rowing or brisk walk)', '5 min laganog kardija (bicikl, veslanje ili brzi hod)')],
  upper: [T('Arm circles: 10 each way', 'Kruženje rukama: 10 u svaku stranu'), T('Arm swings across the chest: 15', 'Zamasi rukama ispred prsa: 15')],
  lower: [T('Hip circles: 10 each way', 'Kruženje kukovima: 10 u svaku stranu'), T('Bodyweight squats: 10', 'Čučnjevi bez utega: 10'), T('Glute bridge: 15', 'Glute bridge: 15')],
  core: [T('Cat-cow: 10', 'Cat-cow: 10'), T('Dead bug: 10', 'Dead bug: 10')],
  heavy: [T('1–2 light warm-up sets before the first exercise', '1–2 lagane serije za zagrijavanje prije prve vježbe')],
};
const COOLDOWN = [T('5 min stretching of the muscles worked today', '5 min istezanja mišića koji su danas radili')];

export const FOCUS_NAMES: Record<Focus, LText> = {
  full: T('Full body', 'Cijelo tijelo'),
  upper: T('Upper body', 'Gornji dio tijela'),
  lower: T('Legs & glutes', 'Noge i gluteusi'),
  back: T('Back & biceps', 'Leđa i biceps'),
  push: T('Chest, shoulders & triceps', 'Prsa, ramena i triceps'),
  arms: T('Arms', 'Ruke'),
  core: T('Core', 'Core (trup)'),
  cardio: T('Cardio', 'Kardio'),
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exercises that fit a pattern with the given equipment and level, best match first. */
export function candidates(pattern: string, input: GenInput, exByKey: Map<string, Exercise>): Exercise[] {
  return Object.entries(META)
    .filter(([key, m]) => m.p === pattern && RANK[m.eq] <= RANK[input.equip] && m.lvl <= Math.max(input.level, 1) + (input.level === 1 ? 0 : 1) && exByKey.has(key))
    .sort((a, b) => RANK[b[1].eq] - RANK[a[1].eq])
    .map(([key]) => exByKey.get(key)!);
}

export const patternOf = (key: string | undefined) => (key ? META[key]?.p : undefined);

export function estimateSeconds(d: Draft, exByKey: Map<string, Exercise>): number {
  const warm = d.warmup.length ? d.warmupMin * 60 : 0;
  const cool = d.cooldown.length ? 5 * 60 : 0;
  const all = [...d.main, ...d.cardio];
  return warm + cool + all.reduce((s, it, i) => s + itemSeconds(it, exByKey.get(it.ex!), i === 0), 0);
}

export function generate(input: GenInput, exByKey: Map<string, Exercise>, seed: number): Draft {
  const rand = rng(seed);
  const budget = input.minutes * 60;
  const strengthFocus = input.focus.filter((f): f is Exclude<Focus, 'cardio'> => f !== 'cardio');
  const wantsCardio = input.focus.includes('cardio');

  const warmup: LText[] = [...WARMUP.start];
  if (strengthFocus.some((f) => f === 'full' || f === 'upper' || f === 'back' || f === 'push' || f === 'arms')) warmup.push(...WARMUP.upper);
  if (strengthFocus.some((f) => f === 'full' || f === 'lower')) warmup.push(...WARMUP.lower);
  if (strengthFocus.includes('core')) warmup.push(...WARMUP.core);
  if (input.goal === 'strength' && strengthFocus.length) warmup.push(...WARMUP.heavy);
  // Short workouts get a shorter warm-up (3 min cardio + one mobility drill).
  const short = input.minutes <= 30;
  const draft: Draft = {
    warmup: short ? [T('3 min easy cardio', '3 min laganog kardija'), ...warmup.slice(1, 2)] : warmup,
    warmupMin: short ? 4 : 7,
    main: [], cardio: [], cooldown: input.minutes >= 30 ? COOLDOWN : [],
  };

  const pickCardio = () => {
    const c = candidates('cardio', input, exByKey);
    return c[Math.floor(rand() * c.length)];
  };

  // Cardio only: one steady block filling the time.
  if (!strengthFocus.length) {
    const ex = pickCardio();
    const mins = Math.max(10, Math.round((budget - estimateSeconds(draft, exByKey)) / 60));
    if (ex) draft.cardio.push({ ex: ex.key, target: String(mins), unit: 'min' });
    return draft;
  }

  // Leave room for a cardio finisher if it was asked for.
  const cardioMin = wantsCardio ? Math.min(20, Math.max(10, Math.round(input.minutes * 0.25))) : 0;
  const strengthBudget = budget - cardioMin * 60;

  // Merge the chosen focuses pattern by pattern; core and carries always go last.
  const CORE: Pattern[] = ['coreFlex', 'coreAntiExt', 'coreRot', 'carry'];
  const lists = strengthFocus.map((f) => TEMPLATES[f]);
  const merged: Pattern[] = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const l of lists) if (l[i]) merged.push(l[i]);
  }
  const onlyCore = strengthFocus.every((f) => f === 'core');
  const order = onlyCore ? merged : [...merged.filter((p) => !CORE.includes(p)), ...merged.filter((p) => CORE.includes(p))];

  // If core was chosen alongside other areas, keep time for it so it isn't squeezed out.
  const coreReserve = strengthFocus.includes('core') && !onlyCore ? 8 * 60 : 0;
  const used = new Set<string>();
  for (const p of order) {
    const limit = CORE.includes(p) ? strengthBudget : strengthBudget - coreReserve;
    const options = candidates(p, input, exByKey).filter((e) => !used.has(e.key!));
    if (!options.length) continue;
    // Prefer exercises that use the available equipment; add some variety.
    const best = options.filter((e) => RANK[META[e.key!].eq] === RANK[META[options[0].key!].eq]);
    const pool = rand() < 0.75 ? best : options;
    const ex = pool[Math.floor(rand() * pool.length)];
    const item = prescribe(ex, input);
    // If it doesn't fit, try fewer sets (down to 2) before skipping: more exercises beat more sets.
    const fits = () => estimateSeconds({ ...draft, main: [...draft.main, item] }, exByKey) <= limit;
    while (!fits() && item.sets != null && item.sets > 2) item.sets -= 1;
    if (!fits()) continue;
    draft.main.push(item);
    used.add(ex.key!);
  }

  // Time left over: add sets to the first exercises (up to 5).
  for (let round = 0; round < 3; round++) {
    for (const it of draft.main) {
      if ((it.sets ?? 0) >= 5 || it.unit === 'min') continue;
      it.sets = (it.sets ?? 0) + 1;
      if (estimateSeconds(draft, exByKey) > strengthBudget) { it.sets -= 1; break; }
    }
  }

  if (wantsCardio) {
    const ex = pickCardio();
    if (ex) draft.cardio.push({ ex: ex.key, target: String(cardioMin), unit: 'min' });
  }
  return draft;
}

/** Turns a draft into a plan the Workout screen and follow-along mode can use. */
export function toPlan(d: Draft, input: GenInput): Plan {
  const name: LText = {
    en: `${input.focus.map((f) => (FOCUS_NAMES[f] as { en: string }).en).join(' + ')} · ${input.minutes} min`,
    hr: `${input.focus.map((f) => (FOCUS_NAMES[f] as { hr: string }).hr).join(' + ')} · ${input.minutes} min`,
  };
  const sections: PlanSection[] = [];
  if (d.warmup.length) sections.push({ title: T('Warm-up', 'Zagrijavanje'), items: d.warmup.map((text) => ({ text })) });
  if (d.main.length) sections.push({ title: T('Main part', 'Glavni dio'), items: d.main });
  if (d.cardio.length) sections.push({ title: T('Cardio', 'Kardio'), items: d.cardio });
  if (d.cooldown.length) sections.push({ title: T('Cool-down', 'Kraj'), items: d.cooldown.map((text) => ({ text })) });
  return {
    key: `gen-${Date.now()}`,
    generated: true,
    name,
    sections,
    notes: [
      T('Finish each set with 1–2 reps in reserve.', 'Na kraju serije neka ostanu 1–2 ponavljanja u rezervi.'),
      T('When every set reaches the top of the range, add weight next time.', 'Kad sve serije dođu do gornje granice, sljedeći put dodaj težinu.'),
    ],
  };
}
