# a game

Small logic puzzles for between chapters. Each one is a nonogram: fill in squares so that every row and column matches the numbers beside it, and a picture appears. It's built for a train ride with a book. Everything works with one thumb, nothing needs sound, there's no clock and no way to lose, and every tap is saved, so you can close it at your stop, even without a signal. Levels go on forever and grow from 5×5 to 10×10. The daily puzzle is the same for everyone. Both have rankings.

It also helps you remember what you read. Add your highlights, pasted or from a Kindle's `My Clippings.txt`. After each level, one comes back with a word missing, and you pick the word to open the next level. Lines you know come back less often, and ones you miss come back sooner. Highlights stay on your phone.

React handles the screens, and Firebase (free Spark plan) provides auth, data and hosting. Puzzles are generated in code from their level or day. The game replaced an auto-battler, which had replaced Neon Flap, a flappy-bird game.

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
npm run audit       # check saved solves against their puzzles
npm run test:unit   # puzzle logic (no emulator)
npm run test:rules  # starts its own Firestore emulator, so stop `npm run emulators` first
npm run build       # type-check + production build
```

## Layout

| Path | What |
|---|---|
| `src/nonogram/` | The puzzles as pure, deterministic TypeScript: clues, line solver, generator, play reducer |
| `src/nonogramStore.ts` | Puzzles in progress and solves, saved to localStorage, and the queue of writes to Firestore |
| `src/components/Board.tsx` | The grid: tap and drag to mark squares |
| `src/learn/`, `src/libraryStore.ts` | Highlights: importing, fill-the-gap questions, spaced repetition; kept on the device |
| `src/screens/` | React screens: Home, Play, Rankings, How to play, Profile |
| `src/services/` | Firestore reads and writes: session, players, solves and rankings |
| `tests/unit/`, `tests/rules/` | Puzzle tests, and Firestore rules tests |
| `firestore.rules` | The only server-side validation (Spark has no Cloud Functions) |

## Deploy

We only use the `main` branch, and **every push to `main` deploys automatically** (`.github/workflows/deploy.yml`):

1. Unit tests
2. Type-check and build
3. Firestore rules tests
4. Deploy Hosting and Firestore rules to the project in `.firebaserc`
5. Deploy Firestore indexes (allowed to fail; see `CLAUDE.md`)

A failing step, apart from the indexes, stops the deploy. Auth settings in `firebase.json` (anonymous sign-in) aren't deployed by the workflow; after changing them, run `npm run deploy` as a project owner.

The workflow signs in with a service account key stored in the `FIREBASE_SERVICE_ACCOUNT` GitHub secret. The public Firebase web config is committed in `.env.production`.

To deploy by hand from this machine with your own Firebase login, run `npm run deploy`.

## Anti-cheat on Spark

Clients write to Firestore directly, so `firestore.rules` is the only check. The rules can't make a puzzle, so they check each solve's shape instead:

- the ladder climbs one level per write, a few seconds apart, and each level's grid must be that level's size; earlier levels can't be changed
- a daily solve is filed once per player, for a day within one of today, with a 10×10 grid

A scripted client can still file grids that don't answer their puzzles. Puzzles come from their level or day alone, so `npm run audit` makes each one again and reports every saved grid that doesn't match its clues.
