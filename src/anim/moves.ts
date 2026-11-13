import type { Move, Pose } from './figure';

// Ankle height when standing on the floor.
const A = 178;

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

const runA: Pose = { t: 78, th: -40, sh: -105, th2: -120, sh2: -170, ua: -135, fa: -55, ua2: -45, fa2: 25, at: ['ground', 100] };
const runB: Pose = { t: 80, th: -88, sh: -100, th2: -75, sh2: -155, ua: -95, fa: -20, ua2: -85, fa2: -20, at: ['ground', 100] };
const run = [runA, runB, swap(runA), swap(runB)];

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
    props: [{ k: 'bb', at: 'shoulder', dx: -9, dy: 2 }],
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
      { t: 90, ua: -82, fa: -82, th: -88, sh: -95, at: ['ankle', 100, A] },
      { t: 15, ua: -90, fa: -90, th: -70, sh: -100, at: ['ankle', 100, A] },
    ],
  },
  bench: {
    props: [...bench(30, 120, 120), { k: 'bb', at: 'hand' }],
    frames: [
      { t: 180, ua: 90, fa: 90, th: -30, sh: -95, at: ['hip', 110, 113] },
      { t: 180, ua: -80, fa: 90, th: -30, sh: -95, at: ['hip', 110, 113] },
    ],
  },
  ohp: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      { t: 90, ua: -70, fa: 95, at: ['ankle', 100, A] },
      { t: 90, ua: 88, fa: 88, at: ['ankle', 100, A] },
    ],
  },
  dbOhp: {
    vb: [-10, -26, 220, 216],
    props: [{ k: 'db', at: 'hand2' }, { k: 'db', at: 'hand' }],
    frames: [
      { t: 90, ua: -70, fa: 95, at: ['ankle', 100, A] },
      { t: 90, ua: 88, fa: 88, at: ['ankle', 100, A] },
    ],
  },
  row: {
    props: [{ k: 'bb', at: 'hand' }],
    frames: [
      { t: 25, ua: -90, fa: -90, th: -65, sh: -100, at: ['ankle', 110, A] },
      { t: 25, ua: -160, fa: -90, th: -65, sh: -100, at: ['ankle', 110, A] },
    ],
  },
  pullup: {
    noFloor: true,
    vb: [0, -12, 200, 202],
    props: [{ k: 'line', a: [50, 30], b: [150, 30], w: 5 }],
    frames: [
      { t: 90, ua: 90, fa: 90, th: -75, sh: -165, at: ['hand', 100, 30] },
      { t: 95, ua: -70, fa: 70, th: -75, sh: -165, at: ['hand', 100, 30] },
    ],
  },
  assistedPullup: {
    noFloor: true,
    vb: [0, -12, 200, 202],
    props: [{ k: 'line', a: [50, 30], b: [150, 30], w: 5 }, { k: 'pad', at: 'knee', dy: 3, w: 30 }],
    frames: [
      { t: 90, ua: 90, fa: 90, th: -60, sh: -175, at: ['hand', 100, 30] },
      { t: 95, ua: -70, fa: 70, th: -60, sh: -175, at: ['hand', 100, 30] },
    ],
  },
  latPulldown: {
    props: [
      { k: 'rect', x: 70, y: 146, w: 45, h: 6 },
      { k: 'line', a: [92, 152], b: [92, 182], w: 4 },
      { k: 'cable', from: [104, 0], to: 'hand' },
      { k: 'grip', at: 'hand' },
    ],
    frames: [
      { t: 98, ua: 84, fa: 84, th: 0, sh: -90, at: ['hip', 92, 141] },
      { t: 102, ua: -105, fa: 70, th: 0, sh: -90, at: ['hip', 92, 141] },
    ],
  },
  dips: {
    props: [{ k: 'line', a: [50, 97], b: [150, 97], w: 5 }, { k: 'line', a: [60, 97], b: [60, 182], w: 4 }, { k: 'line', a: [140, 97], b: [140, 182], w: 4 }],
    frames: [
      { t: 92, ua: -72, fa: -100, th: -110, sh: 170, at: ['hand', 100, 95] },
      { t: 75, ua: -165, fa: -50, th: -115, sh: 170, at: ['hand', 100, 95] },
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
    frames: [
      { t: 90, th: -75, sh: -95, th2: -115, sh2: -125, at: ['ankle', 125, A] },
      { t: 90, th: -5, sh: -110, th2: -100, sh2: -170, at: ['ankle', 125, A] },
    ],
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
    props: [...bench(30, 124, 130), { k: 'pad', at: 'ankle', dy: -12, w: 12 }],
    frames: [
      { t: 180, h: 10, ua: -100, fa: -170, th: 0, sh: 0, ft: -60, at: ['hip', 100, 117] },
      { t: 180, h: 10, ua: -100, fa: -170, th: 0, sh: 105, ft: 20, at: ['hip', 100, 117] },
    ],
  },
  legExtension: {
    props: [{ k: 'rect', x: 66, y: 136, w: 46, h: 6 }, { k: 'line', a: [64, 136], b: [58, 82], w: 6 }, { k: 'line', a: [90, 142], b: [90, 182], w: 4 }, { k: 'pad', at: 'ankle', dy: -3, w: 12 }],
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
      { t: 90, ua: 100, fa: 200, ua2: 100, fa2: 200, at: ['ankle', 100, A] },
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
      { t: 15, ua: 160, fa: -90, ua2: -90, fa2: -80, th: -60, sh: -100, th2: -90, sh2: 180, at: ['hip', 80, 112] },
    ],
  },
  hangingKneeRaise: {
    noFloor: true,
    vb: [0, -8, 200, 200],
    props: [{ k: 'line', a: [84, 0], b: [84, 190], w: 4 }, { k: 'grip', at: 'hand' }],
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
      { t: 168, ua: -90, fa: 180, th: -12, sh: -12, ft: -100, at: ['ankle', 165, 176] },
      { t: 166, ua: -92, fa: 180, th: -13, sh: -11, ft: -100, at: ['ankle', 165, 176] },
    ],
  },
  sidePlank: {
    frames: [
      { t: 168, ua: -90, fa: -150, ua2: 92, fa2: 92, th: -12, sh: -12, th2: -12, sh2: -12, ft: -100, at: ['ankle', 165, 176] },
      { t: 160, ua: -95, fa: -150, ua2: 92, fa2: 92, th: -2, sh: -6, th2: -2, sh2: -6, ft: -100, at: ['ankle', 165, 176] },
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
    props: [{ k: 'line', a: [30, 176], b: [175, 176], w: 5 }, { k: 'line', a: [160, 176], b: [150, 60], w: 4 }],
    frames: orbit(8, 66, 22, 7, 8, -1).map((o, i) => ({
      t: 88, ...o,
      ik: [30 + Math.cos((i / 8) * Math.PI * 2) * 12, -55, 1] as [number, number, number],
      ik2: [30 - Math.cos((i / 8) * Math.PI * 2) * 12, -55, 1] as [number, number, number],
      at: ['hip', 92, 96] as Pose['at'],
    })),
  },
  stairs: {
    ms: 600,
    props: [{ k: 'line', a: [60, 160], b: [150, 160], w: 5 }, { k: 'line', a: [60, 140], b: [150, 140], w: 5 }, { k: 'line', a: [150, 120], b: [150, 182], w: 4 }],
    frames: [
      { t: 85, ikL: [16, 42, -1], ikL2: [8, 66, -1], ua: -100, ua2: -80, at: ['hip', 92, 96] },
      { t: 85, ikL: [8, 66, -1], ikL2: [16, 42, -1], ua: -80, ua2: -100, at: ['hip', 92, 96] },
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
};
