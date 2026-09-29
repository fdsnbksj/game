import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { createRoom, joinRoom } from '../../services/avalon';
import { useGameStore } from '../../store';

/** Open a room, or join one by its code. */
export function AvalonHome() {
  const navigate = useNavigate();
  const ready = useGameStore((s) => s.player !== null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) navigate(`/avalon/${next}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    run(async () => {
      const room = code.trim().toUpperCase();
      const problem = await joinRoom(room);
      if (problem) {
        setError(problem);
        return null;
      }
      return room;
    });

  return (
    <Page title="Avalon">
      <p className="note">
        A game of hidden loyalty for 5 to 10 players around one table. Each player uses their own phone: it deals the
        roles, runs the votes and keeps score. Talk out loud; the arguing is the game.
      </p>
      {!ready && <p className="note">Connecting… Avalon needs a connection.</p>}

      <button className="button primary" disabled={!ready || busy} onClick={() => void run(createRoom)}>
        Open a room
      </button>

      <p className="group-title">Join a room</p>
      <form
        className="group card-pad form"
        onSubmit={(event) => {
          event.preventDefault();
          void join();
        }}
      >
        <input
          className="field code-field"
          placeholder="CODE"
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <button className="button" disabled={!ready || busy || code.length !== 4}>
          Join
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </Page>
  );
}
