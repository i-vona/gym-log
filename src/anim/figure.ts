// Stick-figure engine for exercise animations. Pure geometry, no DOM, so it can be
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
  /** leg / arm length scale (foreshortening) */
  ll?: number;
  al?: number;
  ik?: IK; ik2?: IK; ikL?: IK; ikL2?: IK;
  /** Which joint is pinned where. 'ground': hip x fixed, lowest foot on the floor. */
  at: [Joint | 'ground', number, number?];
}

export type Prop =
  | { k: 'db'; at: Joint; front?: boolean }
  | { k: 'bb'; at: Joint; dx?: number; dy?: number }
  | { k: 'plate'; at: Joint }
  | { k: 'wheel'; at: Joint }
  | { k: 'pad'; at: Joint; dy?: number; w?: number }
  | { k: 'grip'; at: Joint }
  | { k: 'band'; a: Joint; b: Joint }
  | { k: 'kb'; at: Joint }
  | { k: 'rod'; from: V; to: Joint }
  | { k: 'seg'; at: Joint; a: number; len: number; w?: number }
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

export type Cls = 'body' | 'bodyFar' | 'm1' | 'm2' | 'heart' | 'prop' | 'band' | 'scene' | 'water';
export type Prim =
  | { k: 'l'; a: V; b: V; w: number; c: Cls }
  | { k: 'c'; c: V; r: number; fill: boolean; w: number; cl: Cls; dim?: boolean }
  | { k: 'p'; pts: V[]; cl: Cls; edge?: boolean; dim?: boolean }
  | { k: 'r'; x: number; y: number; w: number; h: number; cl: Cls };

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
  const leg = (s: V, th: number, sh: number, ik?: IK): [V, V] => {
    if (ik) return solveIK(s, [ik[0], ik[1]], L.th * ll, L.sh * ll, ik[2]);
    const k = add(s, vec(th, L.th * ll));
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

function anchored(p: Pose): Record<Joint, V> {
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
    h: p.h ?? 0, tl: p.tl ?? 1, ll: p.ll ?? 1, al: p.al ?? 1,
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
      const d = ANGLE_KEYS.has(key) ? ((((vb - va + 540) % 360) + 360) % 360) - 180 : vb - va;
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
// Drawing: a body with volume (tapered limbs, shaped torso) plus muscle highlights.

export type Muscle =
  | 'chest' | 'shoulders' | 'rearDelts' | 'triceps' | 'biceps' | 'forearms'
  | 'lats' | 'upperBack' | 'lowerBack' | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'hipFlexors' | 'calves' | 'cardio';

/** Primary (p) and secondary (s) muscles an exercise works. */
export interface Targets { p: Muscle[]; s: Muscle[] }

type Belly = [from: number, to: number, side: number, offset: number, width: number];

// Where each muscle sits on a body segment: fraction along the segment, which side
// (+1 front, -1 back, 0 middle), how far from the centre line, and half-width.
const TORSO: Partial<Record<Muscle, Belly>> = {
  chest: [0.56, 0.93, 1, 5, 5],
  abs: [0.1, 0.55, 1, 5, 4.5],
  obliques: [0.12, 0.55, 0, 0, 4],
  lats: [0.4, 0.85, -1, 4.5, 5],
  upperBack: [0.72, 1.0, -1, 4.5, 5],
  lowerBack: [0.04, 0.4, -1, 5, 4],
  glutes: [-0.1, 0.18, -1, 5.5, 7],
};
const UPPER_ARM: Partial<Record<Muscle, Belly>> = {
  biceps: [0.25, 0.85, 1, 2, 3.2],
  triceps: [0.25, 0.85, -1, 2, 3.4],
  shoulders: [-0.05, 0.32, 0, 0, 6.2],
  rearDelts: [-0.05, 0.32, -1, 1.5, 5.6],
};
const FOREARM: Partial<Record<Muscle, Belly>> = { forearms: [0.05, 0.65, 0, 0, 3.4] };
const THIGH: Partial<Record<Muscle, Belly>> = {
  quads: [0.15, 0.88, 1, 2.6, 5],
  hamstrings: [0.15, 0.85, -1, 2.6, 4.6],
  hipFlexors: [0, 0.3, 1, 3, 3.6],
};
const SHIN: Partial<Record<Muscle, Belly>> = { calves: [0.08, 0.6, -1, 2, 4] };

function capsule(a: V, b: V, r1: number, r2: number): V[] {
  const base = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const pts: V[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = base - Math.PI / 2 + (Math.PI * i) / 8;
    pts.push([b[0] + Math.cos(t) * r2, b[1] + Math.sin(t) * r2]);
  }
  for (let i = 0; i <= 8; i++) {
    const t = base + Math.PI / 2 + (Math.PI * i) / 8;
    pts.push([a[0] + Math.cos(t) * r1, a[1] + Math.sin(t) * r1]);
  }
  return pts;
}

function ellipse(c: V, angle: number, rx: number, ry: number): V[] {
  const pts: V[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    pts.push([c[0] + x * Math.cos(angle) - y * Math.sin(angle), c[1] + x * Math.sin(angle) + y * Math.cos(angle)]);
  }
  return pts;
}

/** Unit vector along a→b and the normal pointing to the segment's front (anterior) side. */
function frame(a: V, b: V, limb: boolean) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const d: V = [dx / len, dy / len];
  // Limbs hang down with their front facing forward; the torso points up.
  const n: V = limb ? [d[1], -d[0]] : [-d[1], d[0]];
  return { d, n, len, angle: Math.atan2(dy, dx) };
}

export function draw(m: Move, p: Pose, tg?: Targets): Prim[] {
  const j = anchored(p);
  const out: Prim[] = [];
  const front = p.view === 'front' || p.view === 'back';
  const [vx, , vw] = m.vb ?? [0, 0, VIEW.w, VIEW.h];
  const line = (a: V, b: V, w: number, c: Cls) => out.push({ k: 'l', a, b, w, c });
  const poly = (pts: V[], cl: Cls, edge = false, dim = false) => out.push({ k: 'p', pts, cl, edge, dim });
  const level = (mu: Muscle): Cls | null => (tg?.p.includes(mu) ? 'm1' : tg?.s.includes(mu) ? 'm2' : null);

  /** Muscle bellies on one segment. */
  const muscles = (a: V, b: V, table: Partial<Record<Muscle, Belly>>, limb: boolean, dim: boolean) => {
    const f = frame(a, b, limb);
    for (const mu of Object.keys(table) as Muscle[]) {
      const cl = level(mu);
      if (!cl) continue;
      const [f0, f1, side, off, w] = table[mu]!;
      // Facing the viewer only front muscles show; from behind only back ones.
      if (front && (p.view === 'back' ? side > 0 || mu === 'chest' : side < 0)) continue;
      const along = ((f0 + f1) / 2) * f.len;
      const o = front ? 0 : side * off;
      if (p.view === 'back' && mu === 'obliques') continue;
      const base: V = [a[0] + f.d[0] * along + f.n[0] * o, a[1] + f.d[1] * along + f.n[1] * o];
      const centres: V[] = [];
      if (front && !limb && (mu === 'chest' || mu === 'obliques' || mu === 'lats' || mu === 'glutes')) {
        const s = mu === 'chest' || mu === 'glutes' ? 6.5 : mu === 'lats' ? 9 : 10;
        centres.push([base[0] + f.n[0] * s, base[1] + f.n[1] * s], [base[0] - f.n[0] * s, base[1] - f.n[1] * s]);
      } else centres.push(base);
      const rx = Math.max(3, ((f1 - f0) * f.len) / 2);
      for (const c of centres) poly(ellipse(c, f.angle, rx, front && mu === 'chest' ? 5.5 : w), cl, false, dim);
    }
  };

  const body = (dim: boolean): Cls => (dim ? 'bodyFar' : 'body');

  const leg = (hip: V, knee: V, ankle: V, toe: V, dim: boolean) => {
    poly(capsule(hip, knee, 8, 6), body(dim), true, dim);
    muscles(hip, knee, THIGH, true, dim);
    poly(capsule(knee, ankle, 6, 4.2), body(dim), true, dim);
    muscles(knee, ankle, SHIN, true, dim);
    poly(capsule(ankle, toe, 3.8, 2.8), body(dim), true, dim);
  };
  const arm = (sh: V, el: V, hand: V, dim: boolean) => {
    poly(capsule(sh, el, 5.6, 4.4), body(dim), true, dim);
    muscles(sh, el, UPPER_ARM, true, dim);
    poly(capsule(el, hand, 4.4, 3.4), body(dim), true, dim);
    muscles(el, hand, FOREARM, true, dim);
    out.push({ k: 'c', c: hand, r: 4, fill: true, w: 0, cl: body(dim), dim });
  };

  const propPrims = (pr: Prop) => {
    switch (pr.k) {
      case 'db': {
        const c = j[pr.at];
        if (pr.front) {
          line([c[0] - 8, c[1]], [c[0] + 8, c[1]], 3, 'prop');
          line([c[0] - 9, c[1] - 6], [c[0] - 9, c[1] + 6], 5, 'prop');
          line([c[0] + 9, c[1] - 6], [c[0] + 9, c[1] + 6], 5, 'prop');
        } else out.push({ k: 'c', c, r: 6.5, fill: true, w: 0, cl: 'prop' });
        break;
      }
      case 'bb': {
        const c: V = [j[pr.at][0] + (pr.dx ?? 0), j[pr.at][1] + (pr.dy ?? 0)];
        out.push({ k: 'c', c, r: 17, fill: false, w: 4, cl: 'prop' });
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
        line(pr.from, j[pr.to], 5, 'prop');
        break;
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
        const c = j[pr.at];
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
  const isScenery = (pr: Prop) => pr.k === 'rod' || pr.k === 'line' || pr.k === 'rect' || pr.k === 'circle' || pr.k === 'cable' || pr.k === 'water';
  const isFar = (pr: Prop) => 'at' in pr && pr.at.endsWith('2');

  if (!m.noFloor) line([vx, GROUND], [vx + vw, GROUND], 2, 'scene');
  props.filter(isScenery).forEach(propPrims);

  // Far side (dimmed) first.
  // (Facing the viewer, both arms are in front of the torso, so the far arm comes later.)
  leg(j.hip2, j.knee2, j.ankle2, j.toe2, !front);
  if (!front) {
    arm(j.shoulder2, j.elbow2, j.hand2, true);
    props.filter((pr) => !isScenery(pr) && isFar(pr)).forEach(propPrims);
  }

  // Torso: shaped outline (hips, waist, chest, shoulders).
  const tf = frame(j.hip, j.neck, false);
  const prof: [number, number, number][] = front
    ? [[0, 13, 13], [0.45, 11, 11], [0.78, 15, 15], [1, 14, 14]]
    : [[0, 8, 9.5], [0.45, 7, 7], [0.76, 10, 8], [1, 7, 7.5]];
  const at = (f: number, s: number): V => [
    j.hip[0] + tf.d[0] * f * tf.len + tf.n[0] * s,
    j.hip[1] + tf.d[1] * f * tf.len + tf.n[1] * s,
  ];
  const torso: V[] = [
    ...prof.map(([f, fw]) => at(f, fw)),
    at(1.08, 0),
    ...[...prof].reverse().map(([f, , bw]) => at(f, -bw)),
    at(-0.1, 0),
  ];
  if (front) poly(capsule(j.shoulder, j.shoulder2, 6.5, 6.5), 'body', true);
  poly(torso, 'body', true);
  if (!front) muscles(j.hip, j.neck, TORSO, false, false);
  if (tg?.p.includes('cardio') || tg?.s.includes('cardio')) {
    out.push({ k: 'c', c: at(0.72, front ? -5 : 3), r: 4.5, fill: true, w: 0, cl: 'heart' });
  }
  poly(capsule(j.neck, add(j.neck, vec(p.t + (p.h ?? 0), 9)), 4.5, 4.5), 'body', true);
  out.push({ k: 'c', c: j.head, r: 10, fill: true, w: 0, cl: 'body' });

  // Near side.
  if (front) {
    arm(j.shoulder2, j.elbow2, j.hand2, false);
    props.filter((pr) => !isScenery(pr) && isFar(pr)).forEach(propPrims);
  }
  leg(j.hip1, j.knee, j.ankle, j.toe, false);
  // Facing the viewer (or from behind), the thighs would cover glutes/abs, so draw torso muscles on top.
  if (front) muscles(j.hip, j.neck, TORSO, false, false);
  arm(j.shoulder, j.elbow, j.hand, false);
  props.filter((pr) => !isScenery(pr) && !isFar(pr)).forEach(propPrims);
  return out;
}
