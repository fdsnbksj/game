import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../../components/Page';
import { TRAPS_VERSION } from '../../games/traps/sim';
import { apply, MAX_SEATS, MIN_SEATS, replay, waitingOn, type Move, type Recorded } from '../../games/traps/state';
import { TrapsGame } from './TrapsGame';

// Trap Tower on one phone: two to four players pass it round, each taking their pick,
// place and run in seat order. Nothing goes to Firestore; the game is saved to
// localStorage after every move (a key of its own), so it can be put down any time.

const KEY = 'game:trapsLocal';
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

interface Saved {
  v: number;
  seed: string;
  names: string[];
  moves: Recorded[];
}

function load(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return saved && saved.v === TRAPS_VERSION && Array.isArray(saved.moves) && Array.isArray(saved.names) ? saved : null;
  } catch {
    return null;
  }
}

function store(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or full storage: the game lasts this visit.
  }
}

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');

export function TrapsLocal() {
  const [saved, setSaved] = useState<Saved | null>(load);
  const update = (next: Saved | null) => {
    store(next);
    setSaved(next);
  };
  return (
    <Page title="Trap Tower · One phone" back="/traps" game="traps">
      {saved ? <Game key={saved.seed} saved={saved} onChange={update} /> : <Setup onStart={(names) => update({ v: TRAPS_VERSION, seed: newSeed(), names, moves: [] })} />}
    </Page>
  );
}

function Setup({ onStart }: { onStart: (names: string[]) => void }) {
  const [names, setNames] = useState(['Player 1', 'Player 2']);
  return (
    <form
      className="traps-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(names.map((n, i) => n.trim().slice(0, 20) || `Player ${i + 1}`));
      }}
    >
      <p className="note">Two to four players, one phone: pass it on when it's the next one's turn.</p>
      {names.map((name, i) => (
        <div key={i} className="traps-setup-row">
          <span className={`traps-dot seat-${i}`} aria-hidden="true" />
          <input className="field" aria-label={`Player ${i + 1}`} maxLength={20} value={name} onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} />
          {names.length > MIN_SEATS && (
            <button type="button" className="icon-button small" aria-label={`Remove player ${i + 1}`} onClick={() => setNames(names.filter((_, k) => k !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {names.length < MAX_SEATS && (
        <button type="button" className="button" onClick={() => setNames([...names, `Player ${names.length + 1}`])}>
          Add a player
        </button>
      )}
      <button className="button primary">Start</button>
    </form>
  );
}

function Game({ saved, onChange }: { saved: Saved; onChange: (next: Saved | null) => void }) {
  const seats = useMemo(() => ids(saved.names.length), [saved.names.length]);
  const state = useMemo(() => replay(saved.seed, seats, saved.moves), [saved, seats]);
  const actor = waitingOn(state)[0] ?? null;

  const send = async (move: Move, seat: number) => {
    if (!apply(state, move, seat)) throw new Error('That move isn’t allowed now.');
    onChange({ ...saved, moves: [...saved.moves, { by: seats[seat], move }] });
  };

  return (
    <TrapsGame state={state} actor={actor} hotseat nameOf={(seat) => saved.names[seat]} send={send} runKey={`local:${saved.seed}`}>
      <button className="button primary" onClick={() => onChange({ ...saved, seed: newSeed(), moves: [] })}>
        Play again
      </button>
      <button className="button" onClick={() => onChange(null)}>
        New players
      </button>
      <Link className="button ghost" to="/" onClick={() => onChange(null)}>
        Home
      </Link>
    </TrapsGame>
  );
}
