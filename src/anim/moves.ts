import { anchored, type IK, type Joint, type Move, type Pose, type V } from './figure';

// Ankle height when standing on the floor.
const A = 178;

type Loose = Omit<Pose, 'at'> & { at?: Pose['at'] };

/** Anchors a pose by its hip so that joint `j` lands on (x, y). */
function pin(p: Loose, j: Joint, x: number, y: number): Pose {
  const q = anchored({ ...p, at: ['hip', 0, 0] });
  return { ...p, at: ['hip', x - q[j][0], y - q[j][1]] };
}
/** Canvas position of a joint. */
const pos = (p: Pose, j: Joint): V => anchored(p)[j];
/** IK target (relative to the hip) that puts a hand or foot on the canvas point (x, y). */
function to(p: Pose, x: number, y: number, bend: number): IK {
  const h = anchored(p).hip;
  return [x - h[0], y - h[1], bend];
}
/** Push-up style move: the hands stay where they are in the top position. */
function handsFixed(top: Pose, bottom: Pose, bend = -1): Pose[] {
  const h = pos(top, 'hand');
  return [{ ...top, ik: to(top, h[0], h[1], bend) }, { ...bottom, ik: to(bottom, h[0], h[1], bend) }];
}
/** Split stance: the back foot stays on `back` while the front leg bends. */
function backFoot(frames: Pose[], back: V, bend: number): Pose[] {
  return frames.map((p) => ({ ...p, ikL2: to(p, back[0], back[1], bend) }));
}

/** Swaps near and far limbs (for alternating movements like walking). */
function swap(p: Pose): Pose {
  return {
    ...p,
    ua: p.ua2 ?? p.ua, fa: p.fa2 ?? p.fa, ua2: p.ua, fa2: p.fa,
    th: p.th2 ?? p.th, sh: p.sh2 ?? p.sh, th2: p.th, sh2: p.sh,
    ik: p.ik2, ik2: p.ik, ikL: p.ikL2, ikL2: p.ikL,
  };
}

const bench = (x: number, y: number, w: number) => [
  { k: 'rect' as const, x, y, w, h: 7 },
  { k: 'line' as const, a: [x + 8, y + 7] as [number, number], b: [x + 8, 182] as [number, number], w: 4 },
  { k: 'line' as const, a: [x + w - 8, y + 7] as [number, number], b: [x + w - 8, 182] as [number, number], w: 4 },
];

const walkA: Pose = { t: 88, th: -68, sh: -95, th2: -112, sh2: -125, ua: -105, fa: -95, ua2: -75, fa2: -65, at: ['ground', 100] };
const walkB: Pose = { t: 88, th: -92, sh: -92, th2: -85, sh2: -120, ua: -90, fa: -85, ua2: -90, fa2: -80, at: ['ground', 100] };
const walk = [walkA, walkB, swap(walkA), swap(walkB)];

// Running: elbows bent about 90°, arms swing opposite to the legs, slight forward lean.
// Contact (near foot lands just ahead of the hips), mid-stance (knee bent, other heel kicked up
// under the hips), toe-off (near leg pushes off behind, other knee drives forward).
const runContact: Pose = { t: 82, th: -64, sh: -97, th2: -116, sh2: -160, ua: -122, fa: -35, ua2: -58, fa2: 30, at: ['ground', 100] };
const runMid: Pose = { t: 82, th: -88, sh: -108, th2: -72, sh2: -172, ua: -98, fa: -10, ua2: -82, fa2: 12, at: ['ground', 100] };
const runPush: Pose = { t: 82, th: -118, sh: -136, th2: -42, sh2: -102, ua: -58, fa: 30, ua2: -122, fa2: -35, at: ['ground', 100] };
const run = [runContact, runMid, runPush, swap(runContact), swap(runMid), swap(runPush)];

/** Points on a circle/ellipse, relative to the hip, for pedalling motions. */
function orbit(cx: number, cy: number, rx: number, ry: number, n: number, bend: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const b = a + Math.PI;
    return {
      ikL: [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, bend] as [number, number, number],
      ikL2: [cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, bend] as [number, number, number],
    };
  });
}

export const MOVES: Record<string, Move> = {
  squat: {
    props: [{ k: 'bb', at: 'shoulder', tb: [-2, 9] }],
    frames: [
      { t: 90, ua: -120, fa: 60, at: ['ankle', 100, A] },
      { t: 50, ua: -160, fa: 20, th: 0, sh: -110, at: ['ankle', 100, A] },
    ],
  },
  deadlift: {
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      { t: 22, ua: -90, fa: -90, th: -25, sh: -110, at: ['ankle', 92, A] },
      { t: 90, ua: -82, fa: -82, at: ['ankle', 92, A] },
    ],
  },
  rdl: {
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      { t: 90, ua: -84, fa: -84, th: -88, sh: -94, at: ['ankle', 100, A] },
      // Hips pushed back, shins nearly vertical, flat back, bar slid down the thighs to the knees.
      { t: 28, ua: -108, fa: -108, th: -57, sh: -99, at: ['ankle', 100, A] },
    ],
  },
  bench: {
    props: [...bench(30, 120, 120), { k: 'bb', at: 'hand' }],
    frames: [
      // Bar over the shoulders, lowered to the lower chest with the elbows below the bench line.
      { t: 180, ik: [-50, -52, 1], th: -30, sh: -95, at: ['hip', 110, 113] },
      { t: 180, ik: [-42, -13, 1], th: -30, sh: -95, at: ['hip', 110, 113] },
    ],
  },
  ohp: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      // From the front of the shoulders straight up to locked arms over the head.
      { t: 90, ik: [10, -50, 1], at: ['ankle', 100, A] },
      { t: 90, ik: [2, -104, 1], at: ['ankle', 100, A] },
    ],
  },
  dbOhp: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ik: [6, -58, 1], at: ['ankle', 100, A] },
      { t: 90, ik: [2, -104, 1], at: ['ankle', 100, A] },
    ],
  },
  row: {
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      // Bar hangs under the shoulders, pulled to the upper belly with the elbows going back.
      { t: 25, ik: [51, 31, 1], th: -65, sh: -100, at: ['ankle', 110, A] },
      { t: 25, ik: [32, -2, 1], th: -65, sh: -100, at: ['ankle', 110, A] },
    ],
  },
  pullup: {
    noFloor: true,
    vb: [0, -12, 200, 202],
    props: [{ k: 'line', a: [50, 30], b: [150, 30], w: 5 }],
    frames: [
      // Dead hang, then chin over the bar with the elbows driven down to the sides.
      { t: 90, ik: [3, -105, 1], th: -75, sh: -165, at: ['hand', 100, 30] },
      { t: 95, ik: [3, -52, 1], th: -75, sh: -165, at: ['hand', 100, 30] },
    ],
  },
  assistedPullup: {
    noFloor: true,
    vb: [0, -12, 200, 202],
    props: [{ k: 'line', a: [50, 30], b: [150, 30], w: 5 }, { k: 'pad', at: 'knee', dy: 3, w: 30 }],
    frames: [
      { t: 90, ik: [3, -105, 1], th: -60, sh: -175, at: ['hand', 100, 30] },
      { t: 95, ik: [3, -52, 1], th: -60, sh: -175, at: ['hand', 100, 30] },
    ],
  },
  latPulldown: {
    props: [
      { k: 'rect', x: 70, y: 146, w: 45, h: 6 },
      { k: 'line', a: [92, 152], b: [92, 182], w: 4 },
      { k: 'cable', from: [96, 0], to: 'hand' },
      { k: 'grip', at: 'hand' },
    ],
    frames: [
      // Arms straight up, then the bar comes down to the upper chest, elbows down and back.
      { t: 98, ik: [-4, -104, 1], th: 0, sh: -90, at: ['hip', 92, 141] },
      { t: 102, ik: [4, -47, 1], th: 0, sh: -90, at: ['hip', 92, 141] },
    ],
  },
  dips: {
    props: [{ k: 'line', a: [50, 88], b: [150, 88], w: 5 }, { k: 'line', a: [60, 88], b: [60, 182], w: 4 }, { k: 'line', a: [140, 88], b: [140, 182], w: 4 }],
    frames: [
      // Arms locked out, then down until the upper arms are level, leaning forward (chest dip).
      { t: 90, ua: -90, fa: -90, th: -110, sh: 170, at: ['hand', 100, 86] },
      { t: 66, ua: -170, fa: -80, th: -115, sh: 170, at: ['hand', 100, 86] },
    ],
  },
  legPress: {
    props: [{ k: 'line', a: [76, 160], b: [34, 118], w: 6 }, { k: 'line', a: [60, 166], b: [100, 166], w: 6 }, { k: 'seg', at: 'toe', a: 130, len: 34, w: 6 }],
    frames: [
      { t: 135, ua: -40, fa: -10, th: 80, sh: -20, ft: 60, at: ['hip', 72, 156] },
      { t: 135, ua: -40, fa: -10, th: 40, sh: 40, ft: 130, at: ['hip', 72, 156] },
    ],
  },
  lunge: {
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    // Both feet stay planted: down until the back knee nearly touches the floor, torso upright.
    frames: backFoot([
      { t: 90, th: -65, sh: -100, ft2: -47, at: ['ankle', 125, A] },
      { t: 90, th: -36, sh: -98, ft2: -47, at: ['ankle', 125, A] },
      { t: 90, th: -8, sh: -95, ft2: -47, at: ['ankle', 125, A] },
    ], [78, 172], -1),
  },
  hipThrust: {
    props: [...bench(14, 145, 46), { k: 'bb', at: 'hip', dy: -6 }],
    frames: [
      { t: 160, ua: -10, fa: 20, th: 30, sh: -100, at: ['ankle', 140, A] },
      { t: 180, ua: -20, fa: 20, th: 0, sh: -92, at: ['ankle', 140, A] },
    ],
  },
  gluteBridge: {
    frames: [
      { t: 180, ua: -2, fa: -2, th: 55, sh: -95, at: ['ankle', 140, A] },
      { t: 204, ua: -2, fa: -2, th: 15, sh: -95, at: ['ankle', 140, A] },
    ],
  },
  legCurl: {
    props: [...bench(30, 124, 130), { k: 'roll', at: 'ankle', toward: 'toe', d: -6 }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 180, h: 10, ua: -118, fa: -62, th: 0, sh: 0, ft: -60, at: ['hip', 100, 117] },
      { t: 180, h: 10, ua: -118, fa: -62, th: 0, sh: 105, ft: 20, at: ['hip', 100, 117] },
    ],
  },
  legExtension: {
    props: [{ k: 'rect', x: 66, y: 136, w: 46, h: 6 }, { k: 'line', a: [64, 136], b: [58, 82], w: 6 }, { k: 'line', a: [90, 142], b: [90, 182], w: 4 }, { k: 'roll', at: 'ankle', toward: 'toe', d: 6 }],
    frames: [
      { t: 98, ua: -90, fa: -60, th: 0, sh: -95, at: ['hip', 74, 131] },
      { t: 98, ua: -90, fa: -60, th: 0, sh: -8, at: ['hip', 74, 131] },
    ],
  },
  calfRaise: {
    props: [{ k: 'rect', x: 100, y: 176, w: 30, h: 6 }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ft: 0, at: ['ankle', 100, 172] },
      { t: 90, ft: -45, at: ['ankle', 100, 162] },
    ],
  },
  curl: {
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -92, fa: -85, at: ['ankle', 100, A] },
      { t: 90, ua: -85, fa: 80, at: ['ankle', 100, A] },
    ],
  },
  triceps: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      // Dumbbell lowered behind the head, elbows pointing up.
      { t: 90, ua: 100, fa: 240, ua2: 100, fa2: 240, at: ['ankle', 100, A] },
      { t: 90, ua: 95, fa: 92, ua2: 95, fa2: 92, at: ['ankle', 100, A] },
    ],
  },
  lateralRaise: {
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { view: 'front', t: 90, ua: -80, fa: -85, th: -92, sh: -90, at: ['ground', 100] },
      { view: 'front', t: 90, ua: -2, fa: -8, th: -92, sh: -90, at: ['ground', 100] },
    ],
  },
  chestFly: {
    props: [{ k: 'cable', from: [8, 30], to: 'hand2' }, { k: 'cable', from: [192, 30], to: 'hand' }, { k: 'grip', at: 'hand' }, { k: 'grip', at: 'hand2' }],
    frames: [
      { view: 'front', t: 90, ik: [68, -62, 1], th: -92, sh: -90, at: ['ground', 100] },
      { view: 'front', t: 90, ik: [-10, -30, 1], th: -92, sh: -90, at: ['ground', 100] },
    ],
  },
  reverseFly: {
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { view: 'back', t: 90, tl: 0.45, h: 0, ua: -92, fa: -90, th: -95, sh: -88, at: ['ground', 100] },
      { view: 'back', t: 90, tl: 0.45, h: 0, ua: -8, fa: -12, th: -95, sh: -88, at: ['ground', 100] },
    ],
  },
  dbRow: {
    props: [...bench(28, 151, 110), { k: 'db', at: 'hand' }],
    frames: [
      { t: 15, ua: -90, fa: -90, ua2: -90, fa2: -80, th: -60, sh: -100, th2: -90, sh2: 180, at: ['hip', 80, 112] },
      { t: 15, ua: 145, fa: -90, ua2: -90, fa2: -80, th: -60, sh: -100, th2: -90, sh2: 180, at: ['hip', 80, 112] },
    ],
  },
  hangingKneeRaise: {
    noFloor: true,
    vb: [0, -8, 200, 200],
    props: [{ k: 'line', a: [62, 10], b: [118, 10], w: 5 }],
    frames: [
      { t: 90, ua: 92, fa: 92, th: -92, sh: -100, at: ['hand', 90, 10] },
      { t: 95, ua: 92, fa: 92, th: 15, sh: -85, at: ['hand', 90, 10] },
    ],
  },
  plateCrunch: {
    props: [{ k: 'plate', at: 'hand' }],
    frames: [
      { t: 175, h: 0, ua: -10, fa: 120, th: 50, sh: -60, at: ['hip', 100, 172] },
      { t: 140, h: -15, ua: -45, fa: 85, th: 50, sh: -60, at: ['hip', 100, 172] },
    ],
  },
  abWheel: {
    props: [{ k: 'wheel', at: 'hand' }],
    frames: [
      { t: 25, ua: -78, fa: -78, th: -100, sh: 180, ft: -100, at: ['knee', 45, 176] },
      { t: 6, ua: -14, fa: -14, th: -160, sh: 180, ft: -100, at: ['knee', 45, 176] },
    ],
  },
  woodchopper: {
    props: [{ k: 'db', at: 'hand', front: true }],
    frames: [
      { view: 'front', t: 84, ik: [28, -90, -1], ik2: [28, -90, 1], th: -92, sh: -90, at: ['ground', 100] },
      { view: 'front', t: 98, ik: [-12, -8, -1], ik2: [-12, -8, 1], th: -97, sh: -85, at: ['ground', 100] },
    ],
  },
  deadBug: {
    loop: true,
    ms: 700,
    frames: [
      { t: 180, ua: 90, fa: 90, th: 90, sh: 0, at: ['hip', 120, 172] },
      { t: 180, ua: 170, fa: 172, ua2: 90, fa2: 90, th: 90, sh: 0, th2: 8, sh2: 8, at: ['hip', 120, 172] },
      { t: 180, ua: 90, fa: 90, th: 90, sh: 0, at: ['hip', 120, 172] },
      { t: 180, ua2: 170, fa2: 172, ua: 90, fa: 90, th2: 90, sh2: 0, th: 8, sh: 8, at: ['hip', 120, 172] },
    ],
  },
  russianTwist: {
    props: [{ k: 'db', at: 'hand', front: true }],
    frames: [
      { view: 'front', t: 84, tl: 0.85, ik: [36, -24, 1], ik2: [36, -24, -1], ll: 0.55, th: -40, sh: -100, at: ['hip', 100, 160] },
      { view: 'front', t: 96, tl: 0.85, ik: [-36, -24, 1], ik2: [-36, -24, -1], ll: 0.55, th: -40, sh: -100, at: ['hip', 100, 160] },
    ],
  },
  plank: {
    ms: 1800,
    frames: [
      { t: 168, ua: -90, fa: 180, th: -12, sh: -12, ft: -100, at: ['ankle', 165, 172] },
      { t: 166, ua: -92, fa: 180, th: -13, sh: -11, ft: -100, at: ['ankle', 165, 172] },
    ],
  },
  sidePlank: {
    ms: 1800,
    frames: [
      { view: 'front', t: 167, ua: 90, fa: 90, ua2: -90, fa2: 190, th: -13, sh: -13, th2: -13, sh2: -13, ft: -100, ft2: -100, at: ['ankle2', 168, 177] },
      { view: 'front', t: 165, ua: 92, fa: 92, ua2: -90, fa2: 190, th: -11, sh: -11, th2: -11, sh2: -11, ft: -100, ft2: -100, at: ['ankle2', 168, 177] },
    ],
  },
  hollowHold: {
    ms: 1800,
    frames: [
      { t: 165, h: -10, ua: 170, fa: 172, th: 15, sh: 13, at: ['hip', 105, 172] },
      { t: 162, h: -12, ua: 168, fa: 170, th: 13, sh: 11, at: ['hip', 105, 172] },
    ],
  },
  suitcaseCarry: {
    loop: true,
    ms: 380,
    props: [{ k: 'db', at: 'hand' }],
    frames: walk.map((p) => ({ ...p, ua: -90, fa: -90, ua2: -80, fa2: -75 })),
  },
  farmerCarry: {
    loop: true,
    ms: 380,
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: walk.map((p) => ({ ...p, ua: -90, fa: -90, ua2: -90, fa2: -90 })),
  },
  walking: { loop: true, ms: 380, frames: walk },
  running: { loop: true, ms: 220, frames: run },
  treadmill: {
    loop: true,
    ms: 220,
    props: [{ k: 'rect', x: 30, y: 176, w: 150, h: 6 }, { k: 'line', a: [172, 176], b: [160, 100], w: 4 }, { k: 'line', a: [160, 100], b: [140, 104], w: 4 }],
    frames: run.map((p) => ({ ...p, at: ['ground', 95] as Pose['at'] })),
  },
  cycling: {
    loop: true,
    ms: 140,
    props: [
      { k: 'circle', c: [52, 158], r: 22 }, { k: 'circle', c: [150, 158], r: 22 },
      { k: 'line', a: [52, 158], b: [102, 158], w: 4 }, { k: 'line', a: [102, 158], b: [86, 104], w: 4 },
      { k: 'line', a: [102, 158], b: [138, 104], w: 4 }, { k: 'line', a: [86, 104], b: [138, 104], w: 4 },
      { k: 'line', a: [138, 104], b: [150, 158], w: 4 }, { k: 'line', a: [138, 104], b: [134, 90], w: 4 },
      { k: 'line', a: [76, 99], b: [94, 99], w: 5 }, { k: 'line', a: [128, 90], b: [142, 90], w: 5 },
    ],
    frames: orbit(16, 58, 13, 13, 8, -1).map((o) => ({ t: 58, ik: [52, -8, 1] as [number, number, number], ...o, at: ['hip', 86, 95] as Pose['at'] })),
  },
  rowing: {
    props: [{ k: 'line', a: [10, 168], b: [180, 168], w: 4 }, { k: 'circle', c: [170, 150], r: 15 }, { k: 'cable', from: [158, 150], to: 'hand' }, { k: 'line', a: [128, 168], b: [138, 140], w: 5 }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 65, ikL: [58, 12, -1], ik: [88, -42, 1], at: ['hip', 78, 160] },
      { t: 112, ikL: [92, 12, -1], ik: [28, -22, 1], at: ['hip', 44, 160] },
    ],
  },
  elliptical: {
    loop: true,
    ms: 260,
    props: [
      // Base rail, front column with the flywheel, moving handles and the two foot pedals.
      { k: 'line', a: [26, 177], b: [178, 177], w: 5 },
      { k: 'line', a: [166, 177], b: [154, 64], w: 5 },
      { k: 'circle', c: [164, 160], r: 12 },
      { k: 'rod', from: [152, 128], to: 'hand2', w: 3 },
      { k: 'seg', at: 'ankle2', a: 0, len: 28, w: 4, dx: 3, dy: 5 },
      { k: 'rod', from: [152, 128], to: 'hand', w: 3 },
      { k: 'seg', at: 'ankle', a: 0, len: 28, w: 4, dx: 3, dy: 5 },
    ],
    // Feet stay flat on the pedals tracing an ellipse; each arm pushes while the same-side leg goes back.
    frames: orbit(8, 66, 22, 7, 8, -1).map((o, i) => ({
      t: 86, ...o, ft: 0, ft2: 0,
      ik: [30 - Math.cos((i / 8) * Math.PI * 2) * 12, -42, 1] as IK,
      ik2: [30 + Math.cos((i / 8) * Math.PI * 2) * 12, -42, 1] as IK,
      at: ['hip', 92, 96] as Pose['at'],
    })),
  },
  stairs: {
    // A stair climber: the staircase rolls down, one foot rides a step down while the other
    // lifts over the edge onto the next step. Hands rest on the side rail.
    loop: true,
    ms: 420,
    noFloor: true,
    props: [
      { k: 'stairs', x: 104, y: 152, w: 26, h: 18, box: [54, 34, 178, 180] },
      { k: 'line', a: [46, 182], b: [184, 182], w: 4 },
      { k: 'line', a: [96, 107], b: [176, 52], w: 4 },
      { k: 'line', a: [172, 55], b: [172, 182], w: 4 },
    ],
    frames: [
      { t: 80, sc: 0, ikL: [20, 52, -1], ikL2: [-6, 70, -1], ik: [26, -4, 1], ft: 0, ft2: 0, at: ['hip', 92, 96] },
      { t: 80, sc: 0.5, ikL: [7, 61, -1], ikL2: [10, 41, -1], ik: [26, -4, 1], ft: 0, ft2: -10, at: ['hip', 92, 96] },
      { t: 80, sc: 0, ikL: [-6, 70, -1], ikL2: [20, 52, -1], ik: [26, -4, 1], ft: 0, ft2: 0, at: ['hip', 92, 96] },
      { t: 80, sc: 0.5, ikL: [10, 41, -1], ikL2: [7, 61, -1], ik: [26, -4, 1], ft: -10, ft2: 0, at: ['hip', 92, 96] },
    ],
  },
  swimming: {
    loop: true,
    ms: 380,
    noFloor: true,
    props: [{ k: 'water', y: 92 }],
    frames: [
      { t: 2, h: -10, ua: 0, fa: 0, ua2: 180, fa2: 180, th: 176, sh: 172, th2: 184, sh2: 190, at: ['hip', 70, 100] },
      { t: 0, h: -10, ua: -90, fa: -110, ua2: 90, fa2: 60, th: 184, sh: 190, th2: 176, sh2: 172, at: ['hip', 70, 100] },
      { t: -2, h: -10, ua: 180, fa: 180, ua2: 0, fa2: 0, th: 176, sh: 172, th2: 184, sh2: 190, at: ['hip', 70, 100] },
      { t: 0, h: -10, ua: 90, fa: 60, ua2: -90, fa2: -110, th: 184, sh: 190, th2: 176, sh2: 172, at: ['hip', 70, 100] },
    ],
  },
  bwSquat: {
    frames: [
      { t: 90, ua: -90, fa: -90, at: ['ankle', 100, A] },
      { t: 55, ua: 0, fa: 0, th: 0, sh: -110, at: ['ankle', 100, A] },
    ],
  },
  gobletSquat: {
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -100, fa: 75, at: ['ankle', 100, A] },
      { t: 65, ua: -125, fa: 50, th: 0, sh: -112, at: ['ankle', 100, A] },
    ],
  },
  pushUp: {
    // Hands and toes stay put; straight body from head to heels, chest down near the floor.
    frames: handsFixed(
      { t: 155, ua: -90, fa: -90, th: -25, sh: -25, ft: -100, at: ['ankle', 165, 172] },
      { t: 172, th: -8, sh: -8, ft: -100, at: ['ankle', 165, 172] },
    ),
  },
  dbBench: {
    props: [...bench(30, 120, 120), { k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 180, ik: [-50, -52, 1], th: -30, sh: -95, at: ['hip', 110, 113] },
      { t: 180, ik: [-42, -13, 1], th: -30, sh: -95, at: ['hip', 110, 113] },
    ],
  },
  dbRdl: {
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -86, fa: -86, th: -88, sh: -94, at: ['ankle', 100, A] },
      { t: 28, ua: -108, fa: -108, th: -57, sh: -99, at: ['ankle', 100, A] },
    ],
  },
  facePull: {
    props: [{ k: 'cable', from: [196, 46], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 88, ik: [54, -56, -1], at: ['ankle', 80, A] },
      { t: 92, ik: [10, -64, -1], at: ['ankle', 80, A] },
    ],
  },
  tricepsPushdown: {
    props: [{ k: 'cable', from: [130, 0], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 84, ua: -95, fa: 70, at: ['ankle', 95, A] },
      { t: 84, ua: -95, fa: -88, at: ['ankle', 95, A] },
    ],
  },
  cableRow: {
    props: [{ k: 'rect', x: 50, y: 148, w: 50, h: 7 }, { k: 'line', a: [75, 155], b: [75, 182], w: 4 }, { k: 'line', a: [158, 140], b: [166, 182], w: 6 }, { k: 'cable', from: [190, 128], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 68, ikL: [66, 20, -1], ik: [84, -38, 1], at: ['hip', 82, 143] },
      { t: 96, ikL: [66, 20, -1], ik: [26, -26, 1], at: ['hip', 82, 143] },
    ],
  },
  bandPullApart: {
    props: [{ k: 'band', a: 'hand', b: 'hand2' }],
    frames: [
      { view: 'back', t: 90, ua: -8, fa: -8, al: 0.42, th: -92, sh: -90, at: ['ground', 100] },
      { view: 'back', t: 90, ua: 2, fa: 0, al: 1, th: -92, sh: -90, at: ['ground', 100] },
    ],
  },
  bandLateralWalk: {
    props: [{ k: 'band', a: 'knee', b: 'knee2' }],
    frames: [
      { view: 'back', t: 90, ik: [8, -38, 1], th: -97, sh: -84, at: ['ground', 100] },
      { view: 'back', t: 90, ik: [8, -38, 1], th: -72, sh: -84, at: ['ground', 100] },
    ],
  },
  kbSwing: {
    props: [{ k: 'kb', at: 'hand' }],
    frames: [
      { t: 22, ua: -118, fa: -118, th: -70, sh: -100, at: ['ankle', 95, A] },
      { t: 92, ua: 2, fa: 2, at: ['ankle', 95, A] },
    ],
  },

  frontSquat: {
    props: [{ k: 'bb', at: 'shoulder', tb: [-3, -11] }],
    frames: [
      { t: 90, ua: -5, fa: 168, at: ['ankle', 95, A] },
      { t: 72, ua: 12, fa: 186, th: 0, sh: -115, at: ['ankle', 95, A] },
    ],
  },
  bulgarianSplitSquat: {
    props: [...bench(40, 141, 46), { k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    // Rear foot laces-down on the bench and stays there; front foot flat; down until the
    // front thigh is about level and the back knee is near the floor.
    frames: backFoot([
      { t: 88, th: -78, sh: -95, ft2: 190, at: ['ankle', 128, A] },
      { t: 85, th: -45, sh: -98, ft2: 190, at: ['ankle', 128, A] },
      { t: 82, th: -15, sh: -100, ft2: 190, at: ['ankle', 128, A] },
    ], [72, 136], -1),
  },
  stepUp: {
    props: [{ k: 'rect', x: 108, y: 160, w: 48, h: 22 }, { k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      // Lead foot on the box, back foot flat on the floor, chest slightly forward.
      { t: 80, th: -20, sh: -100, ikL2: [-8, 71.5, 1], at: ['ankle', 128, 157] },
      // Driving up: lead leg almost straight, back foot lifted over the edge of the box.
      { t: 86, th: -65, sh: -95, ikL2: [-4, 64, 1], at: ['ankle', 128, 157] },
      // Standing tall on the box with both feet.
      { t: 90, th: -90, sh: -90, ikL2: [-4, 74.5, 1], at: ['ankle', 128, 157] },
    ],
    ms: 900,
  },
  sumoSquat: {
    props: [{ k: 'db', at: 'hand', hang: true }],
    // Wide stance, toes out, feet planted; the dumbbell hangs between the legs on straight arms
    // and the knees track out over the toes; torso stays upright.
    frames: [
      { view: 'front', t: 90, ik: [0, -2, -1], ikL: [30, 71, -1], at: ['hip', 100, 107] },
      { view: 'front', t: 90, ik: [0, -2, -1], ikL: [30, 43, -1], at: ['hip', 100, 135] },
    ],
  },
  goodMorning: {
    props: [{ k: 'bb', at: 'shoulder', tb: [-2, 9] }],
    frames: [
      { t: 90, ua: -120, fa: 60, th: -88, sh: -95, at: ['ankle', 100, A] },
      { t: 12, ua: -198, fa: -18, th: -62, sh: -98, at: ['ankle', 100, A] },
    ],
  },
  singleLegRdl: {
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -88, fa: -88, th: -88, sh: -92, th2: -95, sh2: -100, at: ['ankle', 110, A] },
      { t: 6, ua: -100, fa: -100, th: -76, sh: -96, th2: 186, sh2: 186, at: ['ankle', 110, A] },
    ],
  },
  cableKickback: {
    props: [{ k: 'line', a: [170, 40], b: [170, 182], w: 5 }, { k: 'cable', from: [168, 176], to: 'ankle' }],
    frames: [
      // Hands hold the machine, standing leg soft, working leg kicks back from the hip.
      { t: 80, ik: [46, -11, 1], th: -95, sh: -95, th2: -90, sh2: -90, at: ['ankle2', 120, A] },
      { t: 76, ik: [46, -11, 1], th: -150, sh: -145, th2: -90, sh2: -90, at: ['ankle2', 120, A] },
    ],
  },
  hipAbduction: {
    props: [{ k: 'rect', x: 72, y: 132, w: 56, h: 7 }, { k: 'roll', at: 'knee', toward: 'knee2', d: -7 }, { k: 'roll', at: 'knee2', toward: 'knee', d: -7 }],
    // Seated, seen from the front: the thighs point at the viewer (short) and open outwards
    // against the pads on the outside of the knees.
    frames: [
      { view: 'front', t: 90, ua: -66, fa: -86, th: -84, thl: 0.32, sh: -92, at: ['hip', 100, 128] },
      { view: 'front', t: 90, ua: -66, fa: -86, th: -28, thl: 0.6, sh: -88, at: ['hip', 100, 128] },
    ],
  },
  wallSit: {
    ms: 1800,
    props: [{ k: 'line', a: [62, 40], b: [62, 182], w: 6 }],
    frames: [
      { t: 90, ua: -80, fa: -60, th: 0, sh: -90, at: ['hip', 74, 141] },
      { t: 91, ua: -80, fa: -60, th: 0, sh: -90, at: ['hip', 74, 141] },
    ],
  },
  inclineBench: {
    props: [{ k: 'line', a: [124, 142], b: [62, 92], w: 7 }, { k: 'line', a: [100, 146], b: [138, 146], w: 7 }, { k: 'line', a: [118, 150], b: [118, 182], w: 4 }, { k: 'bb', at: 'hand' }],
    frames: [
      // Over the shoulders, lowered to the upper chest.
      { t: 142, ik: [-39, -85, 1], th: -10, sh: -95, at: ['hip', 120, 136] },
      { t: 142, ik: [-27, -37, 1], th: -10, sh: -95, at: ['hip', 120, 136] },
    ],
  },
  inclineDbPress: {
    props: [{ k: 'line', a: [124, 142], b: [62, 92], w: 7 }, { k: 'line', a: [100, 146], b: [138, 146], w: 7 }, { k: 'line', a: [118, 150], b: [118, 182], w: 4 }, { k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 142, ik: [-39, -85, 1], th: -10, sh: -95, at: ['hip', 120, 136] },
      { t: 142, ik: [-27, -37, 1], th: -10, sh: -95, at: ['hip', 120, 136] },
    ],
  },
  machineChestPress: {
    props: [{ k: 'rect', x: 56, y: 142, w: 44, h: 7 }, { k: 'line', a: [68, 142], b: [62, 80], w: 7 }, { k: 'line', a: [78, 149], b: [78, 182], w: 4 }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 96, ik: [20, -42, 1], th: 0, sh: -88, at: ['hip', 80, 138] },
      { t: 96, ik: [62, -46, 1], th: 0, sh: -88, at: ['hip', 80, 138] },
    ],
  },
  arnoldPress: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      // Dumbbells in front of the face, elbows forward; they turn out as they go straight up.
      { t: 90, ik: [14, -62, 1], at: ['ankle', 100, A] },
      { t: 90, ik: [2, -104, 1], at: ['ankle', 100, A] },
    ],
  },
  landminePress: {
    // The bar's anchor is on the floor in front; the end of the bar is pressed up and forward.
    props: [{ k: 'rod', from: [196, 180], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 86, ik: [14, -50, 1], th: -75, sh: -95, th2: -105, sh2: -95, at: ['ground', 95] },
      { t: 82, ik: [50, -68, 1], th: -75, sh: -95, th2: -105, sh2: -95, at: ['ground', 95] },
    ],
  },
  frontRaise: {
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -86, fa: -86, at: ['ankle', 90, A] },
      { t: 90, ua: 4, fa: 4, at: ['ankle', 90, A] },
    ],
  },
  cableLateralRaise: {
    props: [{ k: 'cable', from: [70, 178], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { view: 'front', t: 90, ua: -80, fa: -84, ua2: -95, fa2: -95, th: -92, sh: -90, at: ['ground', 100] },
      { view: 'front', t: 90, ua: -4, fa: -8, ua2: -95, fa2: -95, th: -92, sh: -90, at: ['ground', 100] },
    ],
  },
  inclinePushUp: {
    props: [...bench(30, 145, 56)],
    frames: handsFixed(
      { t: 136, ua: -90, fa: -90, th: -44, sh: -44, ft: -100, at: ['ankle', 168, 172] },
      { t: 157, th: -23, sh: -23, ft: -100, at: ['ankle', 168, 172] },
    ),
  },
  kneePushUp: {
    frames: handsFixed(
      { t: 145, ua: -90, fa: -90, th: -35, sh: 0, ft: 90, at: ['knee', 140, 176] },
      { t: 170, th: -10, sh: 0, ft: 90, at: ['knee', 140, 176] },
    ),
  },
  skullCrusher: {
    props: [...bench(30, 120, 120), { k: 'bb', at: 'hand' }],
    frames: [
      { t: 180, ua: 100, fa: 98, th: -30, sh: -95, at: ['hip', 110, 113] },
      { t: 180, ua: 104, fa: 192, th: -30, sh: -95, at: ['hip', 110, 113] },
    ],
  },
  benchDip: {
    props: [...bench(22, 140, 46)],
    // Hands on the bench behind, heels stay on the floor, hips drop straight down by the bench.
    frames: [
      { t: 94, ua: -100, fa: -100, ft: 80, at: ['hand', 66, 139] },
      { t: 86, ua: -160, fa: -58, ft: 80, at: ['hand', 66, 139] },
    ].map((p) => ({ ...p, ikL: to(p as Pose, 130, 176, -1) }) as Pose),
  },
  tBarRow: {
    props: [{ k: 'rod', from: [22, 180], to: 'hand' }, { k: 'plate', at: 'hand' }],
    frames: [
      { t: 30, ik: [49, 27, 1], th: -65, sh: -100, at: ['ankle', 110, A] },
      { t: 30, ik: [31, -5, 1], th: -65, sh: -100, at: ['ankle', 110, A] },
    ],
  },
  chestSupportedRow: {
    props: [{ k: 'line', a: [86, 107], b: [118, 83], w: 7 }, { k: 'line', a: [100, 98], b: [100, 182], w: 4 }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 38, ua: -90, fa: -90, th: -70, sh: -95, at: ['hip', 70, 106] },
      { t: 38, ua: -165, fa: -90, th: -70, sh: -95, at: ['hip', 70, 106] },
    ],
  },
  invertedRow: {
    props: [{ k: 'line', a: [100, 98], b: [150, 98], w: 5 }, { k: 'line', a: [146, 98], b: [146, 182], w: 4 }],
    frames: [
      { t: 12, ua: 90, fa: 90, th: -168, sh: -168, ft: -10, at: ['hand', 122, 98] },
      { t: 24, ua: -115, fa: 62, th: -157, sh: -157, ft: -10, at: ['hand', 122, 98] },
    ],
  },
  straightArmPulldown: {
    props: [{ k: 'cable', from: [168, 8], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 76, ua: 50, fa: 50, th: -80, sh: -95, at: ['ankle', 90, A] },
      { t: 76, ua: -80, fa: -80, th: -80, sh: -95, at: ['ankle', 90, A] },
    ],
  },
  hammerCurl: {
    props: [{ k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -92, fa: -85, at: ['ankle', 100, A] },
      { t: 90, ua: -85, fa: 80, at: ['ankle', 100, A] },
    ],
  },
  cableCurl: {
    props: [{ k: 'cable', from: [150, 180], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 90, ua: -92, fa: -80, at: ['ankle', 95, A] },
      { t: 90, ua: -85, fa: 80, at: ['ankle', 95, A] },
    ],
  },
  preacherCurl: {
    // The back of the upper arm rests on the angled pad.
    props: [{ k: 'rect', x: 62, y: 140, w: 42, h: 7 }, { k: 'line', a: [74, 98], b: [99, 118], w: 7 }, { k: 'line', a: [98, 118], b: [96, 140], w: 4 }, { k: 'line', a: [88, 147], b: [88, 182], w: 4 }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 98, ua: -38, fa: -55, th: 0, sh: -90, at: ['hip', 78, 136] },
      { t: 98, ua: -38, fa: 95, th: 0, sh: -90, at: ['hip', 78, 136] },
    ],
  },
  cableCrunch: {
    props: [{ k: 'cable', from: [104, 0], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { t: 88, ik: [8, -52, -1], th: -92, sh: 180, ft: -100, at: ['knee', 100, 176] },
      { t: 28, ik: [44, -26, -1], th: -92, sh: 180, ft: -100, at: ['knee', 100, 176] },
    ],
  },
  lyingLegRaise: {
    frames: [
      { t: 180, ua: -3, fa: -3, th: 4, sh: 4, at: ['hip', 110, 172] },
      { t: 180, ua: -3, fa: -3, th: 82, sh: 82, at: ['hip', 110, 172] },
    ],
  },
  hangingLegRaise: {
    noFloor: true,
    vb: [0, -8, 200, 200],
    props: [{ k: 'line', a: [62, 10], b: [118, 10], w: 5 }],
    frames: [
      { t: 90, ua: 92, fa: 92, th: -92, sh: -92, at: ['hand', 90, 10] },
      { t: 100, ua: 92, fa: 92, th: 5, sh: 5, at: ['hand', 90, 10] },
    ],
  },
  mountainClimber: {
    loop: true,
    ms: 170,
    // Hands planted under the shoulders; knees drive towards the chest in turn.
    frames: (() => {
      const base: Pose = { t: 158, ua: -90, fa: -90, ft: -100, ft2: -100, at: ['hand', 62, 178] };
      const tuck: V = [102, 166];
      const out: V = [178, 176];
      const a: Pose = { ...base, ikL: to(base, tuck[0], tuck[1], 1), ikL2: to(base, out[0], out[1], 1) };
      const b: Pose = { ...base, ikL: to(base, out[0], out[1], 1), ikL2: to(base, tuck[0], tuck[1], 1) };
      // A short hold in each position and a quick switch.
      return [a, a, b, b];
    })(),
  },
  pallofPress: {
    // Seen from the front: the cable pulls sideways, the hands press straight out from the
    // chest (towards you) and the torso resists turning.
    props: [{ k: 'line', a: [10, 40], b: [10, 182], w: 5 }, { k: 'cable', from: [12, 92], to: 'hand' }, { k: 'grip', at: 'hand' }],
    frames: [
      { view: 'front', t: 90, ik: [0, -34, -1], th: -97, sh: -90, at: ['ground', 104] },
      { view: 'front', t: 90, ik: [0, -34, -1], al: 0.45, th: -97, sh: -90, at: ['ground', 104] },
    ],
  },
  bicycleCrunch: {
    loop: true,
    ms: 450,
    frames: [
      { t: 152, ua: 150, fa: -40, th: 100, sh: 0, th2: 18, sh2: 18, at: ['hip', 105, 170] },
      { t: 152, ua: 150, fa: -40, th: 18, sh: 18, th2: 100, sh2: 0, at: ['hip', 105, 170] },
    ],
  },
  birdDog: {
    ms: 1300,
    frames: [
      { t: 163, ua: -90, fa: -90, ua2: -90, fa2: -90, th: -90, sh: 0, th2: -90, sh2: 0, ft: -100, ft2: -100, at: ['knee2', 120, 177] },
      { t: 163, ua: -90, fa: -90, ua2: 172, fa2: 172, th: 2, sh: 2, th2: -90, sh2: 0, ft: -100, ft2: -100, at: ['knee2', 120, 177] },
    ],
  },
  burpee: {
    loop: true,
    ms: 420,
    vb: [-10, -26, 220, 216],
    // Stand, squat with the hands on the floor, jump the feet back to a plank (hands stay
    // put), jump them back in, then jump up with the arms overhead.
    frames: (() => {
      const stand = pin({ t: 90, ua: -90, fa: -90 }, 'ankle', 130, A);
      const squat = pin({ t: 30, th: 15, sh: -112, ua: -95, fa: -95 }, 'ankle', 130, A);
      const h = pos(squat, 'hand');
      const plank = pin({ t: 21, th: -159, sh: -159, ua: -90, fa: -90, ft: -70, ft2: -70 }, 'hand', h[0], h[1]);
      const jump = pin({ t: 92, ua: 88, fa: 88, sh: -96, ft: -70, ft2: -70 }, 'ankle', 130, A - 12);
      return [stand, squat, plank, squat, jump];
    })(),
  },
  jumpingJacks: {
    loop: true,
    ms: 300,
    frames: [
      { view: 'front', t: 90, ua: -85, fa: -85, th: -92, sh: -90, at: ['ground', 100] },
      { view: 'front', t: 90, ua: 55, fa: 70, th: -70, sh: -72, at: ['ground', 100] },
    ],
  },
};
