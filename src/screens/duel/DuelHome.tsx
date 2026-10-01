import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { createDuel, joinDuel } from '../../services/duel';
import { useGameStore } from '../../store';

/** Open a room, or join one by its code. */
export function DuelHome() {
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
      if (next) navigate(`/duel/${next}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Rival Wonders">
      <p className="note">
        Two rival cities, three ages. Take cards from the table to build your city and your wonders, and win by
        points, by driving your rival back to their capital, or by mastering six sciences. Each player on their own phone.
      </p>
      {!ready && <p className="note">Connecting… Rival Wonders needs a connection.</p>}
      <button className="button primary" disabled={!ready || busy} onClick={() => void run(createDuel)}>
        Open a room
      </button>
      <p className="group-title">Join a room</p>
      <form
        className="group card-pad form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const room = code.trim().toUpperCase();
            const problem = await joinDuel(room);
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
