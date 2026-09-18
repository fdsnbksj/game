# Neon Flap

Tap to fly a bird through gaps in a neon skyline. Everyone gets the same course each day, and the daily leaderboard resets at 00:00 UTC. Beat your best score to unlock bird parts.

React handles the screens, Phaser 3 runs the gameplay, and Firebase (free Spark plan) provides auth, data and hosting. All art is drawn in code, so there are no image assets.

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
npm run test:rules  # starts its own Firestore emulator, so stop `npm run emulators` first
npm run build       # type-check + production build
```

## Layout

| Path | What |
|---|---|
| `src/game/scenes/FlapScene.ts` | The game: physics, towers from the daily seed, scoring |
| `src/game/character/` | The bird: parts drawn in code, tinting, particle trail |
| `src/screens/` | React screens: Home, Play, Customize, Leaderboard |
| `src/services/` | All Firestore reads and writes |
| `src/shared/` | Types, constants, the item catalog, the seeded random generator |
| `firestore.rules` | The only server-side validation (Spark has no Cloud Functions) |

## Deploy

We only use the `main` branch, and **every push to `main` deploys automatically** (`.github/workflows/deploy.yml`):

1. Type-check and build
2. Firestore rules tests
3. Seed the item catalog into production Firestore
4. Deploy Hosting and Firestore rules to the project in `.firebaserc`

A failing step stops the deploy. Auth settings in `firebase.json` (anonymous sign-in) aren't deployed by the workflow; after changing them, run `npm run deploy` as a project owner.

The workflow signs in with a service account key stored in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret. The public Firebase web config is committed in `.env.production`.

To deploy by hand from this machine with your own Firebase login, run `npm run deploy`.

## Anti-cheat on Spark

Clients write to Firestore directly, and `firestore.rules` rejects invalid data: a player can only write their own docs, scores are capped, a day's score can only improve, a run's date must be within a day of the server clock, streaks can only grow by one day at a time, saves are rate-limited, a leaderboard entry must be written alongside the run that set it, and items unlock only once the stored best score reaches the item's threshold. A determined player can still send a fake score. When we move to the Blaze plan, a `submitRun` Cloud Function should validate runs and the rules should lock leaderboard and inventory writes to it.
