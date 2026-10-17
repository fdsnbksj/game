import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { SummaryRow } from '../../components/SummaryRow';
import { botMove } from '../../games/bluff/bot';
import { CHAMBERS, claim, MAX_PLAY, MIN_SEATS, mustCall, RANK_NAMES, replay, type BluffState, type Card, type Move, type Showdown } from '../../games/bluff/state';
import { forgetRoom, rememberPage } from '../../lastPage';
import { addBot, finishGame, isBot, joinRoom, leaveRoom, MAX_SEATS, rematch, sendMove, setSeats, startGame, watchRoom, type BluffData, type BluffRoom as Room } from '../../services/bluff';
import { useGameStore } from '../../store';
import { useLobbyHeartbeat } from '../../services/lobbies';

// Bluff Table's room: the lobby, then the table. The screen centres on your move: the
// table card, the last claim, your hand and two buttons. Other players sit in one row of
// chips; what happened folds away. A call plays out over the table (the cards turn over,
// then the trigger) for everyone who sees it happen.

/** How long the host's phone waits before a bot moves, so people can follow. */
const BOT_MS = 1100;
/** How long a call and its shot take to show. */
const SHOW_MS = 4000;

export function BluffRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<BluffData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);
  // Says this phone is in the lobby, so the room stays listed (src/services/lobbies.ts).
  useLobbyHeartbeat('bluffs', code, !!uid && data.room?.status === 'lobby' && data.room.seats.includes(uid));
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.seats.includes(uid));
  useEffect(() => {
    // A rematch puts the room back on home's Continue.
    if (ended) forgetRoom(`/bluff/${code}`);
    else if (data.room?.status === 'playing') rememberPage(`/bluff/${code}`);
  }, [ended, code, data.room?.status]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.seats.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  // Keyed by the seed: a rematch starts the table over.
  else body = <Game key={room.seed} room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Bluff Table · ${code}`} back="/bluff" game="bluff">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/bluff">
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

// ---------- Lobby ----------

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
            {room.seats.map((seat) => (
              <li key={seat} className="row">
                <span>{label(seat)}</span>
                {seat === room.host && <span className="row-detail">Host</span>}
                {isBot(seat) && <span className="row-detail">Bot</span>}
                {isHost && isBot(seat) && (
                  <button className="icon-button small" aria-label="Remove this bot" onClick={() => act(setSeats(room, room.seats.filter((s) => s !== seat)))}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
          {isHost && n < MAX_SEATS && (
            <button className="button" onClick={() => act(addBot(room))}>
              Add a bot
            </button>
          )}
        </>
      }
      options={
        isHost &&
        n > 2 && (
          <>
            <p className="group-title">Seating</p>
            <p className="note section-note">Play passes down this list, like round a table.</p>
            <ol className="group players">
              {room.seats.map((seat, i) => (
                <li key={seat} className="row">
                  <span>
                    {i + 1}. {label(seat)}
                  </span>
                  <span className="seat-moves">
                    <button className="icon-button small" aria-label="Move up a seat" onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button className="icon-button small" aria-label="Move down a seat" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {isHost ? (
            <button className="button primary" disabled={n < MIN_SEATS} onClick={() => act(startGame(room.code))}>
              {n < MIN_SEATS ? 'Need one more: add a bot?' : 'Start'}
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

// ---------- The table ----------

function Game({ room, moves, uid }: { room: Room; moves: BluffData['moves']; uid: string }) {
  // This game's moves only: a rematch follows on from the last game's.
  const state = useMemo(() => replay(room.seed!, room.seats, moves.slice(room.from)), [room.seed, room.seats, room.from, moves]);
  const me = room.seats.indexOf(uid);
  const name = (seat: number) => (seat === me ? 'You' : room.names[room.seats[seat]]);
  const count = useRef(moves.length);
  count.current = moves.length;
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  // A move from anyone clears your half-made pick.
  useEffect(() => setPicked([]), [state.count]);

  // A call that arrives while you watch plays out over the table; one already made when
  // the page opened doesn't.
  const seen = useRef(state.showdowns.length);
  const [show, setShow] = useState<Showdown | null>(null);
  useEffect(() => {
    if (state.showdowns.length <= seen.current) return;
    seen.current = state.showdowns.length;
    setShow(state.showdowns.at(-1)!);
  }, [state.showdowns]);
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [show]);

  const play = (move: Move, by?: string) => {
    setError(null);
    setSending(true);
    void sendMove(room.code, () => count.current, move, by)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSending(false));
  };

  // The host's phone plays the bots, a beat after each move (longer after a call).
  const isHost = room.host === uid;
  const sentFor = useRef(new Set<number>());
  useEffect(() => {
    if (!isHost || state.winner !== null) return;
    const id = room.seats[state.turn];
    if (!isBot(id) || sentFor.current.has(state.count)) return;
    const key = state.count;
    const move = botMove(state, state.turn);
    if (!move) return;
    const wait = state.last === null && state.showdowns.length > 0 ? SHOW_MS + 400 : BOT_MS;
    const timer = setTimeout(() => {
      sentFor.current.add(key);
      void sendMove(room.code, () => count.current, move, id).catch(() => sentFor.current.delete(key));
    }, wait);
    return () => clearTimeout(timer);
    // Keyed on the move count, not the state: a refresh with nothing new mustn't restart the wait.
  }, [isHost, state.count, state.winner, room.code, room.seats]);

  // Over on every phone at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.winner !== null && room.status === 'playing') void finishGame(room.code).catch(() => {});
  }, [state.winner, room.status, room.code]);

  // Another game with the same seats; whichever phone asks first starts it for everyone.
  const [rematching, setRematching] = useState(false);
  const again = () => {
    setRematching(true);
    setError(null);
    void rematch(room.code, moves.length).catch(() => {
      setRematching(false);
      setError('Couldn’t start a rematch. Check the connection and try again.');
    });
  };

  const mine = me === state.turn && state.winner === null;
  const hand = me >= 0 ? state.players[me].hand : [];
  const forced = mine && mustCall(state);
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((k) => k !== i) : p.length < MAX_PLAY ? [...p, i] : p));

  if (state.winner !== null) {
    return (
      <>
        <div className="bluff-result">
          <p className="micro">Last one standing</p>
          <strong>{state.winner === me ? 'You win!' : `${name(state.winner)} wins`}</strong>
        </div>
        <Seats state={state} name={name} me={me} />
        {show && <ShowdownView show={show} name={name} onClose={() => setShow(null)} />}
        <History state={state} name={name} />
        {error && <p className="error">{error}</p>}
        <button className="button primary" disabled={rematching} onClick={again}>
          {rematching ? 'Starting…' : 'Rematch'}
        </button>
        <Link className="button ghost" to="/bluff">
          Leave the room
        </Link>
      </>
    );
  }

  let line: string;
  if (mine) line = forced ? `${claim(state.last!.cards.length, state.table)}, ${name(state.last!.by)} says, and no one else has cards: you must call.` : state.last ? 'Your move: play cards, or call the liar.' : 'You lead: play one to three cards.';
  else line = `${name(state.turn)}'s move.`;

  return (
    <>
      <div className={mine ? 'bluff-table yours' : 'bluff-table'}>
        <PlayingCard card={state.table} />
        <div className="bluff-table-text">
          <span className="micro">Round {state.round + 1} · table card</span>
          <strong>{RANK_NAMES[state.table].many[0].toUpperCase() + RANK_NAMES[state.table].many.slice(1)}</strong>
          <span className="bluff-pile">{state.pile ? `${state.pile} down this round` : 'Nothing down yet'}</span>
        </div>
      </div>

      <Seats state={state} name={name} me={me} />

      <div className="bluff-claim">
        {state.last ? (
          <>
            <span className="bluff-backs" aria-hidden="true">
              {state.last.cards.map((_, i) => (
                <PlayingCard key={i} />
              ))}
            </span>
            <span>
              <strong>{name(state.last.by)}</strong>: “{claim(state.last.cards.length, state.table)}.”
            </span>
          </>
        ) : (
          <span className="note">No claim yet this round.</span>
        )}
      </div>

      <p className={mine ? 'bluff-line yours' : 'bluff-line'}>{line}</p>

      {me >= 0 && state.players[me].alive ? (
        <>
          <div className="bluff-hand" role="group" aria-label="Your hand">
            {hand.map((card, i) => (
              <button key={i} className={picked.includes(i) ? 'bluff-pick picked' : 'bluff-pick'} disabled={!mine || forced} aria-pressed={picked.includes(i)} onClick={() => toggle(i)}>
                <PlayingCard card={card} />
              </button>
            ))}
            {hand.length === 0 && <p className="note">No cards left this round.</p>}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="bluff-actions">
            <button className="button primary" disabled={!mine || forced || picked.length === 0 || sending} onClick={() => play({ type: 'play', cards: picked })}>
              {picked.length ? `Play: “${claim(picked.length, state.table)}”` : 'Pick 1–3 cards'}
            </button>
            <button className="button danger" disabled={!mine || !state.last || sending} onClick={() => play({ type: 'call' })}>
              Liar!
            </button>
          </div>
        </>
      ) : (
        <p className="note center-note">You're out. Watch the rest play out.</p>
      )}

      <History state={state} name={name} />
      <SummaryRow label="How to play" title="How to play">
        <div className="how-to">
          <p>Put 1–3 cards face down and claim they're all the table card; jokers count as it. Or call the last player a liar.</p>
          <p>On a call their cards turn over. Any wrong card: they pull the trigger. All true: you do. One bullet in six chambers, so each pull is riskier. Then a new round.</p>
        </div>
      </SummaryRow>

      {show && <ShowdownView show={show} name={name} onClose={() => setShow(null)} />}
    </>
  );
}

/** Everyone in one row: cards in hand, trigger pulls, out or in, whose move. */
function Seats({ state, name, me }: { state: BluffState; name: (s: number) => string; me: number }) {
  return (
    <ul className="bluff-seats">
      {state.players.map((p, i) => (
        <li key={i} className={['bluff-seat', i === state.turn && state.winner === null ? 'turn' : '', p.alive ? '' : 'out', i === me ? 'me' : ''].join(' ')}>
          <strong>{name(i)}</strong>
          {p.alive ? (
            <span className="bluff-seat-info">
              <span className="bluff-count" aria-label={`${p.hand.length} cards`}>
                <span className="bluff-mini" aria-hidden="true" />
                {p.hand.length}
              </span>
              <Revolver pulls={p.pulls} />
            </span>
          ) : (
            <span className="bluff-seat-info">Out</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Six chambers round a hub; the ones already tried are filled. */
function Revolver({ pulls, fired }: { pulls: number; fired?: boolean }) {
  return (
    <svg className="bluff-revolver" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label={`${pulls} of ${CHAMBERS} pulled`}>
      <circle cx="12" cy="12" r="11" className="bluff-cylinder" />
      {[
        [12, 5],
        [18.1, 8.5],
        [18.1, 15.5],
        [12, 19],
        [5.9, 15.5],
        [5.9, 8.5],
      ].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r="2.6" className={k < pulls ? (fired && k === pulls - 1 ? 'bluff-chamber fired' : 'bluff-chamber tried') : 'bluff-chamber'} />
      ))}
    </svg>
  );
}

const FACE: Record<Card, string> = { K: 'K', Q: 'Q', A: 'A', J: '★' };

/** A card face (rank, or a star for a joker), or its back when no card is given. */
function PlayingCard({ card, flip }: { card?: Card; flip?: number }) {
  if (!card) return <span className="bluff-card back" aria-hidden="true" />;
  return (
    <span className={card === 'J' ? 'bluff-card joker' : 'bluff-card'} style={flip !== undefined ? { animationDelay: `${flip}ms` } : undefined} aria-label={card === 'J' ? 'Joker' : RANK_NAMES[card].one}>
      {FACE[card]}
    </span>
  );
}

/** A call, over the table: the cards turn over, then the trigger. */
function ShowdownView({ show, name, onClose }: { show: Showdown; name: (s: number) => string; onClose: () => void }) {
  const said = name(show.caller) === 'You' ? 'You call' : `${name(show.caller)} calls`;
  const shooter = name(show.shooter);
  return (
    <div className={show.died ? 'bluff-show bang' : 'bluff-show'} onClick={onClose} role="dialog" aria-label="The call">
      <div className="bluff-show-card">
        <p className="bluff-show-title">{said} “Liar!”</p>
        <p className="note">
          {name(show.accused)} said {claim(show.cards.length, show.table).toLowerCase()}:
        </p>
        <div className="bluff-show-cards">
          {show.cards.map((c, i) => (
            <span key={i} className={c === show.table || c === 'J' ? 'bluff-flip true' : 'bluff-flip false'}>
              <PlayingCard card={c} flip={i * 180} />
            </span>
          ))}
        </div>
        <p className={show.lied ? 'bluff-verdict lie' : 'bluff-verdict truth'}>{show.lied ? 'A lie!' : 'All true!'}</p>
        <div className="bluff-trigger">
          <Gun fired={show.died} />
          <p>
            <Revolver pulls={show.pull} fired={show.died} />
            {shooter === 'You' ? 'You pull' : `${shooter} pulls`} the trigger…{' '}
            <strong className={show.died ? 'bluff-bang' : 'bluff-click'}>{show.died ? `Bang. ${shooter === 'You' ? "You're" : `${shooter} is`} out.` : `Click. (${show.pull} of ${CHAMBERS})`}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

const FLUTES = Array.from({ length: 14 }, (_, k) => 6 + k * 8);

/**
 * The revolver, side on, for a call's shot: the cylinder spins, the hammer cocks, the
 * trigger goes back and the hammer falls: a muzzle flash and a kick on a bang, a twitch
 * on a click. All CSS, timed after the cards turn over.
 */
function Gun({ fired }: { fired: boolean }) {
  return (
    <svg className={fired ? 'bluff-gun bang' : 'bluff-gun click'} viewBox="0 0 150 80" aria-hidden="true">
      <defs>
        <clipPath id="bluff-cylinder-clip">
          <rect x="36" y="13" width="22" height="26" rx="4" />
        </clipPath>
      </defs>
      <g className="bluff-gun-body">
        <g className="bluff-gun-flash">
          <polygon points="132,25 146,15 141,25 150,29 140,30 145,40 133,31" className="bluff-flash-outer" />
          <circle cx="135" cy="27" r="5" className="bluff-flash-core" />
        </g>
        <path className="bluff-gun-hammer" d="M30 19 L21 8 Q22 5 26 6 L35 16 Z" />
        <path className="bluff-gun-grip" d="M28 34 H46 L39 70 Q37 76 30 74 L19 71 Q14 69 16 63 Z" />
        <path className="bluff-gun-guard" d="M42 38 Q40 52 52 51 Q57 50 57 38" />
        <path className="bluff-gun-trigger" d="M49 37 Q48 43 51 47" />
        <path className="bluff-gun-frame" d="M28 15 H62 V37 H28 Z" />
        <rect className="bluff-gun-barrel" x="58" y="19" width="74" height="11" rx="2" />
        <rect className="bluff-gun-rib" x="58" y="17" width="74" height="3" rx="1" />
        <rect className="bluff-gun-rib" x="125" y="13" width="4" height="5" />
        <rect className="bluff-gun-cylinder" x="36" y="13" width="22" height="26" rx="4" />
        <g clipPath="url(#bluff-cylinder-clip)">
          <g className="bluff-gun-flutes">
            {FLUTES.map((y) => (
              <rect key={y} x="38" y={y} width="18" height="3" rx="1.5" />
            ))}
          </g>
        </g>
      </g>
      <g className="bluff-gun-smoke">
        <circle cx="140" cy="22" r="6" />
        <circle cx="148" cy="16" r="4" />
      </g>
    </svg>
  );
}

/** Every call so far, newest first, folded away. */
function History({ state, name }: { state: BluffState; name: (s: number) => string }) {
  if (state.showdowns.length === 0) return null;
  return (
    <SummaryRow label="Calls so far" figures={<span className="row-detail">{state.showdowns.length}</span>} title="Calls so far">
      <ol className="group bluff-history">
        {[...state.showdowns].reverse().map((s, i) => (
          <li key={i} className="row">
            <span>
              Round {s.round + 1}: {name(s.caller)} called {name(s.accused)} ({claim(s.cards.length, s.table).toLowerCase()}): {s.lied ? 'a lie' : 'true'}. {name(s.shooter)} pulled: {s.died ? 'bang, out' : `click (${s.pull}/${CHAMBERS})`}.
            </span>
          </li>
        ))}
      </ol>
    </SummaryRow>
  );
}
