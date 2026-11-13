import type { Plan } from './db';

export const SEED_PLANS: Plan[] = [
  {
    key: 'core-upper-1',
    v: 2,
    name: { en: 'Core + upper body', hr: 'Core + gornji dio tijela' },
    sections: [
      {
        title: { en: 'Warm-up (8 min)', hr: 'Zagrijavanje (8 min)' },
        items: [
          { text: { en: 'Bike or rowing machine: 5 min', hr: 'Bicikl ili veslanje: 5 min' } },
          { text: { en: 'Cat-cow: 10×', hr: 'Cat-cow: 10x' } },
          { text: { en: 'Glute bridge: 15×', hr: 'Glute bridge: 15x' } },
          { text: { en: 'Dead bug: 10×', hr: 'Dead bug: 10x' } },
        ],
      },
      {
        title: { en: 'Part 1: Core, strength', hr: 'Dio 1: Core, snaga' },
        items: [
          { ex: 'hangingKneeRaise', sets: 4, target: '10-12', rest: 60 },
          { ex: 'plateCrunch', sets: 4, target: '12-15', rest: 60 },
          { ex: 'abWheel', sets: 3, target: '8-10', rest: 60 },
        ],
      },
      {
        title: { en: 'Part 2: Upper body', hr: 'Dio 2: Gornji dio tijela' },
        items: [
          { ex: 'assistedPullup', sets: 4, target: '6-10', rest: 90 },
          { ex: 'dbRow', sets: 3, target: '10-12', perSide: true, rest: 60 },
          { ex: 'dbOhp', sets: 3, target: '10', superset: 'A', rest: 60 },
          { ex: 'reverseFly', sets: 3, target: '15', superset: 'A', rest: 60 },
        ],
      },
      {
        title: { en: 'Part 3: Core, stability', hr: 'Dio 3: Core, stabilnost' },
        items: [
          { ex: 'suitcaseCarry', sets: 3, target: '30', unit: 'm', perSide: true, rest: 45 },
          { ex: 'woodchopper', sets: 3, target: '12', perSide: true, rest: 45 },
          { ex: 'sidePlank', sets: 3, target: '30-45', unit: 's', perSide: true, rest: 30 },
        ],
      },
      {
        title: { en: 'Finisher circuit', hr: 'Završni krug' },
        note: {
          en: '2-3 rounds, no rest between exercises, 60 s rest between rounds',
          hr: '2-3 kruga, bez pauze između vježbi, 60 s odmora između krugova',
        },
        circuit: { rounds: 3, rest: 60 },
        items: [
          { ex: 'plank', target: '45', unit: 's' },
          { ex: 'deadBug', target: '10', perSide: true },
          { ex: 'hollowHold', target: '20-30', unit: 's' },
          { ex: 'russianTwist', target: '20' },
        ],
      },
      {
        title: { en: 'Cool-down', hr: 'Kraj' },
        items: [
          {
            text: {
              en: '5 min stretching (cobra, child’s pose, chest and shoulders)',
              hr: '5 min istezanja (kobra, dječji položaj, prsa i ramena)',
            },
          },
        ],
      },
    ],
    notes: [
      { en: 'Finish each set with 1-2 reps in reserve.', hr: 'Na kraju serije trebaju ostati 1-2 ponavljanja u rezervi.' },
      { en: 'When every set reaches the top of the range, add weight.', hr: 'Kad sve serije dođu do gornje granice, dodaj težinu.' },
      { en: 'Pull-ups: reduce the counterweight as you get stronger.', hr: 'Zgibovi: kako jačaš, smanjuj protutežu.' },
    ],
  },
];
