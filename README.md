# Gym Log

Personal gym tracker: a phone-first PWA for logging strength sets, cardio, timed holds,
carries and body weight. Works offline. All data stays in the browser on the phone
(IndexedDB); use Settings → Export backup to keep a copy.

- React + Vite + TypeScript, Dexie (IndexedDB), vite-plugin-pwa
- UI in English and Croatian (`src/i18n.tsx`)
- Workout plans: `src/plans.ts`
- Exercise animations: stick-figure engine in `src/anim/figure.ts`, poses in `src/anim/moves.ts`

## Develop

    npm install
    npm run dev -- --host     # open on the phone via the PC's LAN IP

## Deploy

Pushing to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`).
In the repo settings, Pages → Source must be set to "GitHub Actions".
