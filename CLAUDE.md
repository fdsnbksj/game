# CLAUDE.md

Mobile web skill game (working title **Jungle Swing**): React screens, Phaser 3 gameplay, Firebase on the free Spark plan (Auth, Firestore, Hosting). Setup and layout are in `README.md`.

## Git and deploy

- **Only the `main` branch.** Commit directly to `main`. Don't create branches or pull requests.
- **Every push to `main` deploys to production** via `.github/workflows/deploy.yml`: build → Firestore rules tests → seed the item catalog → deploy Hosting, Firestore rules and Auth settings (anonymous sign-in, from `firebase.json`). Push right after each commit so every commit is deployed.
- A failing build or rules test stops the deploy, so run `npm run build` and `npm run test:rules` before committing.
- Never commit secrets. The Firebase web config in `.env.production` is public by design. The deploy service account key lives only in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret.
- The production Firebase project ID is the `default` entry in `.firebaserc`. Local development always uses the `demo-game` emulator project.

## Commands

```sh
npm run emulators   # Auth + Firestore emulators (needs Java 21: /opt/homebrew/opt/openjdk@21/bin on PATH)
npm run seed        # load the item catalog into the emulator
npm run dev         # Vite dev server, reachable from a phone on the LAN
npm run build       # type-check + production build
npm run test:rules  # Firestore rules tests (starts its own emulator; stop `npm run emulators` first)
```

## Constraints

- **Spark plan:** no Cloud Functions, no Cloud Storage. `firestore.rules` is the only server-side validation, so every client write needs a matching rule and a test in `tests/rules.test.ts`.
- **Free quota:** keep Firestore reads and writes minimal (write once per run, cache the leaderboard).
- `MAX_SCORE` and `MIN_SECONDS_BETWEEN_RUNS` are duplicated in `firestore.rules` and `src/shared/constants.ts`. Change both together.
- The item catalog lives in `src/shared/items.ts`. Each deploy re-seeds it into production Firestore.
- Phaser is not mounted inside React `StrictMode` (see `src/main.tsx`).
