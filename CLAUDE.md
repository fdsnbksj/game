# CLAUDE.md

**Neon Brawl**: a mobile web auto-battler (TFT-style) with original neon creatures. Buy creatures from a shop, place them on a hex board, and they fight on their own; a run is up to 15 rounds on 100 HP. React handles the screens, Phaser 3 the board and fight replays, and Firebase the free-plan backend (Auth, Firestore, Hosting). Setup and layout are in `README.md`. The game replaced **Neon Flap**, a flappy-bird game; its Firestore data and rules are still live (see Constraints).

## Git and deploy

- **Only the `main` branch.** Commit directly to `main`. Don't create branches or pull requests.
- **Every push to `main` deploys to production** via `.github/workflows/deploy.yml`: build → unit tests → Firestore rules tests → seed the item catalog → deploy Hosting and Firestore rules. Push right after each commit so every commit is deployed.
- Auth settings in `firebase.json` (anonymous sign-in) are **not** deployed by the workflow, because the deploy account lacks those permissions. After changing them, run `npm run deploy` logged in as a project owner.
- A failing build, unit test or rules test stops the deploy, so run `npm run build`, `npm run test:unit` and `npm run test:rules` before committing.
- Never commit secrets. The Firebase web config in `.env.production` is public by design. The deploy service account key lives only in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret.
- The production Firebase project ID is the `default` entry in `.firebaserc`. Local development always uses the `demo-game` emulator project.

## Commands

```sh
npm run emulators   # Auth + Firestore emulators (needs Java 21: /opt/homebrew/opt/openjdk@21/bin on PATH)
npm run seed        # load the item catalog into the emulator
npm run dev         # Vite dev server, reachable from a phone on the LAN
npm run build       # type-check + production build
npm run test:unit   # game logic tests, no emulator needed
npm run test:rules  # Firestore rules tests (starts its own emulator; stop `npm run emulators` first)
```

## How the game fits together

- **`src/sim/` is the whole game as pure TypeScript**: balance data, hex grid, economy, shop, a planning reducer, combat, AI opponents. No Phaser, DOM, Firebase, `Math.random` or `Date`; `tests/unit/purity.test.ts` enforces it. Every random choice comes from a named seeded stream (`src/sim/rng.ts`), so the same boards and seed always give the same fight on any device.
- A fight is simulated in one go at 20 ticks/s and produces an event log; `src/game/scenes/BattleScene.ts` replays the log. The run is advanced **before** the replay starts, so closing the app mid-fight can't undo a loss.
- Changing anything that affects combat changes old fights: bump `BALANCE_VERSION` in `src/sim/balance.ts` and update the golden hash in `tests/unit/combat.test.ts`.
- `src/runStore.ts` (zustand) holds the run in progress and saves it to `localStorage`, so a reload resumes it. The scene subscribes to the store directly.
- Creatures are shape data in `src/shared/creatureShapes.ts`, baked into Phaser textures and drawn as SVG by `CreatureChip`, so every view shows the same creature. All art is generated in code, no image files.
- Opponents are AI bots (`src/sim/ai.ts`) that play the real shop and economy, so their boards are always ones a player could have had. Online ghost opponents (fighting other players' saved boards) are the next phase.

## Constraints

- **Spark plan:** no Cloud Functions, no Cloud Storage. `firestore.rules` is the only server-side validation, so every client write needs a matching rule and a test in `tests/rules/`.
- **Legacy Neon Flap backend:** `users/*`, `leaderboards/*`, the item catalog (seeded on every deploy), `src/services/{runs,inventory,leaderboard}.ts`, `src/shared/{items,progress}.ts` and `tests/rules/neonFlap.test.ts` belong to the old game. They stay until old cached clients have updated, then get retired. Until then, the notes below about runs, streaks and the catalog describe that legacy backend.
- **Saving runs:** a run is saved only when it beats the player's best for that day. Other attempts are counted in `pendingRuns` and added to `gamesPlayed` with the next save, so fast retries don't hit the free quota or the rate limit.
- `MAX_SCORE`, `MIN_SECONDS_BETWEEN_RUNS` and `MAX_RUNS_PER_SAVE` are duplicated in `firestore.rules` and `src/shared/constants.ts`. Change both together.
- Streaks are duplicated the same way: `nextProgress()` in `src/shared/progress.ts` and `isNextDay()` in `src/shared/constants.ts` mirror `isValidProgress()` and `isNextDay()` in `firestore.rules`.
- The rules only accept a run dated within a day of the server clock, so tests derive their dates from `dayId()` rather than hardcoding them.
- The item catalog lives in `src/shared/items.ts`. Each deploy re-seeds it and deletes items no longer listed.
- Phaser is not mounted inside React `StrictMode` (see `src/main.tsx`).
- **Hosting cache headers** in `firebase.json` match the *requested* path, not the file served. The no-cache rules therefore use `/` and `/*` (the app's routes, which all serve `index.html`); `/assets/**` has two segments, so hashed assets keep their immutable caching. Without this, a deploy can be masked for an hour by a cached page.
- After a deploy, the first visit is served from the offline cache and runs the **previous** version, which may not match current rules. The error screen's Reload button (`src/App.tsx`) clears the service worker and caches.
