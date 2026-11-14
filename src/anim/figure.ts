// Figure engine for exercise animations. Pure geometry, no DOM, so it can be
// rendered by React (SVG) and by a Node script (for checking the drawings).
//
// Angles are absolute, in degrees: 0 = right (the way the figure faces), 90 = up,
// -90 = down, 180 = left. Screen y grows downwards.

export type V = [number, number];

export type Joint =
  | 'hip' | 'hip1' | 'hip2' | 'knee' | 'knee2' | 'ankle' | 'ankle2' | 'toe' | 'toe2'
  | 'shoulder' | 'shoulder2' | 'elbow' | 'elbow2' | 'hand' | 'hand2' | 'neck' | 'head';

/** IK target relative to the hip, plus bend direction (+1 / -1). */
export type IK = [number, number, number];

export interface Pose {
  /** side profile, facing the viewer, or seen from behind (to show back muscles) */
  view?: 'side' | 'front' | 'back';
  /** torso angle (hip → shoulders) and length scale */
  t: number;
  tl?: number;
  /** head tilt relative to the torso */
  h?: number;
  ua?: number; fa?: number; ua2?: number; fa2?: number;
  th?: number; sh?: number; th2?: number; sh2?: number;
  ft?: number; ft2?: number;
  /** leg / arm length scale (foreshortening); thl scales only the thighs (seated, seen from the front) */
  ll?: number;
  thl?: number;
  /** scene offset for moving scenery (stairs), in steps; blends forwards, modulo 1 */
  sc?: number;
  al?: number;
  ik?: IK; ik2?: IK; ikL?: IK; ikL2?: IK;
  /** Which joint is pinned where. 'ground': hip x fixed, lowest foot on the floor. */
  at: [Joint | 'ground', number, number?];
}

export type Prop =
  /** front: seen end-on from the front; hang: held by one end, hanging below the hands */
  | { k: 'db'; at: Joint; front?: boolean; hang?: boolean }
  /** tb: offset in the torso's frame [along the torso, towards the back], e.g. a bar on the upper back */
  | { k: 'bb'; at: Joint; dx?: number; dy?: number; tb?: [number, number] }
  /** a round pad by a joint, on the side of `toward` (d < 0: on the opposite side) */
  | { k: 'roll'; at: Joint; toward: Joint; d: number }
  /** a staircase that scrolls down with the pose's `sc`; (x, y) = start of step 0; clipped to box [x0, y0, x1, y1] */
  | { k: 'stairs'; x: number; y: number; w: number; h: number; box: [number, number, number, number] }
  | { k: 'plate'; at: Joint }
  | { k: 'wheel'; at: Joint }
  | { k: 'pad'; at: Joint; dy?: number; w?: number }
  | { k: 'grip'; at: Joint }
  | { k: 'band'; a: Joint; b: Joint }
  | { k: 'kb'; at: Joint }
  | { k: 'rod'; from: V; to: Joint; w?: number }
  | { k: 'seg'; at: Joint; a: number; len: number; w?: number; dx?: number; dy?: number }
  | { k: 'cable'; from: V; to: Joint }
  | { k: 'line'; a: V; b: V; w?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number }
  | { k: 'circle'; c: V; r: number; fill?: boolean }
  | { k: 'water'; y: number };

export interface Move {
  frames: Pose[];
  props?: Prop[];
  /** true: cycle through frames (running); false: there and back (most lifts) */
  loop?: boolean;
  /** milliseconds per segment */
  ms?: number;
  noFloor?: boolean;
  /** Custom viewBox [x, y, w, h] for moves that need more room (e.g. arms overhead). */
  vb?: [number, number, number, number];
}


export const VIEW = { w: 200, h: 190 };
export const GROUND = 182;

const L = { torso: 52, neck: 7, head: 9.5, ua: 28, fa: 26, th: 38, sh: 37, foot: 11 };

const rad = (d: number) => (d * Math.PI) / 180;
const vec = (a: number, len: number): V => [Math.cos(rad(a)) * len, -Math.sin(rad(a)) * len];
const add = (p: V, q: V): V => [p[0] + q[0], p[1] + q[1]];
const angleOf = (p: V, q: V) => (Math.atan2(-(q[1] - p[1]), q[0] - p[0]) * 180) / Math.PI;

function solveIK(s: V, target: V, a: number, b: number, bend: number): [V, V] {
  const dx = target[0] - s[0];
  const dy = target[1] - s[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const dd = Math.min(Math.max(d, Math.abs(a - b) + 0.01), a + b - 0.01);
  const ux = dx / d;
  const uy = dy / d;
  const cosA = (a * a + dd * dd - b * b) / (2 * a * dd);
  const A = Math.acos(Math.min(1, Math.max(-1, cosA))) * bend;
  const elbow: V = [s[0] + a * (ux * Math.cos(A) - uy * Math.sin(A)), s[1] + a * (ux * Math.sin(A) + uy * Math.cos(A))];
  return [elbow, [s[0] + ux * dd, s[1] + uy * dd]];
}

/** Joint positions for a pose (before anchoring the hip is at 0,0). */
export function joints(p: Pose): Record<Joint, V> {
  const front = p.view === 'front' || p.view === 'back';
  const mir = (a: number) => (front ? 180 - a : a);
  const al = p.al ?? 1;
  const ll = p.ll ?? 1;
  const hip: V = [0, 0];
  const neck = vec(p.t, L.torso * (p.tl ?? 1));
  const across = vec(p.t - 90, 1); // to the figure's right when upright (front view)
  const sh1: V = front ? add(neck, [across[0] * 15, across[1] * 15]) : neck;
  const sh2: V = front ? add(neck, [-across[0] * 15, -across[1] * 15]) : neck;
  const hp1: V = front ? [across[0] * 8, across[1] * 8] : hip;
  const hp2: V = front ? [-across[0] * 8, -across[1] * 8] : hip;

  const arm = (s: V, ua: number, fa: number, ik?: IK): [V, V] => {
    if (ik) return solveIK(s, [ik[0], ik[1]], L.ua * al, L.fa * al, ik[2]);
    const e = add(s, vec(ua, L.ua * al));
    return [e, add(e, vec(fa, L.fa * al))];
  };
  const thl = p.thl ?? 1;
  const leg = (s: V, th: number, sh: number, ik?: IK): [V, V] => {
    if (ik) return solveIK(s, [ik[0], ik[1]], L.th * ll * thl, L.sh * ll, ik[2]);
    const k = add(s, vec(th, L.th * ll * thl));
    return [k, add(k, vec(sh, L.sh * ll))];
  };

  const ua = p.ua ?? -90, fa = p.fa ?? -90, th = p.th ?? -90, sh = p.sh ?? -90;
  const [elbow, hand] = arm(sh1, ua, fa, p.ik);
  const [elbow2, hand2] = arm(sh2, p.ua2 ?? mir(ua), p.fa2 ?? mir(fa), p.ik2 ?? (p.ik && front ? [-p.ik[0], p.ik[1], -p.ik[2]] : p.ik));
  const [knee, ankle] = leg(hp1, th, sh, p.ikL);
  const [knee2, ankle2] = leg(hp2, p.th2 ?? mir(th), p.sh2 ?? mir(sh), p.ikL2 ?? (p.ikL && front ? [-p.ikL[0], p.ikL[1], -p.ikL[2]] : p.ikL));

  const shinA = angleOf(knee, ankle);
  const shinA2 = angleOf(knee2, ankle2);
  const footLen = front ? 7 : L.foot;
  const toe = add(ankle, vec(p.ft ?? (front ? -20 : shinA + 90), footLen));
  const toe2 = add(ankle2, vec(p.ft2 ?? (front ? 200 : shinA2 + 90), footLen));
  const head = add(neck, vec(p.t + (p.h ?? 0), L.neck + L.head));

  return {
    hip, hip1: hp1, hip2: hp2, knee, knee2, ankle, ankle2, toe, toe2,
    shoulder: sh1, shoulder2: sh2, elbow, elbow2, hand, hand2, neck, head,
  };
}

/** Joint positions on the canvas. */
export function anchored(p: Pose): Record<Joint, V> {
  const j = joints(p);
  const [part, x, y] = p.at;
  let dx: number, dy: number;
  if (part === 'ground') {
    dx = x - j.hip[0];
    dy = GROUND - 3 - Math.max(j.ankle[1], j.ankle2[1], j.toe[1], j.toe2[1]);
  } else {
    dx = x - j[part][0];
    dy = (y ?? 0) - j[part][1];
  }
  for (const k of Object.keys(j) as Joint[]) j[k] = [j[k][0] + dx, j[k][1] + dy];
  return j;
}

const ANGLE_KEYS = new Set<keyof Pose>(['t', 'h', 'ua', 'fa', 'ua2', 'fa2', 'th', 'sh', 'th2', 'sh2', 'ft', 'ft2']);

/** Fills in defaults so two poses always have the same fields to blend. */
function normalize(p: Pose): Pose {
  const front = p.view === 'front' || p.view === 'back';
  const mir = (a: number) => (front ? 180 - a : a);
  const ua = p.ua ?? -90, fa = p.fa ?? -90, th = p.th ?? -90, sh = p.sh ?? -90;
  return {
    ...p,
    h: p.h ?? 0, tl: p.tl ?? 1, ll: p.ll ?? 1, al: p.al ?? 1, thl: p.thl ?? 1, sc: p.sc ?? 0,
    ua, fa, th, sh,
    ua2: p.ua2 ?? mir(ua), fa2: p.fa2 ?? mir(fa), th2: p.th2 ?? mir(th), sh2: p.sh2 ?? mir(sh),
  };
}

export function lerpPose(a0: Pose, b0: Pose, u: number): Pose {
  const a = normalize(a0);
  const b = normalize(b0);
  const out: Record<string, unknown> = { ...a };
  for (const key of Object.keys(b) as (keyof Pose)[]) {
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') {
      // Angles take the shorter way round; scale factors are linear.
      const d = ANGLE_KEYS.has(key) ? ((((vb - va + 540) % 360) + 360) % 360) - 180
        : key === 'sc' ? (((vb - va) % 1) + 1) % 1
        : vb - va;
      out[key] = va + d * u;
    }
    else if (Array.isArray(va) && Array.isArray(vb)) {
      out[key] = va.map((x, i) => (typeof x === 'number' && typeof vb[i] === 'number' ? x + ((vb[i] as number) - x) * u : x));
    } else if (va === undefined) out[key] = vb;
  }
  return out as unknown as Pose;
}

/** Pose at time `ms` for a move (smooth easing, short pause at the ends of a rep). */
export function poseAt(m: Move, ms: number): Pose {
  const n = m.frames.length;
  if (n === 1) return m.frames[0];
  const seg = m.ms ?? (m.loop ? 450 : 1100);
  const segs = m.loop ? n : 2 * (n - 1);
  const t = (ms / seg) % segs;
  const i = Math.floor(t);
  let u = t - i;
  let from: number, to: number;
  if (m.loop) { from = i; to = (i + 1) % n; }
  else if (i < n - 1) { from = i; to = i + 1; }
  else { from = segs - i; to = segs - i - 1; }
  if (!m.loop) u = Math.min(1, Math.max(0, (u - 0.12) / 0.76)); // hold at each end
  const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  return lerpPose(m.frames[from], m.frames[to], m.loop ? u : e);
}

// ---------------------------------------------------------------------------
// Drawing: an anatomical figure. Every body part has a contoured outline (skin) with
// individual muscles drawn on top; worked muscles are coloured, the rest stay neutral.

export type Muscle =
  | 'chest' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'biceps' | 'triceps' | 'forearms'
  | 'traps' | 'upperBack' | 'lats' | 'lowerBack' | 'abs' | 'obliques'
  | 'glutes' | 'hipFlexors' | 'quads' | 'adductors' | 'hamstrings' | 'calves' | 'cardio';

/** Primary (p) and secondary (s) muscles an exercise works. */
export interface Targets { p: Muscle[]; s: Muscle[] }

export type Cls = 'skin' | 'mu' | 'm1' | 'm2' | 'h1' | 'h2' | 'h3' | 'h4' | 'sel' | 'line' | 'heart' | 'prop' | 'band' | 'scene' | 'water';
export type Prim =
  | { k: 'l'; a: V; b: V; w: number; c: Cls }
  | { k: 'pl'; pts: V[]; w: number; c: Cls; dim?: boolean }
  | { k: 'c'; c: V; r: number; fill: boolean; w: number; cl: Cls; dim?: boolean }
  | { k: 'p'; pts: V[]; cl: Cls; dim?: boolean; mu?: Muscle }
  | { k: 'r'; x: number; y: number; w: number; h: number; cl: Cls };

/** Half-widths along a body part: [position along it, width on the + side, width on the − side]. */
type Prof = [t: number, plus: number, minus: number][];

/**
 * A body part between two joints. `n` points to the "+" side of the lanes: the front of the
 * body in side view, the inner (medial) side of a limb seen from the front or back.
 */
interface Seg { a: V; d: V; n: V; len: number; prof: Prof }

/** A muscle on a body part: from/to along it, and the lanes it spans (−1 … 1 of the local width). */
type Mu = [key: Muscle | null, t0: number, t1: number, lo: number, hi: number];
/** A definition line: along the part at a lane (from t0 to t1), or across it at t (lanes lo…hi). */
type Ln = ['along', t0: number, t1: number, lane: number] | ['across', t: number, lo: number, hi: number];

interface Part { prof: Prof; mus: Mu[]; lines?: Ln[] }

const smooth = (u: number) => u * u * (3 - 2 * u);

function widthAt(prof: Prof, t: number): [number, number] {
  if (t <= prof[0][0]) return [prof[0][1], prof[0][2]];
  for (let i = 1; i < prof.length; i++) {
    const [t1, p1, m1] = prof[i];
    const [t0, p0, m0] = prof[i - 1];
    if (t <= t1) {
      const u = smooth((t - t0) / (t1 - t0 || 1));
      return [p0 + (p1 - p0) * u, m0 + (m1 - m0) * u];
    }
  }
  const l = prof[prof.length - 1];
  return [l[1], l[2]];
}

const at = (s: Seg, t: number, off: number): V => [
  s.a[0] + s.d[0] * t * s.len + s.n[0] * off,
  s.a[1] + s.d[1] * t * s.len + s.n[1] * off,
];
const laneOff = (s: Seg, t: number, lane: number) => {
  const [p, m] = widthAt(s.prof, t);
  return lane >= 0 ? lane * p : lane * m;
};

function seg(a: V, b: V, prof: Prof, nSign: 1 | -1, scale = 1): Seg {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.001;
  const d: V = [dx / len, dy / len];
  return { a, d, n: [d[1] * nSign, -d[0] * nSign], len, prof: scale === 1 ? prof : prof.map(([t, p, m]) => [t, p * scale, m * scale]) };
}

/** Outline of a body part with rounded ends. */
function outline(s: Seg, scale = 1): V[] {
  const p = s.prof;
  const t0 = p[0][0];
  const t1 = p[p.length - 1][0];
  const N = 16;
  const plus: V[] = [];
  const minus: V[] = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const [wp, wm] = widthAt(p, t);
    plus.push(at(s, t, wp * scale));
    minus.push(at(s, t, -wm * scale));
  }
  const cap = (t: number, from: number, to: number): V[] => {
    const [wp, wm] = widthAt(p, t);
    const c = at(s, t, ((wp - wm) / 2) * scale);
    const r = ((wp + wm) / 2) * scale;
    const pts: V[] = [];
    for (let i = 1; i < 8; i++) {
      const th = from + ((to - from) * i) / 8;
      pts.push([
        c[0] + r * (s.n[0] * Math.cos(th) + s.d[0] * Math.sin(th) * 0.8),
        c[1] + r * (s.n[1] * Math.cos(th) + s.d[1] * Math.sin(th) * 0.8),
      ]);
    }
    return pts;
  };
  return [...plus, ...cap(t1, 0, Math.PI), ...minus.reverse(), ...cap(t0, Math.PI, 2 * Math.PI)];
}

/** A muscle belly: a lens between two lanes that narrows towards both ends. */
function belly(s: Seg, t0: number, t1: number, lo: number, hi: number): V[] {
  const N = 14;
  const a: V[] = [];
  const b: V[] = [];
  const c = (lo + hi) / 2;
  const h = (hi - lo) / 2;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const t = t0 + (t1 - t0) * u;
    const k = Math.pow(Math.sin(Math.PI * u), 0.32);
    a.push(at(s, t, laneOff(s, t, c + h * k)));
    b.push(at(s, t, laneOff(s, t, c - h * k)));
  }
  return [...a, ...b.reverse()];
}

/** The part of segment a–b inside box [x0, y0, x1, y1] (Liang–Barsky), or null. */
function clip(a: V, b: V, box: [number, number, number, number]): [V, V] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let u0 = 0;
  let u1 = 1;
  for (const [p, q] of [[-dx, a[0] - box[0]], [dx, box[2] - a[0]], [-dy, a[1] - box[1]], [dy, box[3] - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) u0 = Math.max(u0, r); else u1 = Math.min(u1, r);
    if (u0 > u1) return null;
  }
  return [[a[0] + dx * u0, a[1] + dy * u0], [a[0] + dx * u1, a[1] + dy * u1]];
}

/** Limbs are drawn a little fuller than the profiles below. */
const LIMB = 1.2;

// ----- Body parts -----------------------------------------------------------------
// Side view: + = front of the body. Front/back view: limbs + = inner side; torso symmetric.

const SIDE = {
  thigh: {
    prof: [[-0.06, 8, 8.6], [0.25, 8.3, 8], [0.62, 7, 6.2], [0.9, 5.7, 5.3], [1.02, 5.3, 5]],
    mus: [
      ['adductors', 0.04, 0.55, -0.24, 0.04],
      ['hamstrings', 0.1, 0.93, -0.95, -0.18],
      ['quads', 0.1, 0.97, -0.1, 0.95],
      ['hipFlexors', -0.04, 0.26, 0.12, 0.88],
    ],
    lines: [['along', 0.24, 0.84, 0.45]],
  },
  shin: {
    prof: [[0, 5.2, 5.1], [0.2, 4.7, 6.8], [0.42, 4.2, 6.1], [0.72, 3.4, 3.6], [1, 2.9, 2.9]],
    mus: [
      [null, 0.06, 0.8, 0.05, 0.9],
      ['calves', 0.35, 0.86, -0.82, -0.08],
      ['calves', 0.03, 0.6, -0.97, -0.06],
    ],
  },
  upperArm: {
    prof: [[-0.1, 6.6, 6.6], [0.2, 6.1, 6.3], [0.5, 4.7, 5.1], [0.85, 3.9, 4.1], [1, 3.7, 3.7]],
    mus: [
      ['triceps', 0.24, 0.96, -0.95, -0.04],
      ['biceps', 0.3, 0.9, 0.02, 0.95],
      ['sideDelts', -0.16, 0.46, -0.44, 0.44],
      ['rearDelts', -0.13, 0.42, -0.98, -0.3],
      ['frontDelts', -0.13, 0.42, 0.3, 0.98],
    ],
  },
  forearm: {
    prof: [[0, 3.8, 3.8], [0.22, 4.5, 4.1], [0.6, 3.3, 3], [1, 2.4, 2.4]],
    mus: [
      ['forearms', 0.03, 0.8, -0.92, 0],
      ['forearms', 0.03, 0.8, 0, 0.92],
    ],
  },
  torso: {
    prof: [[-0.17, 5, 6], [-0.05, 7.5, 10], [0.1, 8, 10.6], [0.26, 7.6, 8], [0.42, 7.2, 6.6], [0.6, 8.2, 7.6], [0.78, 10.2, 8.6], [0.92, 9.2, 8.2], [1.04, 6.2, 6.6], [1.12, 4, 4.6]],
    mus: [
      ['lowerBack', 0.1, 0.52, -0.95, -0.5],
      ['obliques', 0.08, 0.62, -0.38, 0.5],
      [null, 0.56, 0.78, -0.05, 0.55],
      ['lats', 0.34, 0.86, -0.95, -0.1],
      ['upperBack', 0.7, 1.02, -0.96, -0.44],
      ['abs', 0.04, 0.66, 0.5, 0.98],
      ['chest', 0.63, 0.98, 0.06, 0.98],
      ['traps', 0.86, 1.14, -0.72, 0.12],
    ],
    lines: [['across', 0.2, 0.56, 0.96], ['across', 0.34, 0.56, 0.96], ['across', 0.48, 0.56, 0.96]],
  },
  glutes: { prof: [], mus: [['glutes', -0.17, 0.25, -1, -0.16]] },
} satisfies Record<string, Part>;

const FRONT = {
  thigh: {
    prof: [[-0.06, 7.4, 8.6], [0.3, 7.2, 8.6], [0.7, 5.6, 6.6], [1, 4.8, 5.1]],
    mus: [
      ['adductors', 0.02, 0.56, 0.32, 0.98],
      ['quads', 0.1, 0.95, -0.96, 0.42],
      ['quads', 0.66, 0.96, 0.2, 0.86],
      ['hipFlexors', -0.04, 0.24, -0.62, 0.3],
    ],
    lines: [['along', 0.2, 0.78, -0.35]],
  },
  shin: {
    prof: [[0, 4.8, 4.9], [0.25, 5.6, 5.1], [0.55, 4, 4.1], [1, 2.6, 2.7]],
    mus: [
      [null, 0.06, 0.78, -0.88, 0.12],
      ['calves', 0.05, 0.56, 0.18, 0.98],
    ],
  },
  upperArm: {
    prof: [[-0.12, 5, 7.2], [0.2, 4.6, 6.8], [0.55, 4.4, 4.7], [1, 3.6, 3.7]],
    mus: [
      ['biceps', 0.3, 0.92, -0.62, 0.78],
      ['sideDelts', -0.18, 0.46, -0.98, -0.1],
      ['frontDelts', -0.15, 0.42, -0.22, 0.86],
    ],
  },
  forearm: {
    prof: [[0, 3.7, 4], [0.25, 4.1, 4.7], [1, 2.4, 2.4]],
    mus: [['forearms', 0.03, 0.8, -0.92, 0.92]],
    lines: [['along', 0.12, 0.7, 0.05]],
  },
  torso: {
    prof: [[-0.1, 8, 8], [0.02, 11.6, 11.6], [0.18, 12, 12], [0.42, 11, 11], [0.62, 12.4, 12.4], [0.8, 14.6, 14.6], [0.95, 15.2, 15.2], [1.05, 11.5, 11.5], [1.15, 4.6, 4.6]],
    mus: [
      [null, 0.56, 0.74, 0.58, 0.95],
      [null, 0.56, 0.74, -0.95, -0.58],
      // Gluteus medius, seen at the side of the hips.
      ['glutes', -0.2, 0.16, 0.64, 1.04],
      ['glutes', -0.2, 0.16, -1.04, -0.64],
      ['obliques', 0.02, 0.62, 0.4, 0.95],
      ['obliques', 0.02, 0.62, -0.95, -0.4],
      ['abs', -0.06, 0.66, 0.02, 0.37],
      ['abs', -0.06, 0.66, -0.37, -0.02],
      ['chest', 0.64, 0.99, 0.03, 0.88],
      ['chest', 0.64, 0.99, -0.88, -0.03],
      ['traps', 0.97, 1.17, 0.2, 0.76],
      ['traps', 0.97, 1.17, -0.76, -0.2],
    ],
    lines: [['across', 0.2, -0.36, 0.36], ['across', 0.34, -0.36, 0.36], ['across', 0.48, -0.36, 0.36]],
  },
} satisfies Record<string, Part>;

const BACK = {
  thigh: {
    prof: FRONT.thigh.prof,
    mus: [
      ['adductors', 0.02, 0.5, 0.42, 0.98],
      ['hamstrings', 0.1, 0.93, -0.94, -0.18],
      ['hamstrings', 0.1, 0.93, -0.24, 0.52],
    ],
  },
  shin: {
    prof: [[0, 4.9, 4.9], [0.25, 5.6, 5.6], [0.55, 4.2, 4.2], [1, 2.7, 2.7]],
    mus: [
      ['calves', 0.38, 0.86, -0.82, 0.82],
      ['calves', 0.03, 0.6, -0.98, 0],
      ['calves', 0.03, 0.64, 0, 0.98],
    ],
  },
  upperArm: {
    prof: FRONT.upperArm.prof,
    mus: [
      ['triceps', 0.26, 0.95, -0.86, 0.8],
      ['sideDelts', -0.18, 0.46, -0.98, -0.1],
      ['rearDelts', -0.15, 0.42, -0.22, 0.9],
    ],
    lines: [['along', 0.45, 0.9, 0.0]],
  },
  forearm: FRONT.forearm,
  torso: {
    prof: [[-0.2, 9, 9], [-0.05, 13, 13], [0.18, 12.4, 12.4], [0.42, 11, 11], [0.62, 12.6, 12.6], [0.8, 14.6, 14.6], [0.95, 15.2, 15.2], [1.05, 11.5, 11.5], [1.15, 4.6, 4.6]],
    mus: [
      ['obliques', 0.12, 0.46, 0.7, 0.98],
      ['obliques', 0.12, 0.46, -0.98, -0.7],
      ['lowerBack', 0.06, 0.52, 0.04, 0.36],
      ['lowerBack', 0.06, 0.52, -0.36, -0.04],
      ['lats', 0.28, 0.8, 0.24, 0.98],
      ['lats', 0.28, 0.8, -0.98, -0.24],
      ['upperBack', 0.64, 0.94, 0.26, 0.86],
      ['upperBack', 0.64, 0.94, -0.86, -0.26],
      ['traps', 0.52, 1.17, -0.56, 0.56],
      ['glutes', -0.2, 0.2, 0.02, 0.98],
      ['glutes', -0.2, 0.2, -0.98, -0.02],
    ],
  },
} satisfies Record<string, Part>;

/** Draws a pose. Muscles are coloured by `paint` if given, else by the exercise targets. */
export function draw(m: Move, p: Pose, tg?: Targets, paint?: (mu: Muscle) => Cls): Prim[] {
  const j = anchored(p);
  const out: Prim[] = [];
  const view = p.view ?? 'side';
  const front = view !== 'side';
  const B = view === 'side' ? SIDE : view === 'front' ? FRONT : BACK;
  const [vx, , vw] = m.vb ?? [0, 0, VIEW.w, VIEW.h];
  const line = (a: V, b: V, w: number, c: Cls) => out.push({ k: 'l', a, b, w, c });
  const poly = (pts: V[], cl: Cls, dim = false, mu?: Muscle) => out.push({ k: 'p', pts, cl, dim, mu });
  const level = (mu: Muscle | null): Cls => (!mu ? 'mu' : paint ? paint(mu) : tg?.p.includes(mu) ? 'm1' : tg?.s.includes(mu) ? 'm2' : 'mu');

  const muscles = (s: Seg, part: Part, dim: boolean) => {
    for (const [key, t0, t1, lo, hi] of part.mus) poly(belly(s, t0, t1, lo, hi), level(key), dim, key ?? undefined);
    for (const ln of part.lines ?? []) {
      const pts: V[] = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        if (ln[0] === 'along') {
          const t = ln[1] + (ln[2] - ln[1]) * u;
          pts.push(at(s, t, laneOff(s, t, ln[3])));
        } else {
          const lane = ln[2] + (ln[3] - ln[2]) * u;
          pts.push(at(s, ln[1], laneOff(s, ln[1], lane)));
        }
      }
      out.push({ k: 'pl', pts, w: 0.6, c: 'line', dim });
    }
  };

  /** A body part: skin outline, then its muscles. */
  const part = (a: V, b: V, pt: Part, nSign: 1 | -1, dim: boolean) => {
    const s = seg(a, b, pt.prof, nSign, LIMB);
    poly(outline(s), 'skin', dim);
    muscles(s, pt, dim);
    return s;
  };

  /** Hands, feet and head: skin outline with a lighter fill inside. */
  const blob = (s: Seg, dim: boolean) => {
    poly(outline(s), 'skin', dim);
    poly(outline(s, 0.72), 'mu', dim);
  };

  // In side view + is the front of the limb; facing the viewer (or from behind) + is the
  // inner side, which depends on which side of the body the limb is on.
  const across = vec(p.t - 90, 1);
  const sideOf = (root: V, centre: V): 1 | -1 => ((root[0] - centre[0]) * across[0] + (root[1] - centre[1]) * across[1] >= 0 ? 1 : -1);
  const limbSign = (root: V, centre: V): 1 | -1 => (front ? (-sideOf(root, centre) as 1 | -1) : 1);

  const foot = (ankle: V, toe: V, knee: V, dim: boolean) => {
    const s0 = seg(ankle, toe, [[-0.32, 2.6, 2.2], [0, 3.3, 2.7], [0.55, 2.2, 2.4], [1, 1.5, 1.9]], 1);
    // + must point up the leg (away from the sole).
    if (s0.n[0] * (knee[0] - ankle[0]) + s0.n[1] * (knee[1] - ankle[1]) < 0) s0.n = [-s0.n[0], -s0.n[1]];
    if (front) s0.prof = [[-0.2, 2.6, 2.6], [0.4, 3.2, 3], [1, 2.2, 2.2]];
    blob(s0, dim);
  };
  const hand = (wrist: V, dir: V, dim: boolean) => {
    const tip: V = [wrist[0] + dir[0] * 7, wrist[1] + dir[1] * 7];
    blob(seg(wrist, tip, [[-0.05, 2.6, 2.6], [0.45, 3.3, 3.1], [0.9, 2.4, 2.4]], 1), dim);
  };
  const unit = (a: V, b: V): V => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };

  const leg = (hip: V, knee: V, ankle: V, toe: V, dim: boolean) => {
    const sg = limbSign(hip, j.hip);
    foot(ankle, toe, knee, dim);
    part(knee, ankle, B.shin, sg, dim);
    const th = part(hip, knee, B.thigh, sg, dim);
    // Kneecap (front and side views).
    if (view !== 'back') {
      const kc = view === 'side' ? at(th, 0.98, 4.2) : at(th, 0.96, laneOff(th, 0.96, 0.1));
      out.push({ k: 'c', c: kc, r: 2.4, fill: true, w: 0, cl: 'mu', dim });
    }
  };
  const arm = (sh: V, el: V, hd: V, dim: boolean) => {
    const sg = limbSign(sh, j.neck);
    hand(hd, unit(el, hd), dim);
    part(el, hd, B.forearm, sg, dim);
    part(sh, el, B.upperArm, sg, dim);
  };

  const propPrims = (pr: Prop) => {
    switch (pr.k) {
      case 'db': {
        const c = j[pr.at];
        if (pr.hang) {
          // Held by the top plate with both hands, hanging between the legs.
          line([c[0], c[1]], [c[0], c[1] + 18], 3, 'prop');
          line([c[0] - 7, c[1] + 1], [c[0] + 7, c[1] + 1], 5, 'prop');
          line([c[0] - 7, c[1] + 19], [c[0] + 7, c[1] + 19], 5, 'prop');
        } else if (pr.front) {
          line([c[0] - 8, c[1]], [c[0] + 8, c[1]], 3, 'prop');
          line([c[0] - 9, c[1] - 6], [c[0] - 9, c[1] + 6], 5, 'prop');
          line([c[0] + 9, c[1] - 6], [c[0] + 9, c[1] + 6], 5, 'prop');
        } else {
          out.push({ k: 'c', c, r: 6.5, fill: true, w: 0, cl: 'prop' });
          out.push({ k: 'c', c, r: 3.2, fill: false, w: 1.2, cl: 'scene' });
        }
        break;
      }
      case 'bb': {
        let c: V = [j[pr.at][0] + (pr.dx ?? 0), j[pr.at][1] + (pr.dy ?? 0)];
        if (pr.tb) c = add(add(c, vec(p.t, pr.tb[0])), vec(p.t + 90, pr.tb[1]));
        out.push({ k: 'c', c, r: 17, fill: false, w: 3.5, cl: 'prop' });
        out.push({ k: 'c', c, r: 3, fill: true, w: 0, cl: 'prop' });
        break;
      }
      case 'plate':
        out.push({ k: 'c', c: j[pr.at], r: 10, fill: false, w: 4, cl: 'prop' });
        break;
      case 'wheel':
        out.push({ k: 'c', c: j[pr.at], r: 8, fill: false, w: 3.5, cl: 'prop' });
        out.push({ k: 'c', c: j[pr.at], r: 2.5, fill: true, w: 0, cl: 'prop' });
        break;
      case 'pad': {
        const c = j[pr.at];
        const w = pr.w ?? 22;
        out.push({ k: 'r', x: c[0] - w / 2, y: c[1] + (pr.dy ?? 4), w, h: 6, cl: 'prop' });
        break;
      }
      case 'grip':
        out.push({ k: 'c', c: j[pr.at], r: 3.5, fill: true, w: 0, cl: 'prop' });
        break;
      case 'rod':
        line(pr.from, j[pr.to], pr.w ?? 5, 'prop');
        break;
      case 'roll': {
        const a = j[pr.at];
        const d = unit(a, j[pr.toward]);
        out.push({ k: 'c', c: [a[0] + d[0] * pr.d, a[1] + d[1] * pr.d], r: 4.5, fill: true, w: 0, cl: 'prop' });
        break;
      }
      case 'stairs': {
        const f = ((p.sc ?? 0) % 1 + 1) % 1;
        const x0 = pr.x - f * pr.w;
        const y0 = pr.y + f * pr.h;
        for (let k = -8; k <= 8; k++) {
          const tx = x0 + k * pr.w;
          const ty = y0 - k * pr.h;
          for (const [a, b] of [[[tx, ty], [tx + pr.w, ty]], [[tx + pr.w, ty], [tx + pr.w, ty - pr.h]]] as [V, V][]) {
            const s = clip(a, b, pr.box);
            if (s) line(s[0], s[1], 4, 'scene');
          }
        }
        break;
      }
      case 'band':
        line(j[pr.a], j[pr.b], 3, 'band');
        break;
      case 'kb': {
        const c = j[pr.at];
        out.push({ k: 'c', c: [c[0], c[1] + 9], r: 8, fill: true, w: 0, cl: 'prop' });
        out.push({ k: 'c', c: [c[0], c[1] + 2], r: 4, fill: false, w: 2.5, cl: 'prop' });
        break;
      }
      case 'seg': {
        const c: V = [j[pr.at][0] + (pr.dx ?? 0), j[pr.at][1] + (pr.dy ?? 0)];
        const d = vec(pr.a, pr.len / 2);
        line([c[0] - d[0], c[1] - d[1]], [c[0] + d[0], c[1] + d[1]], pr.w ?? 5, 'prop');
        break;
      }
      case 'cable':
        line(pr.from, j[pr.to], 1.5, 'scene');
        break;
      case 'line':
        line(pr.a, pr.b, pr.w ?? 4, 'scene');
        break;
      case 'rect':
        out.push({ k: 'r', x: pr.x, y: pr.y, w: pr.w, h: pr.h, cl: 'scene' });
        break;
      case 'circle':
        out.push({ k: 'c', c: pr.c, r: pr.r, fill: !!pr.fill, w: 3, cl: 'scene' });
        break;
      case 'water':
        line([vx, pr.y], [vx + vw, pr.y], 2, 'water');
        break;
    }
  };

  const props = m.props ?? [];
  const isScenery = (pr: Prop) => pr.k === 'stairs' || pr.k === 'rod' || pr.k === 'line' || pr.k === 'rect' || pr.k === 'circle' || pr.k === 'cable' || pr.k === 'water';
  const isFar = (pr: Prop) => 'at' in pr && pr.at.endsWith('2');

  if (!m.noFloor) line([vx, GROUND], [vx + vw, GROUND], 2, 'scene');
  props.filter(isScenery).forEach(propPrims);

  const headDir = vec(p.t + (p.h ?? 0), 1);
  const torsoPart = (dim: boolean) => {
    const ts = seg(j.hip, j.neck, B.torso.prof, -1);
    // Neck, then the head (with an ear in side view so you can tell which way it faces).
    const neckTop: V = [j.neck[0] + headDir[0] * 9, j.neck[1] + headDir[1] * 9];
    const ns = seg(j.neck, neckTop, front ? [[0, 5, 5], [0.9, 4, 4]] : [[0, 4.8, 4.4], [0.9, 3.9, 3.9]], -1);
    poly(outline(ns), 'skin', dim);
    poly(outline(ns, 0.7), 'mu', dim);
    const hs = seg(
      [j.head[0] - headDir[0] * 9.5, j.head[1] - headDir[1] * 9.5],
      [j.head[0] + headDir[0] * 9.5, j.head[1] + headDir[1] * 9.5],
      front ? [[0.04, 7.2, 7.2], [0.5, 8.4, 8.4], [0.96, 6.2, 6.2]] : [[0.04, 6.4, 5.4], [0.3, 8.4, 7], [0.6, 8.2, 8.6], [0.96, 5.6, 6.4]],
      -1,
    );
    poly(outline(hs), 'skin', dim);
    poly(outline(hs, 0.84), 'mu', dim);
    if (view === 'side') out.push({ k: 'c', c: at(hs, 0.5, -1.6), r: 1.7, fill: true, w: 0, cl: 'skin', dim });
    poly(outline(ts), 'skin', dim);
    muscles(ts, B.torso, dim);
    if (tg?.p.includes('cardio') || tg?.s.includes('cardio')) {
      out.push({ k: 'c', c: at(ts, 0.76, front ? (view === 'back' ? 0 : 4) : 2.5), r: 4, fill: true, w: 0, cl: 'heart' });
    }
    return ts;
  };

  if (front) {
    leg(j.hip2, j.knee2, j.ankle2, j.toe2, false);
    leg(j.hip1, j.knee, j.ankle, j.toe, false);
    torsoPart(false);
    arm(j.shoulder2, j.elbow2, j.hand2, false);
    props.filter((pr) => !isScenery(pr) && isFar(pr)).forEach(propPrims);
    arm(j.shoulder, j.elbow, j.hand, false);
  } else {
    leg(j.hip2, j.knee2, j.ankle2, j.toe2, true);
    arm(j.shoulder2, j.elbow2, j.hand2, true);
    props.filter((pr) => !isScenery(pr) && isFar(pr)).forEach(propPrims);
    const ts = torsoPart(false);
    leg(j.hip1, j.knee, j.ankle, j.toe, false);
    // The near glute sits over the top of the near thigh.
    for (const [key, t0, t1, lo, hi] of SIDE.glutes.mus) poly(belly(ts, t0, t1, lo, hi), level(key), false, key ?? undefined);
    arm(j.shoulder, j.elbow, j.hand, false);
  }
  props.filter((pr) => !isScenery(pr) && !isFar(pr)).forEach(propPrims);
  return out;
}
