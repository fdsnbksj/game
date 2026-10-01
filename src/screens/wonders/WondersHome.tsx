import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { createRoom, joinRoom } from '../../services/wonders';
import { useGameStore } from '../../store';

/** Open an Ancient Wonders room, or join one by its code. */
export function WondersHome() {
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
      if (next) navigate(`/wonders/${next}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Ancient Wonders">
      <p className="lead-note">
        Three to seven cities, three ages. Each turn everyone picks a card from their hand at once, then passes the rest
        on. Build your city, raise your wonder, and buy what you lack from your neighbours. Add bots to fill the table.
      </p>
      {!ready && <p className="note">Connecting… Ancient Wonders needs a connection.</p>}
      <button className="button primary" disabled={!ready || busy} onClick={() => void run(createRoom)}>
        Open a room
      </button>
      <p className="group-title">Join a room</p>
      <form
        className="group card-pad form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const room = code.trim().toUpperCase();
            const problem = await joinRoom(room);
            if (problem) {
              setError(problem);
              return null;
            }
            return room;
          });
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
