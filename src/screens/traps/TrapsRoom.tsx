import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { MIN_SEATS, replay, waitingOn } from '../../games/traps/state';
import { forgetRoom, rememberPage } from '../../lastPage';
import { reloadFresh } from '../../reload';
import { useRoomHeartbeat } from '../../services/lobbies';
import { finishGame, joinRoom, leaveRoom, MAX_SEATS, rematch, sendMove, setSeats, startGame, versionProblem, watchRoom, type TrapsData, type TrapsRoom as Room } from '../../services/traps';
import { useGameStore } from '../../store';
import { TrapsGame } from './TrapsGame';

// Trap Tower's room: the lobby, then the tower. Every phone acts for its own seat, all at
// once; the table is in TrapsGame, shared with the one-phone game.

export function TrapsRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<TrapsData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);
  // Says this phone is in the room, so it isn't cleared away as empty (src/services/lobbies.ts).
  useRoomHeartbeat('traps', code, !!uid && !!data.room?.seats.includes(uid));
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.seats.includes(uid));
  useEffect(() => {
    // A rematch puts the room back on home's Continue.
    if (ended) forgetRoom(`/traps/${code}`);
    else if (data.room?.status === 'playing') rememberPage(`/traps/${code}`);
  }, [ended, code, data.room?.status]);

  const room = data.room;
  const problem = room && versionProblem(room.version);
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (problem)
    body = (
      <div className="empty-state">
        <p className="note">{problem}</p>
        <button className="button primary" onClick={() => void reloadFresh()}>
          Reload the latest version
        </button>
      </div>
    );
  else if (!room.seats.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  // Keyed by the seed: a rematch starts the tower over.
  else body = <Game key={room.seed} room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Trap Tower · ${code}`} back="/traps" game="traps">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/traps">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/">
        All games
      </Link>
    </div>
  );
}

function NotIn({ room }: { room: Room }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="button primary" onClick={() => void joinRoom(room.code).then(setError, (e) => setError(String(e)))}>
        Join room {room.code}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Lobby({ room, uid }: { room: Room; uid: string }) {
  const isHost = room.host === uid;
  const [error, setError] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => void p.catch((e) => setError(e instanceof Error ? e.message : String(e)));
  const n = room.seats.length;
  const move = (i: number, by: number) => {
    const seats = [...room.seats];
    const j = (i + by + n) % n;
    [seats[i], seats[j]] = [seats[j], seats[i]];
    act(setSeats(room, seats));
  };
  const label = (seat: string) => (seat === uid ? 'You' : room.names[seat]);

  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <p className="group-title">
            Players · {n} of {MAX_SEATS}
          </p>
          <ol className="group players">
            {room.seats.map((seat, i) => (
              <li key={seat} className="row">
                <span className={`traps-dot seat-${i}`} aria-hidden="true" />
                <span>{label(seat)}</span>
                {seat === room.host && <span className="row-detail">Host</span>}
                {isHost && n > 1 && (
                  <span className="seat-moves">
                    <button className="icon-button small" aria-label="Move up a seat" onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button className="icon-button small" aria-label="Move down a seat" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {isHost ? (
            <button className="button primary" disabled={n < MIN_SEATS} onClick={() => act(startGame(room.code))}>
              {n < MIN_SEATS ? 'Waiting for a friend to join' : 'Start'}
            </button>
          ) : (
            <>
              <p className="note center-note">The host starts when everyone is in.</p>
              <button className="button ghost" onClick={() => act(leaveRoom(room))}>
                Leave the room
              </button>
            </>
          )}
        </>
      }
    />
  );
}

function Game({ room, moves, uid }: { room: Room; moves: TrapsData['moves']; uid: string }) {
  // This game's moves only: a rematch follows on from the last game's.
  const state = useMemo(() => replay(room.seed!, room.seats, moves.slice(room.from)), [room.seed, room.seats, room.from, moves]);
  const me = room.seats.indexOf(uid);
  const count = useRef(moves.length);
  count.current = moves.length;
  const nameOf = (seat: number) => (seat === me ? 'You' : room.names[room.seats[seat]]);

  // Over on every phone at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.winners && room.status === 'playing') void finishGame(room.code).catch(() => {});
  }, [state.winners, room.status, room.code]);

  const [rematching, setRematching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const again = () => {
    setRematching(true);
    setError(null);
    void rematch(room.code, moves.length).catch(() => {
      setRematching(false);
      setError('Couldn’t start a rematch. Check the connection and try again.');
    });
  };

  return (
    <TrapsGame state={state} actor={waitingOn(state).includes(me) ? me : null} nameOf={nameOf} send={(move) => sendMove(room.code, () => count.current, move)} runKey={`${room.code}:${room.seed}`}>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={rematching} onClick={again}>
        {rematching ? 'Starting…' : 'Rematch'}
      </button>
      <Link className="button ghost" to="/traps">
        Leave the room
      </Link>
    </TrapsGame>
  );
}
