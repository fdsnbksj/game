import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { OpenRooms } from '../../components/RoomSetup';
import { SummaryRow } from '../../components/SummaryRow';
import { reloadFresh } from '../../reload';
import { TRAPS_VERSION } from '../../games/traps/sim';
import { createRoom, joinRoom, versionProblem } from '../../services/traps';
import { useGameStore } from '../../store';
import { GameBanner } from '../world/GameBanner';
import { HowTo } from './TrapsGame';

// Trap Tower's front door: host a room and share the code, join one (by code or from the
// open rooms), or pass one phone round. The rules fold away.

export function TrapsHome() {
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
      if (room) navigate(`/traps/${room}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const join = async (room = code.trim().toUpperCase()) => {
    const problem = await joinRoom(room);
    if (problem) {
      setError(problem);
      return null;
    }
    return room;
  };

  return (
    <Page title="" back="/" game="traps">
      <div className="home front-door">
        <GameBanner id="traps" line="Build it hard, climb it first." />
        {!ready && <p className="note center-note">Connecting…</p>}
        <button className="button primary" disabled={!ready || busy} onClick={() => void run(createRoom)}>
          Host a game
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
        {error && (error === versionProblem(0) || error === versionProblem(TRAPS_VERSION + 1)) && (
          <button className="button" onClick={() => void reloadFresh()}>
            Reload the latest version
          </button>
        )}
        <Link className="button" to="/traps/local">
          Play on one phone
        </Link>

        <OpenRooms path="traps" ready={ready} busy={busy} onPick={(room) => void run(() => join(room))} />

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Trap Tower">
            <HowTo />
          </SummaryRow>
        </div>
      </div>
    </Page>
  );
}
