# CLAUDE.md

**a game**: a mobile web nonogram game for a train ride with a book: small logic puzzles to play between chapters. Tap squares to fill them so every row and column matches its clue numbers. It's made to be played with one thumb and no sound, with no clock or way to lose, and every tap is saved, so it can be put down at any moment, even offline. Levels are endless (5×5 growing to 10×10), and there's a daily 10×10 that is the same for everyone. Both are ranked. React handles the screens and Firebase the free-plan backend (Auth, Firestore, Hosting). Setup and layout are in `README.md`. It replaced an auto-battler, which had replaced **Neon Flap**; both left data in Firestore that is now closed (see Constraints).

## Git and deploy

- **Only the `main` branch.** Commit directly to `main`. Don't create branches or pull requests.
- **Every push to `main` deploys to production** via `.github/workflows/deploy.yml`: unit tests → build → Firestore rules tests → deploy Hosting and Firestore rules → deploy Firestore indexes. Push right after each commit so every commit is deployed.
- The index step may fail if the deploy account can't create indexes; it's allowed to, so the site still deploys, and the level rankings fail to load until the index exists. If it fails, run `npm run deploy` logged in as a project owner.
- Auth settings in `firebase.json` (anonymous sign-in) are **not** deployed by the workflow, because the deploy account lacks those permissions. After changing them, run `npm run deploy` logged in as a project owner.
- A failing build, unit test or rules test stops the deploy, so run `npm run build`, `npm run test:unit` and `npm run test:rules` before committing.
- Never commit secrets. The Firebase web config in `.env.production` is public by design. The deploy service account key lives only in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret.
- The production Firebase project ID is the `default` entry in `.firebaserc`. Local development always uses the `demo-game` emulator project.

## Commands

```sh
npm run emulators   # Auth + Firestore emulators (needs Java 21: /opt/homebrew/opt/openjdk@21/bin on PATH)
npm run dev         # Vite dev server, reachable from a phone on the LAN
npm run build       # type-check + production build
npm run audit       # checks saved solves against their puzzles
npm run test:unit   # puzzle logic tests, no emulator needed
npm run test:rules  # Firestore rules tests (starts its own emulator; stop `npm run emulators` first)
```

## How the game fits together

- **`src/nonogram/` is the whole puzzle as pure TypeScript**: clues, a line solver, the generator and the play reducer. No DOM, React, Firebase, `Math.random` or `Date`; `tests/unit/purity.test.ts` enforces it. Every random choice comes from a named seeded stream (`src/nonogram/rng.ts`), so a level or day gives the same puzzle on every device.
- **Every puzzle is solvable by logic alone.** `nonogram(level)` and `dailyNonogram(day)` draw random pictures until the line solver (`solve()`) settles every cell from the clues, which also proves the answer is unique. Each try is a little denser, and a full grid always settles, so it always ends. Changing the generator or `sizeFor()` changes every puzzle: bump `NONOGRAM_VERSION` and update the golden hash in `tests/unit/nonogram.test.ts`. A new version starts a new ladder (`ladders/{uid}_{version}`), and localStorage progress restarts with it.
- **Play is checked against the clues, not the stored answer** (`isSolved()`). Crosses are only notes. A stroke (a tap, or a drag locked to one row or column) is one undo step, and nothing is committed until the finger lifts (`src/components/Board.tsx`).
- **Offline first.** `src/nonogramStore.ts` (zustand) holds the plays in progress, the ladder level, solved days and settings, and saves every change to localStorage (`game:nonogram`). The app never waits for Firebase: `startSession()` signs in in the background and retries when the connection returns.
- **Online solves:** a solve is counted locally first, then queued and written in order at least 3 s apart, as the rules require, once there's a session. A network error leaves it queued. If the rules refuse a ladder level, the ladder carries on unranked on that device; a refused daily solve is just dropped.
- **The ladder** is `ladders/{uid}_{NONOGRAM_VERSION}`: the highest level solved and each level's grid (one `0`/`1` string, row by row). The first write creates the doc at level 1. **Daily solves** are `dailySolves/{day}/entries/{uid}`, create-only, and ranked by `solvedAt`.
- **Rules check shape, not answers:** `firestore.rules` copies `NONOGRAM_VERSION`, `sizeFor()` and the daily size; `tests/unit/rulesSync.test.ts` fails if they drift.

## Constraints

- **Catching cheats:** the rules can't make a puzzle, so `npm run audit` (`scripts/audit.ts`) remakes each level and day and reports saved grids that don't match the clues. It's read-only; run it by hand against production with `AUDIT_PROJECT_ID=<id>`.
- **Spark plan:** no Cloud Functions, no Cloud Storage. `firestore.rules` is the only server-side validation, so every client write needs a matching rule and a test in `tests/rules/`.
- **Old data stays and is closed.** Neon Flap's data (`users/*`, `leaderboards/*`, `items/*`) and the auto-battler's (`runs/*`, `puzzles/*`, `rankings/*`, `dailyRankings/*`) are left in Firestore, because deleting them would only spend quota. The rules deny all of it except a player reading their own `users/{uid}`, which the app does once to carry their name over. Auto-battler `players` docs keep their extra run fields; renaming still works. `tests/rules/legacy.test.ts` and `tests/rules/solves.test.ts` cover this.
- Daily solves are filed under a UTC day, and the rules only accept a day within one of the server clock, so tests derive their dates from `dayId()` rather than hardcoding them.
- **Train-friendly is the brief:** keep everything reachable with one thumb (controls at the bottom), make nothing depend on sound, add no timers or fail states, and save every change at once.
- **One palette, in `src/index.css`.** Colours are written only in the `:root` block and its `prefers-color-scheme: dark` twin; everything else uses `var()`.
- **Never rename the storage key `game:nonogram`**: it holds every player's progress, and a new name would wipe it on every device. The old games' keys (`neon-brawl:*`, `neon-flap:audio`, `game:puzzle`) are no longer read.
- **Hosting cache headers** in `firebase.json` match the *requested* path, not the file served. The no-cache rules therefore use `/` and `/*` (the app's routes, which all serve `index.html`); `/assets/**` has two segments, so hashed assets keep their immutable caching. Without this, a deploy can be masked for an hour by a cached page.
- After a deploy, the first visit is served from the offline cache and runs the **previous** version, which may not match current rules. `src/main.tsx` swaps in the new build once the player is off the grid or the app is in the background, and Settings has "Reload the latest version" (`src/reload.ts`), which clears the service worker and caches.
