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
  view?: 'side' | 'front';
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

export type Cls = 'fig' | 'far' | 'prop' | 'scene' | 'water';
export type Prim =
  | { k: 'l'; a: V; b: V; w: number; c: Cls }
  | { k: 'c'; c: V; r: number; fill: boolean; w: number; cl: Cls }
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
  const front = p.view === 'front';
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
  const front = p.view === 'front';
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

export function draw(m: Move, p: Pose): Prim[] {
  const j = anchored(p);
  const out: Prim[] = [];
  const line = (a: V, b: V, w: number, c: Cls) => out.push({ k: 'l', a, b, w, c });
  const front = p.view === 'front';

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
  const isScenery = (pr: Prop) => pr.k === 'line' || pr.k === 'rect' || pr.k === 'circle' || pr.k === 'cable' || pr.k === 'water';
  const isFar = (pr: Prop) => 'at' in pr && pr.at.endsWith('2');

  const [vx, , vw] = m.vb ?? [0, 0, VIEW.w, VIEW.h];
  if (!m.noFloor) line([vx, GROUND], [vx + vw, GROUND], 2, 'scene');
  props.filter(isScenery).forEach(propPrims);

  // Far limbs first, then torso and head, then near limbs.
  const W = 7;
  line(j.hip2, j.knee2, W, 'far'); line(j.knee2, j.ankle2, W, 'far'); line(j.ankle2, j.toe2, 5, 'far');
  line(j.shoulder2, j.elbow2, W, 'far'); line(j.elbow2, j.hand2, W, 'far');
  props.filter((pr) => !isScenery(pr) && isFar(pr)).forEach(propPrims);

  line(j.hip, j.neck, 10, 'fig');
  if (front) {
    line(j.shoulder, j.shoulder2, 8, 'fig');
    line(j.hip1, j.hip2, 8, 'fig');
  }
  out.push({ k: 'c', c: j.head, r: L.head, fill: true, w: 0, cl: 'fig' });

  line(j.hip1, j.knee, W, 'fig'); line(j.knee, j.ankle, W, 'fig'); line(j.ankle, j.toe, 5, 'fig');
  line(j.shoulder, j.elbow, W, 'fig'); line(j.elbow, j.hand, W, 'fig');
  props.filter((pr) => !isScenery(pr) && !isFar(pr)).forEach(propPrims);
  return out;
}
