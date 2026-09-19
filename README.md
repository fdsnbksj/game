# Neon Brawl

A neon auto-battler for your phone. Buy creatures from the shop, drag them onto a hex board, and watch them fight. Three copies merge into a stronger ★★, creatures that share a trait power each other up, and a run lasts up to 15 rounds on 100 HP.

React handles the screens, Phaser 3 runs the board and fight replays, and Firebase (free Spark plan) provides auth, data and hosting. All art is drawn in code, so there are no image assets. The game replaced Neon Flap, a flappy-bird game whose backend is still being retired.

## Requirements

- Node 22+
- Firebase CLI: `npm i -g firebase-tools`
- Java 21+ for the Firestore emulator, e.g. `brew install openjdk@21`

## Develop

```sh
npm install
npm run emulators   # terminal 1: Auth + Firestore emulators, UI at http://localhost:4000
npm run seed        # terminal 2: loads the item catalog (once per fresh emulator)
npm run dev         # terminal 2: open the "Network" URL on your phone (same Wi-Fi)
```

Emulator data is saved to `.emulator-data/` when you stop the emulators. The emulators listen on your LAN so a phone can reach them.

## Test

```sh
npm run test:unit   # game logic: sim, economy, shop, AI (no emulator)
npm run test:rules  # starts its own Firestore emulator, so stop `npm run emulators` first
npm run build       # type-check + production build
```

## Layout

| Path | What |
|---|---|
| `src/sim/` | The game as pure, deterministic TypeScript: units, traits, economy, shop, combat, AI |
| `src/game/scenes/BattleScene.ts` | The board: drag and drop, and replaying fights from the sim's event log |
| `src/runStore.ts` | The run in progress, saved to localStorage |
| `src/screens/` | React screens: Home, Run, How to play, Profile |
| `src/shared/creatureShapes.ts` | Every creature as shape data, drawn by Phaser and as SVG |
| `src/services/` | Firestore reads and writes (sign-in, profile; the rest is legacy Neon Flap) |
| `tests/unit/`, `tests/rules/` | Game logic tests, and Firestore rules tests |
| `firestore.rules` | The only server-side validation (Spark has no Cloud Functions) |

## Deploy

We only use the `main` branch, and **every push to `main` deploys automatically** (`.github/workflows/deploy.yml`):

1. Type-check and build
2. Unit tests
3. Firestore rules tests
4. Seed the (legacy) item catalog into production Firestore
5. Deploy Hosting and Firestore rules to the project in `.firebaserc`

A failing step stops the deploy. Auth settings in `firebase.json` (anonymous sign-in) aren't deployed by the workflow; after changing them, run `npm run deploy` as a project owner.

The workflow signs in with a service account key stored in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret. The public Firebase web config is committed in `.env.production`.

To deploy by hand from this machine with your own Firebase login, run `npm run deploy`.

## Anti-cheat on Spark

Clients write to Firestore directly, and `firestore.rules` rejects invalid data: a player can only write their own docs, scores are capped, a day's score can only improve, a run's date must be within a day of the server clock, streaks can only grow by one day at a time, saves are rate-limited, a leaderboard entry must be written alongside the run that set it, and items unlock only once the stored best score reaches the item's threshold. A determined player can still send a fake score. When we move to the Blaze plan, a `submitRun` Cloud Function should validate runs and the rules should lock leaderboard and inventory writes to it.
