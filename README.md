# Neon Brawl

A neon auto-battler for your phone. Buy creatures from the shop, drag them onto a hex board, and watch them fight. Three copies merge into a stronger ★★, creatures that share a trait power each other up, items drop as you go, and a run lasts up to 15 rounds on 100 HP. Each round you fight another player's saved team from the same round, or a bot if there isn't one, and finished runs go on a daily ranking.

React handles the screens, Phaser 3 runs the board and fight replays, and Firebase (free Spark plan) provides auth, data and hosting. All art is drawn in code, so there are no image assets. The game replaced Neon Flap, a flappy-bird game.

## Requirements

- Node 22+
- Firebase CLI: `npm i -g firebase-tools`
- Java 21+ for the Firestore emulator, e.g. `brew install openjdk@21`

## Develop

```sh
npm install
npm run emulators   # terminal 1: Auth + Firestore emulators, UI at http://localhost:4000
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
| `src/services/` | Firestore reads and writes: players, runs, ghost opponents, rankings |
| `tests/unit/`, `tests/rules/` | Game logic tests, and Firestore rules tests |
| `firestore.rules` | The only server-side validation (Spark has no Cloud Functions) |

## Deploy

We only use the `main` branch, and **every push to `main` deploys automatically** (`.github/workflows/deploy.yml`):

1. Unit tests
2. Type-check and build
3. Firestore rules tests
4. Deploy Hosting and Firestore rules to the project in `.firebaserc`

A failing step stops the deploy. Auth settings in `firebase.json` (anonymous sign-in) aren't deployed by the workflow; after changing them, run `npm run deploy` as a project owner.

The workflow signs in with a service account key stored in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret. The public Firebase web config is committed in `.env.production`.

To deploy by hand from this machine with your own Firebase login, run `npm run deploy`.

## Anti-cheat on Spark

Clients write to Firestore directly, so `firestore.rules` is the only check. It can't replay a fight, so it can't tell who really won; instead it rejects what can't be true:

- every board a run saves must be one a player could have afforded by that round (no more units than the level, one per hex, no more gold's worth than could have been earned, and no more items than have dropped, one per creature)
- rounds are written one at a time, in order, a few seconds apart, and old rounds can't be changed
- a round's result stays within what a fight can do: a win costs no health, a loss costs at least the round's base damage and no more than a full board could deal
- a ranking must be written with the run's last round, match the run, beat the player's best that day, and be for today

A scripted client can still submit the strongest legal board every round, or claim wins it didn't earn. Combat is deterministic and every board records its opponent, so any run can be replayed later to check it. On the Blaze plan, a Cloud Function should replay each fight and the rules should leave run and ranking writes to it.
