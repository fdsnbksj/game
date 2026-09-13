# Untitled Game

A 2D mobile web skill game with character customization. React handles the screens, Phaser 3 runs the gameplay, and Firebase (free Spark plan) provides auth, data and hosting.

The gameplay in `src/game/scenes/PlayScene.ts` is a placeholder (tap the targets) until the real game is chosen.

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
| `src/game/` | Phaser: scenes, the layered `CharacterSprite`, and the `PhaserGame` React mount |
| `src/screens/` | React screens: Home, Play, Customize, Leaderboard |
| `src/services/` | All Firestore reads and writes |
| `src/shared/` | Types, constants, and the item catalog |
| `firestore.rules` | The only server-side validation (Spark has no Cloud Functions) |

## Deploy

We only use the `main` branch, and **every push to `main` deploys automatically** (`.github/workflows/deploy.yml`):

1. Type-check and build
2. Firestore rules tests
3. Seed the item catalog into production Firestore
4. Deploy Hosting and Firestore rules to the project in `.firebaserc`

A failing step stops the deploy. Auth settings in `firebase.json` (anonymous sign-in) aren't deployed by the workflow; after changing them, run `npm run deploy` as a project owner. Watch a run with `gh run watch`.

The workflow signs in with a service account key stored in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret. The public Firebase web config is committed in `.env.production`.

To deploy by hand from this machine with your own Firebase login, run `npm run deploy`.

## Anti-cheat on Spark

Clients write to Firestore directly, and `firestore.rules` rejects invalid data: a player can only write their own docs, scores are capped and can only go up, runs are rate-limited, and items unlock only once the stored best score reaches the item's threshold. A determined player can still send a fake score. When we move to the Blaze plan, a `submitRun` Cloud Function should validate runs and the rules should lock leaderboard and inventory writes to it.
