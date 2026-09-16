# CLAUDE.md

**Neon Flap**: a tap-to-fly mobile web game. You flap a customizable bird through gaps in a neon skyline, and the course is generated from a day-based seed so everyone plays the same one each day. React handles the screens, Phaser 3 the gameplay, and Firebase the free-plan backend (Auth, Firestore, Hosting). Setup and layout are in `README.md`.

## Git and deploy

- **Only the `main` branch.** Commit directly to `main`. Don't create branches or pull requests.
- **Every push to `main` deploys to production** via `.github/workflows/deploy.yml`: build → Firestore rules tests → seed the item catalog → deploy Hosting and Firestore rules. Push right after each commit so every commit is deployed.
- Auth settings in `firebase.json` (anonymous sign-in) are **not** deployed by the workflow, because the deploy account lacks those permissions. After changing them, run `npm run deploy` logged in as a project owner.
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

## How the game fits together

- `src/game/scenes/FlapScene.ts` is the game: fixed-step physics, towers from a seeded random generator, score per gap passed.
- The daily course id is `dayId()` (UTC). It seeds the towers and names the day's leaderboard.
- `src/game/character/` draws the bird: tinted body and wing, fixed face, hat, plus a particle trail. All art is generated in code, no image files.
- A run ends by emitting `RUN_FINISHED` on `EventBus`; `src/screens/Play.tsx` saves it.

## Constraints

- **Spark plan:** no Cloud Functions, no Cloud Storage. `firestore.rules` is the only server-side validation, so every client write needs a matching rule and a test in `tests/rules.test.ts`.
- **Saving runs:** a run is saved only when it beats the player's best for that day. Other attempts are counted in `pendingRuns` and added to `gamesPlayed` with the next save, so fast retries don't hit the free quota or the rate limit.
- `MAX_SCORE`, `MIN_SECONDS_BETWEEN_RUNS` and `MAX_RUNS_PER_SAVE` are duplicated in `firestore.rules` and `src/shared/constants.ts`. Change both together.
- The item catalog lives in `src/shared/items.ts`. Each deploy re-seeds it and deletes items no longer listed.
- Phaser is not mounted inside React `StrictMode` (see `src/main.tsx`).
