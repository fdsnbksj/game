import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { GAME_TICKS, H, newGame, simulate, sortThrows, advance, TICKS_PER_SECOND, W, winner, type PigState, type Throw } from '../../games/pigs/sim';
import { forgetRoom, rememberPage } from '../../lastPage';
import { reloadFresh } from '../../reload';
import { useRoomHeartbeat } from '../../services/lobbies';
import {
  COUNTDOWN_MS,
  finishPigRoom,
  joinPigRoom,
  leavePigRoom,
  measureClock,
  rematchPigRoom,
  sendThrow,
  startPigRoom,
  versionProblem,
  watchPigRoom,
  type PigRoom as Room,
  type PigRoomData,
} from '../../services/pigs';
import { useGameStore } from '../../store';
import { draw, readPalette } from './render';

// Pig Lasso's room: the lobby, then the pen. Each phone plays the same pen from the seed
// and both players' throws, on the server's clock, turned so its own farmer is at the
// bottom; a tap anywhere throws. A throw from the other phone arrives a moment late, and
// the pen is played again from the start with it in (it takes well under a millisecond).

export function PigRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<PigRoomData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchPigRoom(code, uid, setData) : undefined), [code, uid]);
  useRoomHeartbeat('pigs', code, !!uid && !!data.room?.playerIds.includes(uid));
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.playerIds.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/pigs/${code}`);
    else if (data.room?.status === 'playing') rememberPage(`/pigs/${code}`);
  }, [ended, code, data.room?.status]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.playerIds.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status !== 'done' && versionProblem(room.version)) body = <OtherVersion text={versionProblem(room.version)!} />;
  else if (room.status === 'lobby' || !room.seed || room.startedAt === null) body = <Lobby room={room} uid={uid} />;
  else body = <Game key={room.seed} room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Pig Lasso · ${code}`} back="/pigs" game="pigs">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/pigs">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/">
        All games
      </Link>
    </div>
  );
}

function OtherVersion({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <button className="button primary" onClick={() => void reloadFresh()}>
        Reload the latest version
      </button>
      <Link className="button ghost" to="/pigs">
        Back
      </Link>
    </div>
  );
}

function NotIn({ room }: { room: Room }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="button primary" onClick={() => void joinPigRoom(room.code).then(setError, (e) => setError(String(e)))}>
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
  const ready = room.playerIds.length === 2;
  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <p className="group-title">Players · {room.playerIds.length} of 2</p>
          <ol className="group players">
            {room.playerIds.map((id) => (
              <li key={id} className="row">
                <span>{id === uid ? 'You' : room.names[id]}</span>
                {id === room.host && <span className="row-detail">Host</span>}
              </li>
            ))}
          </ol>
        </>
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {isHost ? (
            <button className="button primary" disabled={!ready} onClick={() => act(startPigRoom(room.code))}>
              {ready ? 'Start' : 'Waiting for a friend…'}
            </button>
          ) : (
            <>
              <p className="note center-note">The host starts when you're both in.</p>
              <button className="button ghost" onClick={() => act(leavePigRoom(room))}>
                Leave the room
              </button>
            </>
          )}
        </>
      }
    />
  );
}

// ---------- The pen ----------

/** After the minute, how long a phone waits for late throws before marking the game over. */
const SETTLE_MS = 1500;

function Game({ room, moves, uid }: { room: Room; moves: PigRoomData['moves']; uid: string }) {
  const me = room.playerIds.indexOf(uid);
  const names: [string, string] = [room.names[room.playerIds[0]] ?? 'Player 1', room.names[room.playerIds[1]] ?? 'Player 2'];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // How far the server's clock is ahead of this phone's; 0 until measured.
  const offset = useRef(0);
  const [synced, setSynced] = useState(false);
  // This game's throws as the server has them, and this phone's own still on their way.
  const recorded = useMemo<Throw[]>(
    () => moves.slice(room.from).map((m) => ({ seat: room.playerIds.indexOf(m.by), tick: m.move.t })),
    [moves, room.from, room.playerIds],
  );
  const [pending, setPending] = useState<number[]>([]);
  const throws = useMemo(() => sortThrows([...recorded, ...pending.map((tick) => ({ seat: me, tick }))]), [recorded, pending, me]);
  const throwsRef = useRef(throws);
  const pen = useRef<PigState>(newGame(room.seed!));
  const count = useRef(moves.length);
  count.current = moves.length;
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'over'>('waiting');
  const [error, setError] = useState<string | null>(null);

  const startMs = room.startedAt! + COUNTDOWN_MS;
  const serverNow = () => Date.now() + offset.current;
  const tickNow = () => Math.floor(((serverNow() - startMs) * TICKS_PER_SECOND) / 1000);

  useEffect(() => {
    let live = true;
    measureClock(room.code)
      .then((ms) => {
        if (live) offset.current = ms;
      })
      .catch(() => {})
      .finally(() => live && setSynced(true));
    return () => {
      live = false;
    };
  }, [room.code]);

  // New throws: play the pen again from the start, up to where it was.
  useEffect(() => {
    throwsRef.current = throws;
    const at = pen.current.tick;
    pen.current = newGame(room.seed!);
    advance(pen.current, throws, at);
  }, [throws, room.seed]);

  // The frame loop: catch the pen up to the server's clock and draw it.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const palette = readPalette();
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const scale = Math.min(rect.width / W, rect.height / H);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (dpr * (rect.width - W * scale)) / 2, (dpr * (rect.height - H * scale)) / 2);
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(wrap);
    let frame = 0;
    let reported = false;
    const loop = () => {
      // The next frame is asked for first, so one bad frame can't stop the pen for good.
      frame = requestAnimationFrame(loop);
      const now = tickNow();
      setPhase(now < 0 ? 'waiting' : now < GAME_TICKS ? 'playing' : 'over');
      try {
        advance(pen.current, throwsRef.current, Math.max(0, now));
        const countdown = now < 0 ? startMs - serverNow() : null;
        draw(ctx, pen.current, palette, { me, names, countdown });
      } catch (e) {
        if (!reported) console.error('Pig Lasso frame failed', e);
        reported = true;
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
    // The loop reads everything that changes through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the minute is up and late throws have had a moment, either phone marks it over.
  useEffect(() => {
    if (phase !== 'over' || room.status !== 'playing') return;
    const wait = Math.max(0, startMs + 60_000 + SETTLE_MS - serverNow());
    let timer = setTimeout(function tryFinish() {
      void finishPigRoom(room.code).catch(() => {});
      timer = setTimeout(tryFinish, 3000);
    }, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, room.status, room.code]);

  const toss = () => {
    const tick = pen.current.tick;
    if (phase !== 'playing' || tick >= GAME_TICKS || pen.current.lassos[me].mode !== 'swing') return;
    setPending((p) => [...p, tick]);
    setError(null);
    void sendThrow(room.code, () => count.current, tick).catch(() => {
      setPending((p) => p.filter((t) => t !== tick));
      setError('A throw didn’t reach the other phone. Check the connection.');
    });
  };

  const done = room.status === 'done';
  const final = useMemo(() => (done ? simulate(room.seed!, recorded) : null), [done, room.seed, recorded]);
  const [rematching, setRematching] = useState(false);
  const again = () => {
    setRematching(true);
    void rematchPigRoom(room, moves.length).catch(() => {
      setRematching(false);
      setError('Couldn’t start a rematch. Check the connection and try again.');
    });
  };

  return (
    <>
      <div
        className="pigs-field"
        ref={wrapRef}
        onPointerDown={(event) => {
          event.preventDefault();
          toss();
        }}
      >
        <canvas ref={canvasRef} className="pigs-canvas" aria-label="The pen: tap to throw your lasso" />
        {phase === 'waiting' && !synced && <p className="pigs-banner">Setting the clocks…</p>}
        {phase === 'over' && !final && <p className="pigs-banner">Time’s up! Counting…</p>}
        {final && <Result state={final} me={me} names={names} />}
      </div>
      {error && <p className="error">{error}</p>}
      {final ? (
        <div className="pigs-dock">
          <button className="button primary" disabled={rematching} onClick={again}>
            {rematching ? 'Starting…' : 'Rematch'}
          </button>
          <Link className="button ghost" to="/pigs">
            Leave the room
          </Link>
        </div>
      ) : (
        <p className="note center-note pigs-hint">Tap anywhere to throw. Black pigs are quick: an empty lasso costs 50.</p>
      )}
    </>
  );
}

function Result({ state, me, names }: { state: PigState; me: number; names: [string, string] }) {
  const won = winner(state);
  const them = 1 - me;
  const caught = (seat: number) => state.catches.filter((c) => c.seat === seat && c.points > 0).length;
  return (
    <div className="pigs-result">
      <h2>{won === null ? 'A draw!' : won === me ? 'You win!' : `${names[them]} wins`}</h2>
      <p>
        <strong>You {state.scores[me]}</strong> · {caught(me)} pigs
      </p>
      <p>
        {names[them]} {state.scores[them]} · {caught(them)} pigs
      </p>
    </div>
  );
}
