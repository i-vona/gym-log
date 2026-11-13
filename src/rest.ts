import type { Exercise } from './db';

/**
 * Research-based rest recommendations.
 *
 * - Singer et al. 2024 (Bayesian meta-analysis): resting > 60 s gives slightly more muscle
 *   growth; beyond ~90 s no further difference.
 * - Schoenfeld et al. 2016 (trained men): 3 min rest beat 1 min for strength and muscle
 *   size on multi-joint lifts; Grgic et al. 2017 review: longer rests favoured for compound lifts.
 * - ACSM 2009 position stand: lighter, higher-rep (endurance) work uses short rests (< 90 s).
 * - Rest between exercises is barely studied; values here follow common practice: at least
 *   as long as the between-set rest, longer before a heavy compound lift.
 */
export type RestCategory = 'compound' | 'moderate' | 'isolation' | 'light' | 'core' | 'hold' | 'carry' | 'cardio';

export const REST_BY_CATEGORY: Record<RestCategory, { set: number; next: number }> = {
  compound: { set: 120, next: 180 },
  moderate: { set: 90, next: 120 },
  isolation: { set: 90, next: 120 },
  light: { set: 60, next: 90 },
  core: { set: 60, next: 90 },
  hold: { set: 45, next: 90 },
  carry: { set: 60, next: 90 },
  cardio: { set: 0, next: 120 },
};

const CATEGORY: Record<string, RestCategory> = {
  squat: 'compound', deadlift: 'compound', bench: 'compound', ohp: 'compound', row: 'compound',
  rdl: 'compound', legPress: 'compound', hipThrust: 'compound', pullup: 'compound', dips: 'compound',
  lunge: 'compound',
  gobletSquat: 'moderate', pushUp: 'moderate', dbBench: 'moderate', dbRdl: 'moderate', bwSquat: 'light',
  assistedPullup: 'moderate', latPulldown: 'moderate', dbRow: 'moderate', dbOhp: 'moderate', gluteBridge: 'moderate',
  curl: 'isolation', triceps: 'isolation', chestFly: 'isolation', legCurl: 'isolation', legExtension: 'isolation',
  lateralRaise: 'light', reverseFly: 'light', calfRaise: 'light',
  hangingKneeRaise: 'core', plateCrunch: 'core', abWheel: 'core', woodchopper: 'core', russianTwist: 'core', deadBug: 'core',
  plank: 'hold', sidePlank: 'hold', hollowHold: 'hold',
  suitcaseCarry: 'carry', farmerCarry: 'carry',
  running: 'cardio', treadmill: 'cardio', cycling: 'cardio', rowing: 'cardio', elliptical: 'cardio',
  stairs: 'cardio', walking: 'cardio', swimming: 'cardio',
};

export function restCategory(ex: Exercise): RestCategory {
  if (ex.key && CATEGORY[ex.key]) return CATEGORY[ex.key];
  return ex.type === 'cardio' ? 'cardio' : ex.type === 'hold' ? 'hold' : ex.type === 'carry' ? 'carry' : 'moderate';
}

/** Recommended rest in seconds: between sets, and before starting this exercise. */
export function recommendedRest(ex: Exercise) {
  return REST_BY_CATEGORY[restCategory(ex)];
}

export const REST_SOURCES = [
  { label: 'Singer et al. 2024, Frontiers in Sports and Active Living', url: 'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full' },
  { label: 'Schoenfeld et al. 2016, J Strength Cond Res', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Longer+interset+rest+periods+enhance+muscle+strength+and+hypertrophy+in+resistance-trained+men' },
  { label: 'Grgic et al. 2017, systematic review', url: 'https://www.researchgate.net/publication/317832672_The_effects_of_short_versus_long_inter-set_rest_intervals_in_resistance_training_on_measures_of_muscle_hypertrophy_A_systematic_review' },
  { label: 'ACSM 2009 position stand', url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/' },
];
