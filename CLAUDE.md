# CLAUDE.md

**a game**: a mobile web auto-battler (TFT-style) with original creatures. Buy creatures from a shop, place them on a hex board, and they fight on their own; a run is endless: it goes on until its 100 HP runs out, and after round 15 each rival surges 8% stronger (`surgePercent()`). There's also a daily challenge: the same run for everyone that day. React handles the screens, Phaser 3 the board and fight replays, and Firebase the free-plan backend (Auth, Firestore, Hosting). Setup and layout are in `README.md`. The game replaced **Neon Flap**, a flappy-bird game; its old data is still in Firestore but closed (see Constraints).

## Git and deploy

- **Only the `main` branch.** Commit directly to `main`. Don't create branches or pull requests.
- **Every push to `main` deploys to production** via `.github/workflows/deploy.yml`: unit tests → build → Firestore rules tests → deploy Hosting and Firestore rules → deploy Firestore indexes. Push right after each commit so every commit is deployed.
- The index step may fail if the deploy account can't create indexes; it's allowed to, so the site still deploys, and ghosts fall back to bots until the index exists. If it fails, run `npm run deploy` logged in as a project owner.
- Auth settings in `firebase.json` (anonymous sign-in) are **not** deployed by the workflow, because the deploy account lacks those permissions. After changing them, run `npm run deploy` logged in as a project owner.
- A failing build, unit test or rules test stops the deploy, so run `npm run build`, `npm run test:unit` and `npm run test:rules` before committing.
- Never commit secrets. The Firebase web config in `.env.production` is public by design. The deploy service account key lives only in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret.
- The production Firebase project ID is the `default` entry in `.firebaserc`. Local development always uses the `demo-game` emulator project.

## Commands

```sh
npm run emulators   # Auth + Firestore emulators (needs Java 21: /opt/homebrew/opt/openjdk@21/bin on PATH)
npm run dev         # Vite dev server, reachable from a phone on the LAN
npm run build       # type-check + production build
npm run audit       # replays saved runs and reports ones that don't add up
npm run test:unit   # game logic tests, no emulator needed
npm run test:rules  # Firestore rules tests (starts its own emulator; stop `npm run emulators` first)
```

## How the game fits together

- **`src/sim/` is the whole game as pure TypeScript**: balance data, hex grid, economy, shop, a planning reducer, combat, AI opponents. No Phaser, DOM, Firebase, `Math.random` or `Date`; `tests/unit/purity.test.ts` enforces it. Every random choice comes from a named seeded stream (`src/sim/rng.ts`), so the same boards and seed always give the same fight on any device.
- A fight is simulated in one go at 20 ticks/s and produces an event log; `src/game/scenes/BattleScene.ts` replays the log. The run is advanced **before** the replay starts, so closing the app mid-fight can't undo a loss.
- Changing anything that affects combat changes old fights: bump `BALANCE_VERSION` in `src/sim/balance.ts` and update the golden hash in `tests/unit/combat.test.ts`.
- `src/runStore.ts` (zustand) holds the run in progress and saves it to `localStorage`, so a reload resumes it. The scene subscribes to the store directly.
- Creatures are crude MS Paint-style memes in `src/shared/creatureArt.ts` (fat black outline, flat MS Paint colours, every path shaken by a fixed hash in `wobble()` so it looks hand-drawn), drawn from each meme's origin only where no one owns it (public-domain art, Italian brainrot, Meme Man, plain animals); never copy owned characters such as Pepe, Trollface, Nyan Cat or the Doge photo. They are baked onto canvas textures by `src/game/battle/textures.ts` and drawn as SVG by `CreatureChip`, so every view shows the same creature. Creature art is generated in code; the only image files are the app icons in `public/`.
- **Opponents are ghosts:** each round you fight another player's saved board from the same round (`src/services/opponents.ts`), or a bot (`src/sim/ai.ts`) when there's none, the query fails, or the index isn't built yet. Bots play the real shop and economy, so their boards are always ones a player could have had.
- **The daily challenge** is the same run for everyone that day: its seed is just the day, its id is `runs/{uid}_d{day}` (so a second one that day fails on its own, with no counter), and it files on `dailyRankings/{day}` instead of `rankings/{day}`. `mode` and `day` are optional on a run, so a client from before it keeps starting ordinary runs.
- **Online runs:** a run is `runs/{uid}_{n}`, started in one batch with `players/{uid}.runsStarted`. Each round is queued in `runStore` (saved to localStorage) and written in order, at least 3 s apart as the rules require; the last round also files `rankings/{day}/entries/{uid}`. A write the rules refuse marks the run offline (it plays on, unranked); a network error leaves it queued to retry.
- **Items** drop after round 2 and every third round after (5, 8, 11, …), and a creature holds one. A board records them as two lists, `it` (item ids) and `ia` (which slot holds each), which is what lets loop-free rules check both the cap and one-per-creature.
- **Rules check boards, not fights:** `isValidBoard()` in `firestore.rules` rejects boards no one could have afforded by that round. Its numbers (unit costs, XP table, gold budget, base damage, items) are copies of `src/sim`, and since runs have no last round the per-round ones are formulas, not tables; `tests/unit/rulesSync.test.ts` fails if they drift. After changing costs or the economy, update both.

## Constraints

- **Catching cheats:** the rules can't replay a fight, so `npm run audit` does it here. Every board records the rival it fought, so `scripts/auditRuns.ts` re-simulates each round and reports runs whose wins or HP don't match. Read-only; run it by hand against production with `AUDIT_PROJECT_ID=<id>`.
- **Spark plan:** no Cloud Functions, no Cloud Storage. `firestore.rules` is the only server-side validation, so every client write needs a matching rule and a test in `tests/rules/`.
- **Neon Flap's old data** (`users/*`, `leaderboards/*`, `items/*`) is left in Firestore; deleting it would only spend quota. The rules deny all of it except a player reading their own `users/{uid}`, which the app does once to carry their name over. `tests/rules/legacy.test.ts` covers this.
- Rankings are filed under a UTC day, and the rules only accept a day within one of the server clock, so tests derive their dates from `dayId()` rather than hardcoding them.
- Phaser is not mounted inside React `StrictMode` (see `src/main.tsx`).
- **One palette, in `src/index.css`.** Colours are written only in the `:root` block and its `prefers-color-scheme: dark` twin; everything else uses `var()`. The `--board-*` properties there are read at runtime by `src/shared/theme.ts` (`readBoardPalette()`) and handed to Phaser, so the board follows the colour scheme; they must stay plain `#rrggbb` with alpha as a separate number, or the parsing breaks. When the scheme flips, `BattleScene.applyPalette()` repaints in place — restarting the scene would rewind a fight in progress.
- **Storage keys keep their old names** (`neon-brawl:*` in `src/runStore.ts`, `neon-flap:audio` in `src/game/audio.ts`). They are invisible, and renaming them wipes in-progress runs, lifetime stats and audio prefs on every device.
- **Hosting cache headers** in `firebase.json` match the *requested* path, not the file served. The no-cache rules therefore use `/` and `/*` (the app's routes, which all serve `index.html`); `/assets/**` has two segments, so hashed assets keep their immutable caching. Without this, a deploy can be masked for an hour by a cached page.
- After a deploy, the first visit is served from the offline cache and runs the **previous** version, which may not match current rules. The error screen's Reload button (`src/App.tsx`) clears the service worker and caches.
