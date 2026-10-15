import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { createHeroRoom, joinHeroRoom } from '../../services/hero';
import { useGameStore } from '../../store';
import { Stickman } from './Stickman';

// Hero Gambit's front door, a game for playing a friend: host a fight and share the code,
// join theirs, or share one phone. The rules fold away.

export function Home() {
  const navigate = useNavigate();
  const ready = useGameStore((s) => s.player !== null);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const room = await action();
      if (room) navigate(`/hero/${room}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const room = code.trim().toUpperCase();
    const problem = await joinHeroRoom(room);
    if (problem) {
      setError(problem);
      return null;
    }
    return room;
  };

  return (
    <Page title="Hero Gambit" back="/">
      <div className="home">
      <section className="home-hero">
        <div className="home-pair">
          <Stickman />
          <Stickman flip />
        </div>
        <h1 className="home-title">Hero Gambit</h1>
        <p className="note">You against a friend.</p>
      </section>

      {!ready && <p className="note center-note">Connecting…</p>}
      <button className="button primary" disabled={!ready || busy} onClick={() => void run(createHeroRoom)}>
        Host a fight
      </button>
      {joining ? (
        <form
          className="join-inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run(join);
          }}
        >
          <input
            className="field code-field"
            placeholder="CODE"
            maxLength={4}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button className="button" disabled={!ready || busy || code.length !== 4}>
            Join
          </button>
        </form>
      ) : (
        <button className="button" disabled={!ready} onClick={() => setJoining(true)}>
          Join with a code
        </button>
      )}
      {error && <p className="error">{error}</p>}
      <Link className="button" to="/hero/local">
        Play on one phone
      </Link>

      <div className="home-more">
        <SummaryRow label="How to play" title="How to play Hero Gambit">
          <div className="how-to">
            <p>You and your friend each have 100 HP and the same four skills, each on your own phone or taking turns on one. Take turns using one skill; bring the other's HP to 0 to win. After you use a skill it rests a few of your turns: Stopwatch never, I'm Speed 1, Poker 2, Roulette 3.</p>
            <p>
              <strong>Stopwatch:</strong> you're shown a time between 1.00 and 10.00 seconds, like 4.37. Press Start, count, press Stop. The closer you are, the harder the hit. Within 0.05 s is Perfect: a sure crit.
            </p>
            <p>
              <strong>I'm Speed:</strong> tap Ready, wait for the light to turn green, then tap. The faster, the harder; 0.15 s or less is a sure crit. Tap on red and you miss.
            </p>
            <p>
              <strong>Roulette:</strong> pick a number from 0 to 36. If the ball lands on it, it's an instant kill; if not, you punch.
            </p>
            <p>
              <strong>Poker:</strong> tap one of thirteen face-down cards, 2 low to A high; it turns over at once. Your friend then picks another. Higher card hits for 50; lower does nothing.
            </p>
          </div>
        </SummaryRow>
      </div>
      </div>
    </Page>
  );
}
