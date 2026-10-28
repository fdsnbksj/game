import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { SummaryRow } from '../../components/SummaryRow';
import { MAX_SEATS, MIN_SEATS, mustTake, replay, runs, score, takeCost, type Move, type PassState } from '../../games/pass/state';
import { forgetRoom, rememberPage } from '../../lastPage';
import { reloadFresh } from '../../reload';
import { useRoomHeartbeat } from '../../services/lobbies';
import { finishGame, joinRoom, leaveRoom, rematch, sendMove, setSeats, startGame, versionProblem, watchRoom, type PassData, type PassRoom as Room } from '../../services/pass';
import { useGameStore } from '../../store';

// Pass or Pay's room: the lobby, then the table. The screen centres on the face-up card,
// its coins and your two buttons, with what taking it would do to your score; everyone's
// cards sit in one list under it, and the rules fold away.

export function PassRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<PassData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);
  // Says this phone is in the room, so it isn't cleared away as empty (src/services/lobbies.ts).
  useRoomHeartbeat('passes', code, !!uid && !!data.room?.seats.includes(uid));
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.seats.includes(uid));
  useEffect(() => {
    // A rematch puts the room back on home's Continue.
    if (ended) forgetRoom(`/pass/${code}`);
    else if (data.room?.status === 'playing') rememberPage(`/pass/${code}`);
  }, [ended, code, data.room?.status]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.seats.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status !== 'done' && versionProblem(room.version)) body = <OtherVersion text={versionProblem(room.version)!} />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  // Keyed by the seed: a rematch starts the table over.
  else body = <Game key={room.seed} room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Pass or Pay · ${code}`} back="/pass" game="pass">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/pass">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/">
        All games
      </Link>
    </div>
  );
}

/** The phones would play the same moves differently: reload and start over. */
function OtherVersion({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <button className="button primary" onClick={() => void reloadFresh()}>
        Reload the latest version
      </button>
      <Link className="button ghost" to="/pass">
        Back
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
              </li>
            ))}
          </ol>
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
              {n < MIN_SEATS ? 'Waiting for a friend to join…' : 'Start'}
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

/** Taps this soon after the table changes are ignored. */
const TAP_GUARD_MS = 450;
const coins = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

function Game({ room, moves, uid }: { room: Room; moves: PassData['moves']; uid: string }) {
  // This game's moves only: a rematch follows on from the last game's.
  const state = useMemo(() => replay(room.seed!, room.seats, moves.slice(room.from)), [room.seed, room.seats, room.from, moves]);
  const me = room.seats.indexOf(uid);
  const name = (seat: number) => (seat === me ? 'You' : room.names[room.seats[seat]]);
  const count = useRef(moves.length);
  count.current = moves.length;
  const [error, setError] = useState<string | null>(null);
  // The move count this phone sent a move at: the buttons wait until it's in, so a double tap can't send two.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const sending = sentAt !== null && sentAt === state.count;

  // A tap just after the table changed is a late tap meant for the last view (a thumb still down
  // on Take when the next card turns up): ignore it, so no card is taken unseen.
  const changedAt = useRef(0);
  useEffect(() => {
    changedAt.current = performance.now();
  }, [state.count]);

  const play = (move: Move) => {
    if (performance.now() - changedAt.current < TAP_GUARD_MS) return;
    setError(null);
    setSentAt(state.count);
    void sendMove(room.code, () => count.current, move).catch((e) => {
      setSentAt(null);
      setError(e instanceof Error ? e.message : String(e));
    });
  };

  // Over on every phone at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.winners !== null && room.status === 'playing') void finishGame(room.code).catch(() => {});
  }, [state.winners, room.status, room.code]);

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

  if (state.winners !== null) {
    const ranked = state.players.map((p, i) => ({ i, p, total: score(p) })).sort((a, b) => a.total - b.total || a.i - b.i);
    const winners = state.winners.map(name);
    const won = state.winners.includes(me);
    return (
      <>
        <div className="pass-result">
          <p className="micro">Lowest score wins</p>
          <strong>{won ? (winners.length > 1 ? 'You share the win!' : 'You win!') : winners.length > 1 ? `${winners.join(' and ')} share the win` : `${winners[0]} wins`}</strong>
        </div>
        <ol className="group pass-scores">
          {ranked.map(({ i, p, total }) => (
            <li key={i} className={i === me ? 'pass-score me' : 'pass-score'}>
              <span className="pass-score-name">
                <strong>{name(i)}</strong>
                <Runs cards={p.cards} />
              </span>
              <span className="pass-score-figures">
                <strong>{total}</strong>
                <small>{coins(p.coins)} kept</small>
              </span>
            </li>
          ))}
        </ol>
        {error && <p className="error">{error}</p>}
        <button className="button primary" disabled={rematching} onClick={again}>
          {rematching ? 'Starting…' : 'Rematch'}
        </button>
        <Link className="button ghost" to="/pass">
          Leave the room
        </Link>
      </>
    );
  }

  const mine = me === state.turn;
  const you = state.players[me];
  const cost = takeCost(you, state.card!, state.pot);
  const forced = mine && mustTake(state);

  let line: string;
  if (mine) line = forced ? 'No coins left: you must take it.' : 'Your move: pay a coin, or take it.';
  else line = `${name(state.turn)}'s move.`;

  return (
    <>
      <div className={mine ? 'pass-table yours' : 'pass-table'}>
        <span className="pass-card big">{state.card}</span>
        <div className="pass-table-text">
          <span className="pass-pot">
            <Coin />
            {state.pot ? `${coins(state.pot)} on it` : 'No coins on it'}
          </span>
          <span className="pass-left">{state.deck.length ? `${state.deck.length} more to come` : 'The last card'}</span>
        </div>
      </div>

      <p className="pass-last">{state.last ? lastLine(state, name) : `${name(state.turn)} ${state.turn === me ? 'go' : 'goes'} first.`}</p>

      <Players state={state} name={name} me={me} />

      <div className="pass-me">
        <span>
          <Coin /> <strong>{coins(you.coins)}</strong>
        </span>
        <span>
          Score <strong>{score(you)}</strong>
        </span>
        <span className="pass-cost">Taking it: {signed(cost)}</span>
      </div>

      <div className="pass-dock">
        <p className={mine ? 'pass-line yours' : 'pass-line'}>{line}</p>
        {error && <p className="error">{error}</p>}
        <div className="pass-actions">
        <button className="button" disabled={!mine || forced || sending} onClick={() => play({ type: 'pay' })}>
          Pay a coin
        </button>
        <button className="button primary" disabled={!mine || sending} onClick={() => play({ type: 'take' })}>
          {state.pot ? `Take it (+${coins(state.pot)})` : 'Take it'}
        </button>
        </div>
      </div>

      <SummaryRow label="How to play" title="How to play">
        <div className="how-to">
          <p>Pay a coin onto the card to pass it on, or take it with its coins and turn up the next. No coins: you must take.</p>
          <p>At the end your cards add up, but a run in a row counts only its lowest. Every coin kept takes one off. Lowest wins.</p>
        </div>
      </SummaryRow>
    </>
  );
}

function lastLine(state: PassState, name: (s: number) => string): string {
  const last = state.last!;
  const who = name(last.by);
  if (last.type === 'pay') return `${who} paid a coin to pass ${last.card}.`;
  return `${who} took ${last.card}${last.pot ? ` and ${coins(last.pot)}` : ''}.`;
}

/** Everyone round the table: their cards in runs, whose move. Coins stay hidden, as at a real table. */
function Players({ state, name, me }: { state: PassState; name: (s: number) => string; me: number }) {
  return (
    <ul className="group pass-players">
      {state.players.map((p, i) => (
        <li key={i} className={['pass-player', i === state.turn ? 'turn' : '', i === me ? 'me' : ''].join(' ')}>
          <strong>{name(i)}</strong>
          {p.cards.length ? <Runs cards={p.cards} /> : <span className="note">No cards yet</span>}
        </li>
      ))}
    </ul>
  );
}

/** Cards in runs: only a run's lowest counts, so the rest are drawn faint. */
function Runs({ cards }: { cards: number[] }) {
  return (
    <span className="pass-runs">
      {runs(cards).map((run) => (
        <span key={run[0]} className="pass-run">
          {run.map((c, k) => (
            <span key={c} className={k === 0 ? 'pass-card' : 'pass-card free'}>
              {c}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

const Coin = () => <span className="pass-coin" aria-hidden="true" />;
