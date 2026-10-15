import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../../components/Page';
import type { Move } from '../../games/hero/skills';
import { HERO_VERSION, replay, type Recorded } from '../../games/hero/state';
import { Fight, turnShowMs } from './Fight';

// A fight on one phone (the user's ask): two players take turns, passing the phone. Nothing
// goes to Firestore. The fight is saved to localStorage after every move (a key of its own),
// so it can be put down and picked up again.

const KEY = 'game:heroLocal';
/** The ids the moves are recorded by: player 1 is fighter 0. */
const PLAYERS = ['p1', 'p2'] as const;

interface Saved {
  v: number;
  seed: string;
  names: [string, string];
  moves: Recorded[];
}

function load(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return saved && saved.v === HERO_VERSION && Array.isArray(saved.moves) ? saved : null;
  } catch {
    return null;
  }
}

function store(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or full storage: the fight lasts this visit.
  }
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export function LocalFight() {
  const [saved, setSaved] = useState<Saved | null>(load);
  const update = (next: Saved | null) => {
    store(next);
    setSaved(next);
  };
  return (
    <Page title="Hero Gambit · One phone" back="/hero">
      {saved ? (
        <Game key={saved.seed} saved={saved} onChange={update} />
      ) : (
        <Setup onStart={(names) => update({ v: HERO_VERSION, seed: newSeed(), names, moves: [] })} />
      )}
    </Page>
  );
}

function Setup({ onStart }: { onStart: (names: [string, string]) => void }) {
  const [a, setA] = useState('Player 1');
  const [b, setB] = useState('Player 2');
  const name = (s: string, fallback: string) => s.trim().slice(0, 20) || fallback;
  return (
    <form
      className="hero-play"
      onSubmit={(event) => {
        event.preventDefault();
        onStart([name(a, 'Player 1'), name(b, 'Player 2')]);
      }}
    >
      <p className="note">Two players, one phone: pass it over when it's the other's turn.</p>
      <input className="field" aria-label="First player" maxLength={20} value={a} onChange={(e) => setA(e.target.value)} />
      <input className="field" aria-label="Second player" maxLength={20} value={b} onChange={(e) => setB(e.target.value)} />
      <button className="button primary">Start</button>
    </form>
  );
}

function Game({ saved, onChange }: { saved: Saved; onChange: (next: Saved | null) => void }) {
  const state = useMemo(() => replay(saved.seed, [{ name: saved.names[0] }, { name: saved.names[1] }], PLAYERS, saved.moves), [saved]);
  // The result waits a moment, so the last hit shows first.
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (state.winner === null) return;
    const t = setTimeout(() => setOver(true), turnShowMs(state) + 400);
    return () => clearTimeout(t);
  }, [state.winner]);

  const play = (move: Move) => onChange({ ...saved, moves: [...saved.moves, { by: PLAYERS[state.turn], move }] });

  return (
    <Fight state={state} me={0} names={saved.names} hotseat onMove={play} waiting="">
      {state.winner !== null && over && (
        <div className="overlay">
          <div className="panel" role="dialog" aria-label="Fight over">
            <h2>{saved.names[state.winner]} wins!</h2>
            <button className="button primary" onClick={() => onChange({ ...saved, seed: newSeed(), moves: [] })}>
              Rematch
            </button>
            <button className="button" onClick={() => onChange(null)}>
              New players
            </button>
            <Link className="button ghost" to="/" onClick={() => onChange(null)}>
              Home
            </Link>
          </div>
        </div>
      )}
    </Fight>
  );
}
