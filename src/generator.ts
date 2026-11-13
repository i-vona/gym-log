import type { Exercise, LText, Plan, PlanItem, PlanSection } from './db';
import { recommendedRest, restCategory, type RestCategory } from './rest';
import { MUSCLES } from './anim/muscles';
import type { Muscle } from './anim/figure';

// Builds a workout from a few answers: focus, time, goal, level, equipment.
// Exercises are chosen per movement pattern (big lifts first, small muscles and core
// last), and sets/reps/rest follow the goal (see rest.ts for the research behind rests).

export type Focus = 'full' | 'upper' | 'lower' | 'back' | 'push' | 'arms' | 'core' | 'cardio';
export type Goal = 'strength' | 'muscle' | 'endurance';
export type Level = 1 | 2 | 3;
/** Equipment an exercise needs. 'gym' = machines, cables, barbells; a gym also has all the rest. */
export type Equip = 'gym' | 'db' | 'kb' | 'band' | 'none';
export type Sex = 'f' | 'm' | 'x';

export interface GenInput {
  focus: Focus[];
  minutes: number;
  goal: Goal;
  level: Level;
  /** Equipment available. 'gym' means everything; empty means body weight only. */
  equip: Equip[];
  sex: Sex;
}

export const DEFAULT_INPUT: GenInput = { focus: ['full'], minutes: 45, goal: 'muscle', level: 1, equip: ['gym'], sex: 'x' };

/** Older saved answers stored equipment as a single value. */
export function normalizeInput(raw: Partial<GenInput> & { equip?: unknown }): GenInput {
  const e = raw.equip;
  const equip = Array.isArray(e) ? (e as Equip[]) : e === 'gym' ? ['gym'] : e === 'db' ? ['db'] : e === 'none' ? [] : DEFAULT_INPUT.equip;
  return { ...DEFAULT_INPUT, ...raw, equip } as GenInput;
}

type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'glute' | 'hamCurl' | 'quadIso' | 'calf'
  | 'pushH' | 'pushV' | 'pullV' | 'pullH' | 'fly' | 'lateral' | 'rearDelt' | 'biceps' | 'triceps'
  | 'coreFlex' | 'coreAntiExt' | 'coreRot' | 'carry' | 'conditioning' | 'cardio';

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
  facePull: { p: 'rearDelt', eq: 'gym', lvl: 1 },
  bandPullApart: { p: 'rearDelt', eq: 'band', lvl: 1 },
  tricepsPushdown: { p: 'triceps', eq: 'gym', lvl: 1 },
  cableRow: { p: 'pullH', eq: 'gym', lvl: 1 },
  bandLateralWalk: { p: 'glute', eq: 'band', lvl: 1 },
  kbSwing: { p: 'hinge', eq: 'kb', lvl: 2 },
  farmerCarry: { p: 'carry', eq: 'db', lvl: 1 },
  frontSquat: { p: 'squat', eq: 'gym', lvl: 3 },
  bulgarianSplitSquat: { p: 'lunge', eq: 'db', lvl: 2 },
  stepUp: { p: 'lunge', eq: 'db', lvl: 1 },
  sumoSquat: { p: 'squat', eq: 'db', lvl: 1 },
  goodMorning: { p: 'hinge', eq: 'gym', lvl: 2 },
  singleLegRdl: { p: 'hinge', eq: 'db', lvl: 2 },
  cableKickback: { p: 'glute', eq: 'gym', lvl: 1 },
  hipAbduction: { p: 'glute', eq: 'gym', lvl: 1 },
  wallSit: { p: 'quadIso', eq: 'none', lvl: 1 },
  inclineBench: { p: 'pushH', eq: 'gym', lvl: 2 },
  inclineDbPress: { p: 'pushH', eq: 'db', lvl: 1 },
  machineChestPress: { p: 'pushH', eq: 'gym', lvl: 1 },
  arnoldPress: { p: 'pushV', eq: 'db', lvl: 2 },
  landminePress: { p: 'pushV', eq: 'gym', lvl: 1 },
  frontRaise: { p: 'lateral', eq: 'db', lvl: 1 },
  cableLateralRaise: { p: 'lateral', eq: 'gym', lvl: 1 },
  inclinePushUp: { p: 'pushH', eq: 'none', lvl: 1 },
  kneePushUp: { p: 'pushH', eq: 'none', lvl: 1 },
  skullCrusher: { p: 'triceps', eq: 'gym', lvl: 2 },
  benchDip: { p: 'triceps', eq: 'none', lvl: 1 },
  tBarRow: { p: 'pullH', eq: 'gym', lvl: 2 },
  chestSupportedRow: { p: 'pullH', eq: 'db', lvl: 1 },
  invertedRow: { p: 'pullH', eq: 'gym', lvl: 1 },
  straightArmPulldown: { p: 'pullV', eq: 'gym', lvl: 1 },
  hammerCurl: { p: 'biceps', eq: 'db', lvl: 1 },
  cableCurl: { p: 'biceps', eq: 'gym', lvl: 1 },
  preacherCurl: { p: 'biceps', eq: 'gym', lvl: 1 },
  cableCrunch: { p: 'coreFlex', eq: 'gym', lvl: 1 },
  lyingLegRaise: { p: 'coreFlex', eq: 'none', lvl: 1 },
  hangingLegRaise: { p: 'coreFlex', eq: 'gym', lvl: 3 },
  mountainClimber: { p: 'coreAntiExt', eq: 'none', lvl: 1 },
  pallofPress: { p: 'coreRot', eq: 'gym', lvl: 1 },
  bicycleCrunch: { p: 'coreRot', eq: 'none', lvl: 1 },
  birdDog: { p: 'coreAntiExt', eq: 'none', lvl: 1 },
  burpee: { p: 'conditioning', eq: 'none', lvl: 2 },
  jumpingJacks: { p: 'conditioning', eq: 'none', lvl: 1 },
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
  full: ['squat', 'pushH', 'pullV', 'hinge', 'pushV', 'pullH', 'lunge', 'coreAntiExt', 'coreRot', 'glute', 'conditioning', 'biceps', 'triceps'],
  upper: ['pushH', 'pullV', 'pushV', 'pullH', 'lateral', 'rearDelt', 'biceps', 'triceps', 'fly', 'coreAntiExt'],
  lower: ['squat', 'hinge', 'lunge', 'glute', 'hamCurl', 'quadIso', 'calf', 'coreRot'],
  back: ['pullV', 'pullH', 'hinge', 'rearDelt', 'biceps', 'carry', 'coreAntiExt'],
  push: ['pushH', 'pushV', 'fly', 'lateral', 'triceps', 'coreRot'],
  arms: ['biceps', 'triceps', 'pushH', 'pullH', 'lateral', 'carry'],
  core: ['coreFlex', 'coreAntiExt', 'coreRot', 'carry', 'coreAntiExt', 'coreRot', 'coreFlex'],
};

const has = (input: GenInput, eq: Equip) => eq === 'none' || input.equip.includes('gym') || input.equip.includes(eq);

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
  /** Endurance goal: cardio before strength. Otherwise strength first. */
  cardioFirst: boolean;
  /** Why the workout looks the way it does (order, skipped muscles). */
  notes: LText[];
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
    .filter(([key, m]) => m.p === pattern && has(input, m.eq) && m.lvl <= input.level + (input.level === 1 ? 0 : 1) && exByKey.has(key))
    // Exercises with equipment first, body-weight ones after.
    .sort((a, b) => Number(a[1].eq === 'none') - Number(b[1].eq === 'none'))
    .map(([key]) => exByKey.get(key)!);
}

export const patternOf = (key: string | undefined) => (key ? META[key]?.p : undefined);

export function estimateSeconds(d: Draft, exByKey: Map<string, Exercise>): number {
  const warm = d.warmup.length ? d.warmupMin * 60 : 0;
  const cool = d.cooldown.length ? 5 * 60 : 0;
  const all = [...d.main, ...d.cardio];
  return warm + cool + all.reduce((s, it, i) => s + itemSeconds(it, exByKey.get(it.ex!), i === 0), 0);
}

// ---------------------------------------------------------------------------
// Recovery: ACSM recommends at least 48 h before training the same muscle group again.
// Trainers commonly allow ~24 h for small, endurance-type muscles (core, calves, forearms).

/** Hours since each muscle was last trained as a main (primary) muscle. */
export type Recent = Partial<Record<Muscle, number>>;

const QUICK: Muscle[] = ['abs', 'obliques', 'calves', 'forearms', 'hipFlexors'];
export const recoveryHours = (m: Muscle) => (QUICK.includes(m) ? 24 : 48);

/** Muscles still recovering, with hours since training and hours left. */
export function recovering(recent: Recent): { muscle: Muscle; ago: number; left: number }[] {
  return (Object.entries(recent) as [Muscle, number][])
    .filter(([m, ago]) => m !== 'cardio' && ago < recoveryHours(m))
    .map(([muscle, ago]) => ({ muscle, ago, left: Math.ceil(recoveryHours(muscle) - ago) }))
    .sort((a, b) => a.ago - b.ago);
}

export const AREA_MUSCLES: Record<Exclude<Focus, 'cardio'>, Muscle[]> = {
  full: ['chest', 'shoulders', 'rearDelts', 'triceps', 'biceps', 'lats', 'upperBack', 'lowerBack', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'calves'],
  upper: ['chest', 'shoulders', 'rearDelts', 'triceps', 'biceps', 'lats', 'upperBack', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'hipFlexors'],
  back: ['lats', 'upperBack', 'rearDelts', 'biceps', 'lowerBack'],
  push: ['chest', 'shoulders', 'triceps'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs', 'obliques', 'lowerBack'],
};

/** Chosen areas whose main muscles are still recovering. */
export function conflicts(focus: Focus[], recent: Recent): Exclude<Focus, 'cardio'>[] {
  const rec = new Set(recovering(recent).map((r) => r.muscle));
  return focus.filter((f): f is Exclude<Focus, 'cardio'> => f !== 'full' && f !== 'cardio' && AREA_MUSCLES[f].some((m) => rec.has(m)));
}

/**
 * Suggests today's focus: a fully recovered area trained longest ago (training each
 * muscle about twice a week builds more muscle than once a week).
 */
export function suggestFocus(recent: Recent): Exclude<Focus, 'cardio'> | null {
  const rec = new Set(recovering(recent).map((r) => r.muscle));
  if (!rec.size) return 'full';
  const areas: Exclude<Focus, 'cardio' | 'full' | 'arms'>[] = ['lower', 'push', 'back', 'upper', 'core'];
  const ready = areas.filter((a) => AREA_MUSCLES[a].every((m) => !rec.has(m)));
  const since = (a: Exclude<Focus, 'cardio'>) => Math.min(...AREA_MUSCLES[a].map((m) => recent[m] ?? 999));
  return ready.sort((a, b) => since(b) - since(a))[0] ?? null;
}

// Running interferes with strength and muscle gains more than cycling (Wilson et al. 2012),
// so cardio after strength work (or with tired legs) is low-impact.
const LOW_INTERFERENCE = ['cycling', 'elliptical', 'walking', 'rowing'];

export function generate(input: GenInput, exByKey: Map<string, Exercise>, seed: number, recent: Recent = {}): Draft {
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
    cardioFirst: input.goal === 'endurance',
    notes: [],
  };

  // Muscles to leave out: still recovering and not part of an area chosen on purpose.
  const chosen = new Set(strengthFocus.filter((f) => f !== 'full').flatMap((f) => AREA_MUSCLES[f]));
  const avoid = new Set(recovering(recent).map((r) => r.muscle).filter((m) => !chosen.has(m)));
  let skipped = false;
  const ok = (e: Exercise) => {
    const bad = (MUSCLES[e.key!]?.p ?? []).some((m) => avoid.has(m));
    if (bad) skipped = true;
    return !bad;
  };
  const recoveryNote = () => {
    if (skipped) draft.notes.unshift(T(
      'Muscles trained in the last 48 h were left out so they can recover.',
      'Mišići trenirani u zadnjih 48 h su izostavljeni kako bi se oporavili.',
    ));
  };

  const pickCardio = (afterStrength: boolean) => {
    const all = candidates('cardio', input, exByKey);
    const legsTired = (['quads', 'hamstrings', 'glutes', 'calves'] as Muscle[]).some((m) => avoid.has(m));
    // Tired legs: only easy, low-impact options (walking, elliptical).
    const gentle = all.filter((e) => (legsTired ? ['walking', 'elliptical'] : LOW_INTERFERENCE).includes(e.key!));
    if (legsTired) skipped = true;
    const c = (afterStrength || legsTired) && gentle.length ? gentle : all;
    return c[Math.floor(rand() * c.length)];
  };

  // Cardio only: one steady block filling the time.
  if (!strengthFocus.length) {
    const ex = pickCardio(false);
    const mins = Math.max(10, Math.round((budget - estimateSeconds(draft, exByKey)) / 60));
    if (ex) draft.cardio.push({ ex: ex.key, target: String(mins), unit: 'min' });
    recoveryNote();
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
    const options = candidates(p, input, exByKey).filter((e) => !used.has(e.key!) && ok(e));
    if (!options.length) continue;
    // With equipment available, mostly pick exercises that use it (any kind equally:
    // barbell, machine, cable, dumbbell, kettlebell, band); body-weight ones now and then.
    const loaded = options.filter((e) => META[e.key!].eq !== 'none');
    const pool = loaded.length && rand() < 0.8 ? loaded : options;
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
    const ex = pickCardio(!draft.cardioFirst);
    recoveryNote();
    if (ex) draft.cardio.push({ ex: ex.key, target: String(cardioMin), unit: 'min' });
    draft.notes.push(draft.cardioFirst
      ? T('Cardio comes first because your goal is endurance: do first what matters most for your goal.',
        'Kardio je prvi jer ti je cilj izdržljivost: prvo radi ono što je najvažnije za tvoj cilj.')
      : T('Strength first, cardio after: research shows strength improves more this way, and cardio does not suffer. Low-impact cardio (bike, elliptical, walking) interferes least with strength gains.',
        'Prvo snaga, zatim kardio: istraživanja pokazuju da snaga tako više napreduje, a kardio ne trpi. Kardio bez udaraca (bicikl, eliptični, hodanje) najmanje ometa napredak u snazi.'));
  }
  if (!wantsCardio) recoveryNote();
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
  const main: PlanSection = { title: T('Main part', 'Glavni dio'), items: d.main };
  const cardio: PlanSection = { title: T('Cardio', 'Kardio'), items: d.cardio };
  for (const sec of d.cardioFirst ? [cardio, main] : [main, cardio]) if (sec.items.length) sections.push(sec);
  if (d.cooldown.length) sections.push({ title: T('Cool-down', 'Kraj'), items: d.cooldown.map((text) => ({ text })) });
  return {
    key: `gen-${Date.now()}`,
    generated: true,
    name,
    sections,
    notes: [
      ...d.notes,
      T('Finish each set with 1–2 reps in reserve.', 'Na kraju serije neka ostanu 1–2 ponavljanja u rezervi.'),
      T('When every set reaches the top of the range, add weight next time.', 'Kad sve serije dođu do gornje granice, sljedeći put dodaj težinu.'),
    ],
  };
}
