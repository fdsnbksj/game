import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { GameBanner } from '../screens/world/GameBanner';
import { openRooms, type OpenRoom, type RoomCollection } from '../services/lobbies';
import type { GameId } from '../screens/world/games';
import { useGameStore } from '../store';
import { Page } from './Page';
import { Sheet } from './Sheet';

/**
 * A party game's front door: what it is in a line, Host a game, Join with a code, the
 * rooms waiting for players, and the rules a tap away. Shared by every party game.
 */
export function GameHome({
  title,
  tagline,
  base,
  rooms,
  back,
  howTo,
  onHost,
  onJoin,
}: {
  title: string;
  tagline: string;
  /** Where rooms live: `/avalon`, `/wonders`, `/isle`. */
  base: string;
  /** The Firestore collection its rooms are in, for the open rooms. */
  rooms: RoomCollection;
  /** Where the back arrow goes; the list of games unless given. */
  back?: string;
  howTo: ReactNode;
  onHost: () => Promise<string>;
  /** Joins; returns why not, or null. */
  onJoin: (code: string) => Promise<string | null>;
}) {
  const navigate = useNavigate();
  const ready = useGameStore((s) => s.player !== null);
  // The game this door belongs to, from its base path, for its banner.
  const gameId = base.slice(1) as GameId;
  const [joining, setJoining] = useState(false);
  const [rules, setRules] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = (room: string) =>
    run(async () => {
      const problem = await onJoin(room);
      if (problem) {
        setError(problem);
        return null;
      }
      return room;
    });

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const room = await action();
      if (room) navigate(`${base}/${room}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="" back={back ?? '/'} game={gameId}>
      <GameBanner id={gameId} line={tagline} />
      {!ready && <p className="note center-note">Connecting…</p>}
      <div className="front-door">
        <button className="button primary" disabled={!ready || busy} onClick={() => void run(onHost)}>
          Host a game
        </button>
        {joining ? (
          <form
            className="join-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void join(code.trim().toUpperCase());
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
        <OpenRooms path={rooms} ready={ready} busy={busy} onPick={(room) => void join(room)} />
        <button className="button ghost" onClick={() => setRules(true)}>
          How to play
        </button>
      </div>
      {rules && (
        <Sheet title={`How to play ${title}`} onClose={() => setRules(false)}>
          <div className="how-to">{howTo}</div>
          <button className="button" onClick={() => setRules(false)}>
            Got it
          </button>
        </Sheet>
      )}
    </Page>
  );
}

/**
 * The rooms of a game waiting for players, to join with a tap, and a Refresh button.
 * Loaded on opening; empty lobbies drop out (src/services/lobbies.ts).
 */
export function OpenRooms({ path, ready, busy, onPick }: { path: RoomCollection; ready: boolean; busy: boolean; onPick: (code: string) => void }) {
  const [rooms, setRooms] = useState<OpenRoom[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setRooms(await openRooms(path));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  return (
    <section className="open-rooms" aria-label="Open rooms">
      <div className="open-rooms-head">
        <h2>Open rooms</h2>
        <button className="button ghost" disabled={!ready || loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      {failed ? (
        <p className="note">Couldn’t load the rooms. Check the connection and refresh.</p>
      ) : rooms === null ? (
        <p className="note">{ready ? 'Looking…' : 'Connecting…'}</p>
      ) : rooms.length === 0 ? (
        <p className="note">No rooms waiting right now. Host one, or refresh.</p>
      ) : (
        <ul className="open-room-list">
          {rooms.map((room) => {
            const full = !room.mine && room.count >= room.max;
            return (
              <li key={room.code}>
                <button className="open-room" disabled={busy || full} onClick={() => onPick(room.code)}>
                  <span className="open-room-who">
                    <strong>{room.names[0]}’s room</strong>
                    <small>{room.names.join(', ')}</small>
                  </span>
                  <span className="open-room-count">
                    {room.count}/{room.max}
                  </span>
                  <span className="open-room-go">{room.mine ? 'Open' : full ? 'Full' : 'Join'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * A lobby: the code to read out, who's in, and one main button. Every setting folds
 * under Options, so the screen stays simple until someone wants them.
 */
export function Lobby({ code, players, options, action }: { code: string; players: ReactNode; options?: ReactNode; action: ReactNode }) {
  const [showOptions, setShowOptions] = useState(false);
  return (
    <>
      <div className="room-code">
        <span className="micro">Room code</span>
        <strong>{code}</strong>
        <span className="note">Friends tap “Join with a code” and type it in.</span>
      </div>
      {players}
      {options && (
        <>
          <button className="button ghost options-toggle" aria-expanded={showOptions} onClick={() => setShowOptions(!showOptions)}>
            {showOptions ? 'Hide options' : 'Options ›'}
          </button>
          {showOptions && <div className="lobby-options">{options}</div>}
        </>
      )}
      <div className="lobby-action">{action}</div>
    </>
  );
}
