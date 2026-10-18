import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { GameBanner } from '../world/GameBanner';
import { OpenRooms } from '../../components/RoomSetup';
import { SummaryRow } from '../../components/SummaryRow';
import { reloadFresh } from '../../reload';
import { createHeroRoom, joinHeroRoom, versionProblem } from '../../services/hero';
import { useGameStore } from '../../store';
import { Stickman } from './Stickman';

// Hero Gambit's front door, a game for playing a friend: host a fight and share the code,
// join theirs (by code or from the open rooms), or share one phone. The rules fold away.

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

  const join = async (room = code.trim().toUpperCase()) => {
    const problem = await joinHeroRoom(room);
    if (problem) {
      setError(problem);
      return null;
    }
    return room;
  };

  return (
    <Page title="" back="/" game="hero">
      <div className="home front-door">
        <GameBanner
          id="hero"
          line="You against a friend."
          art={
            <>
              <Stickman />
              <span className="hub-vs">VS</span>
              <Stickman flip />
            </>
          }
        />

        {!ready && <p className="note center-note">Connecting…</p>}
        <button className="button primary" disabled={!ready || busy} onClick={() => void run(createHeroRoom)}>
          Host a fight
        </button>
        {joining ? (
          <form
            className="join-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => join());
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
        {error && (error === versionProblem(0) || error === versionProblem(Number.MAX_SAFE_INTEGER)) && (
          <button className="button" onClick={() => void reloadFresh()}>
            Reload the latest version
          </button>
        )}
        <Link className="button" to="/hero/local">
          Play on one phone
        </Link>

        <OpenRooms path="heroDuels" ready={ready} busy={busy} onPick={(room) => void run(() => join(room))} />

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Hero Gambit">
            <div className="how-to">
              <p>You and your friend each have 200 HP, each on your own phone or taking turns on one. Take turns; each turn the game picks your skill: Stopwatch, I'm Speed, Memory or Fast as Fuck. Every hit's damage varies a little. At 30 HP or less it's your last stand: you get Roulette or Jackpot instead, a gamble for an instant kill. Bring the other's HP to 0 to win.</p>
              <p>
                <strong>Stopwatch:</strong> you're shown a time between 1.00 and 10.00 seconds, like 4.37. Press Start, count, press Stop. Then your friend tries the same time: only if you were closer does your hit land, and the closer you are, the harder it is. Within 0.05 s is Perfect: a sure crit.
              </p>
              <p>
                <strong>I'm Speed:</strong> tap Ready, wait for the light to turn green, then tap. Then your friend gets their own light: only if you were faster does your hit land, and the faster, the harder; 0.15 s or less is a sure crit. Tap on red and you miss.
              </p>
              <p>
                <strong>Fast as Fuck:</strong> tap the pad as fast as you can for 5 seconds. Then your friend does: only if you tapped more does your hit land, 5 for every tap more (up to 100).
              </p>
              <p>
                <strong>Roulette</strong> (last stand): pick a number from 0 to 36. If the ball lands on it, it's an instant kill; if not, you punch.
              </p>
              <p>
                <strong>Memory:</strong> a 20-digit number shows for 5 seconds, then hides; type it back. The first wrong digit ends your go. Then your friend gets their own number: only if you remembered more does your hit of 90 land; all 20 is a sure crit.
              </p>
              <p>
                <strong>Jackpot</strong> (last stand): pull, and three reels spin. Three alike is an instant kill, a pair hits for double (80), nothing alike does nothing.
              </p>
            </div>
          </SummaryRow>
        </div>
      </div>
    </Page>
  );
}
