import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { ACTION_DELAY, GAME_TICKS, KITCHENS, advance, isChopped, isRaw, isSoup, newGame, simulate, sortActions, stars, TICKS_PER_SECOND, INGREDIENT_NAMES, type Action, type Ingredient, type Item, type KitchenState } from '../../games/kitchen/sim';
import { forgetRoom, rememberPage } from '../../lastPage';
import { reloadFresh } from '../../reload';
import { useRoomHeartbeat } from '../../services/lobbies';
import {
  COUNTDOWN_MS,
  MAX_COOKS,
  finishKitchenRoom,
  joinKitchenRoom,
  leaveKitchenRoom,
  measureClock,
  rematchKitchenRoom,
  sendTap,
  startKitchenRoom,
  versionProblem,
  watchKitchenRoom,
  type KitchenRoom as Room,
  type KitchenRoomData,
} from '../../services/kitchen';
import { useGameStore } from '../../store';
import { draw, H, HUD, readPalette, TILE, W } from './render';

// Short Order's room: the lobby, then the kitchen. Each phone plays the same kitchen from
// the seed and every cook's taps, on the server's clock; a tap on a tile sends your chef
// there. A tap does nothing for ACTION_DELAY ticks, so one from another phone usually
// arrives in time; one that arrives later has the kitchen played again from the start
// with it in (a few milliseconds at most).

export function KitchenRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<KitchenRoomData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchKitchenRoom(code, uid, setData) : undefined), [code, uid]);
  useRoomHeartbeat('kitchens', code, !!uid && !!data.room?.playerIds.includes(uid));
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.playerIds.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/kitchen/${code}`);
    else if (data.room?.status === 'playing') rememberPage(`/kitchen/${code}`);
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
    <Page title={`Short Order · ${code}`} back="/kitchen" game="kitchen">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/kitchen">
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
      <Link className="button ghost" to="/kitchen">
        Back
      </Link>
    </div>
  );
}

function NotIn({ room }: { room: Room }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="button primary" onClick={() => void joinKitchenRoom(room.code).then(setError, (e) => setError(String(e)))}>
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
  const [kitchen, setKitchen] = useState(0);
  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <p className="group-title">Cooks · {room.playerIds.length} of {MAX_COOKS}</p>
          <ol className="group players">
            {room.playerIds.map((id) => (
              <li key={id} className="row">
                <span>{id === uid ? 'You' : room.names[id]}</span>
                {id === room.host && <span className="row-detail">Host</span>}
              </li>
            ))}
          </ol>
          {isHost ? (
            <>
              <p className="group-title">Kitchen</p>
              <div className="segmented" role="radiogroup" aria-label="Kitchen">
                {KITCHENS.map((k, i) => (
                  <button key={k.name} role="radio" aria-checked={kitchen === i} onClick={() => setKitchen(i)}>
                    {k.name}
                  </button>
                ))}
              </div>
              <p className="note section-note">{KITCHENS[kitchen].line}</p>
            </>
          ) : (
            <p className="note section-note">The host picks the kitchen.</p>
          )}
        </>
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {isHost ? (
            <button className="button primary" onClick={() => act(startKitchenRoom(room.code, kitchen))}>
              {room.playerIds.length === 1 ? 'Start on your own' : `Start with ${room.playerIds.length} cooks`}
            </button>
          ) : (
            <>
              <p className="note center-note">The host starts when everyone's in.</p>
              <button className="button ghost" onClick={() => act(leaveKitchenRoom(room))}>
                Leave the room
              </button>
            </>
          )}
        </>
      }
    />
  );
}

// ---------- The kitchen ----------

/** After the three minutes, how long a phone waits for late taps before marking the shift over. */
const SETTLE_MS = 1500;
/** Taps closer together than this are ignored: each is a write, and the quota is small. */
const TAP_GAP_MS = 150;

function holding(hand: Item | null): string {
  if (hand === null) return 'Tap a crate for something to cook, or a cooked pot once you have a plate.';
  if (isRaw(hand)) return `A ${INGREDIENT_NAMES[hand as Ingredient]}. Tap a board to chop it.`;
  if (isChopped(hand)) return `A chopped ${INGREDIENT_NAMES[hand.toUpperCase() as Ingredient]}. Tap a pot to drop it in.`;
  if (isSoup(hand)) return 'A plate of soup. Tap the hatch (the arrow) to serve it.';
  return 'A plate. Tap a cooked pot (green ring) to fill it.';
}

function Game({ room, moves, uid }: { room: Room; moves: KitchenRoomData['moves']; uid: string }) {
  const me = room.playerIds.indexOf(uid);
  const chefs = room.playerIds.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // How far the server's clock is ahead of this phone's; 0 until measured.
  const offset = useRef(0);
  // This shift's taps as the server has them, and this phone's own still on their way.
  const recorded = useMemo<Action[]>(
    () => moves.slice(room.from).map((m) => ({ seat: room.playerIds.indexOf(m.by), tick: m.move.t, x: m.move.x, y: m.move.y })),
    [moves, room.from, room.playerIds],
  );
  const [pending, setPending] = useState<Action[]>([]);
  const actions = useMemo(() => sortActions([...recorded, ...pending]), [recorded, pending]);
  const actionsRef = useRef(actions);
  const kitchen = useRef<KitchenState>(newGame(room.seed!, room.kitchen, chefs));
  const count = useRef(moves.length);
  count.current = moves.length;
  const lastTap = useRef(0);
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'over'>('waiting');
  const [hint, setHint] = useState(holding(null));
  const [error, setError] = useState<string | null>(null);

  const startMs = room.startedAt! + COUNTDOWN_MS;
  const serverNow = () => Date.now() + offset.current;
  const tickNow = () => Math.floor(((serverNow() - startMs) * TICKS_PER_SECOND) / 1000);

  // The server stamped `startedAt` before this phone could see it, so the server's clock is
  // at least that far on (see Pig Lasso); a measurement, retried until one works, sets it exactly.
  const seenAt = useRef(Date.now());
  const atLeast = room.startedAt! - seenAt.current;
  if (offset.current < atLeast) offset.current = atLeast;
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const measure = (tries: number) =>
      void measureClock(room.code).then((ms) => {
        if (!live) return;
        if (ms === null) {
          if (tries < 6) timer = setTimeout(() => measure(tries + 1), 2000);
          return;
        }
        offset.current = Math.max(ms, room.startedAt! - seenAt.current);
      });
    measure(1);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [room.code, room.startedAt]);

  // New taps (or one of ours that never got through): if any took effect before where the
  // kitchen is, play it again from the start.
  useEffect(() => {
    const before = actionsRef.current;
    actionsRef.current = actions;
    const at = kitchen.current.tick;
    const key = (a: Action) => `${a.seat}:${a.tick}`;
    const was = new Set(before.map(key));
    const now = new Set(actions.map(key));
    const changed = (list: Action[], other: Set<string>) => list.some((a) => !other.has(key(a)) && a.tick + ACTION_DELAY < at);
    if (!changed(actions, was) && !changed(before, now)) return;
    kitchen.current = newGame(room.seed!, room.kitchen, chefs);
    advance(kitchen.current, actions, at);
  }, [actions, room.seed, room.kitchen, chefs]);

  // The frame loop: catch the kitchen up to the server's clock and draw it.
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
      // The next frame is asked for first, so one bad frame can't stop the kitchen for good.
      frame = requestAnimationFrame(loop);
      const now = tickNow();
      setPhase(now < 0 ? 'waiting' : now < GAME_TICKS ? 'playing' : 'over');
      try {
        const k = kitchen.current;
        advance(k, actionsRef.current, Math.max(0, now));
        const countdown = now < 0 ? startMs - serverNow() : null;
        const taps = actionsRef.current.filter((a) => a.seat === me && a.tick + ACTION_DELAY >= k.tick).map((a): [number, number] => [a.x, a.y]);
        draw(ctx, k, palette, { me, countdown, taps });
        if (me >= 0 && me < k.chefs.length) setHint(holding(k.chefs[me].hand));
      } catch (e) {
        if (!reported) console.error('Short Order frame failed', e);
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

  // Once the three minutes are up and late taps have had a moment, any phone marks it over.
  useEffect(() => {
    if (phase !== 'over' || room.status !== 'playing') return;
    const wait = Math.max(0, startMs + (GAME_TICKS * 1000) / TICKS_PER_SECOND + SETTLE_MS - serverNow());
    let timer = setTimeout(function tryFinish() {
      void finishKitchenRoom(room.code).catch(() => {});
      timer = setTimeout(tryFinish, 3000);
    }, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, room.status, room.code]);

  const tap = (clientX: number, clientY: number) => {
    const tick = kitchen.current.tick;
    if (phase !== 'playing' || tick >= GAME_TICKS || me < 0) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const ux = (clientX - rect.left - (rect.width - W * scale) / 2) / scale;
    const uy = (clientY - rect.top - (rect.height - H * scale) / 2) / scale - HUD;
    const x = Math.floor(ux / TILE);
    const y = Math.floor(uy / TILE);
    if (uy < 0 || x < 0 || y < 0 || x >= 7 || y >= 9) return;
    const at = performance.now();
    if (at - lastTap.current < TAP_GAP_MS) return;
    lastTap.current = at;
    const action: Action = { seat: me, tick, x, y };
    setPending((p) => [...p, action]);
    setError(null);
    void sendTap(room.code, () => count.current, { t: tick, x, y }).catch(() => {
      setPending((p) => p.filter((a) => a !== action));
      setError('A tap didn’t reach the others. Check the connection.');
    });
  };

  const done = room.status === 'done';
  const final = useMemo(() => (done ? simulate(room.seed!, room.kitchen, chefs, recorded) : null), [done, room.seed, room.kitchen, chefs, recorded]);
  const [rematching, setRematching] = useState(false);
  const again = (next: number) => {
    setRematching(true);
    void rematchKitchenRoom(room, moves.length, next).catch(() => {
      setRematching(false);
      setError('Couldn’t start another shift. Check the connection and try again.');
    });
  };

  return (
    <>
      <div
        className="kitchen-field"
        ref={wrapRef}
        onPointerDown={(event) => {
          event.preventDefault();
          tap(event.clientX, event.clientY);
        }}
      >
        <canvas ref={canvasRef} className="kitchen-canvas" aria-label="The kitchen: tap a tile to send your chef there" />
        {phase === 'over' && !final && <p className="kitchen-banner">Time’s up! Counting…</p>}
        {final && (
          <Result state={final}>
            <button className="button primary" disabled={rematching} onClick={() => again(room.kitchen)}>
              {rematching ? 'Starting…' : 'Same kitchen again'}
            </button>
            <button className="button" disabled={rematching} onClick={() => again((room.kitchen + 1) % KITCHENS.length)}>
              Next: {KITCHENS[(room.kitchen + 1) % KITCHENS.length].name}
            </button>
            <Link className="button ghost" to="/kitchen">
              Leave the room
            </Link>
          </Result>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {!final && (
        <p className="note center-note kitchen-hint">{phase === 'waiting' ? `${KITCHENS[room.kitchen].name}: ${KITCHENS[room.kitchen].line}` : hint}</p>
      )}
    </>
  );
}

/** The shift's stars and points, over the kitchen, with what to do next under them. */
function Result({ state, children }: { state: KitchenState; children: ReactNode }) {
  const won = stars(state);
  const served = state.events.filter((e) => e.kind === 'served').length;
  const missed = state.events.filter((e) => e.kind === 'missed').length;
  const bar = KITCHENS[state.kitchen].stars[state.chefs.length - 1];
  return (
    <div className="kitchen-result">
      <p className="kitchen-stars" aria-label={`${won} of 3 stars`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < won ? 'on' : ''}>
            ★
          </span>
        ))}
      </p>
      <h2>{state.score} points</h2>
      <p>
        {served} served · {missed} missed
      </p>
      <p className="note">{won < 3 ? `${bar[won]} for the next star.` : 'A perfect shift!'}</p>
      <div className="kitchen-dock">{children}</div>
    </div>
  );
}
