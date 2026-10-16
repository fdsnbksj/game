import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { Sheet } from '../../components/Sheet';
import { SummaryRow } from '../../components/SummaryRow';
import { botMove } from '../../games/wonders/bot';
import { cardOf } from '../../games/wonders/cards';
import { cardText } from '../../games/wonders/describe';
import { baseId, type SideChoice } from '../../games/wonders/setup';
import { leftOf, replay, reviveOptions, rightOf, shieldsOf, waitingFor, type Move, type Score, type WondersState } from '../../games/wonders/state';
import { addBot, finishGame, isBot, joinRoom, leaveRoom, sendMove, setup, startGame, watchRoom, type WondersData, type WondersRoom as Room } from '../../services/wonders';
import { forgetRoom } from '../../lastPage';
import { useGameStore } from '../../store';
import { CardViewer, Hand } from './CardViewer';
import { Table, WonderBoard } from './Table';

export function WondersRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<WondersData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);
  // Home offers this room until its game is over, or it's gone, or you're not in it.
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.seats.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/wonders/${code}`);
  }, [ended, code]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.seats.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  else body = <Game room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Ancient Wonders · ${code}`} back="/wonders" game="wonders">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/wonders">
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
    act(setup(room, { seats }));
  };
  const sides: [SideChoice, string][] = [
    ['A', 'Side A'],
    ['B', 'Side B'],
    ['random', 'Mixed'],
  ];
  const label = (seat: string) => (seat === uid ? 'You' : room.names[seat]);

  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <p className="group-title">Players · {n} of 7</p>
          <ol className="group players">
            {room.seats.map((seat) => (
              <li key={seat} className="row">
                <span>{label(seat)}</span>
                {seat === room.host && <span className="row-detail">Host</span>}
                {isBot(seat) && <span className="row-detail">Bot</span>}
                {isHost && isBot(seat) && (
                  <button className="icon-button small" aria-label="Remove this bot" onClick={() => act(setup(room, { seats: room.seats.filter((s) => s !== seat) }))}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
          {isHost && n < 7 && (
            <button className="button" onClick={() => act(addBot(room))}>
              Add a bot
            </button>
          )}
        </>
      }
      options={
        isHost && (
          <>
            <p className="group-title">Wonder boards</p>
            <div className="segmented" role="radiogroup" aria-label="Wonder board sides">
              {sides.map(([value, text]) => (
                <button key={value} role="radio" aria-checked={room.sides === value} onClick={() => act(setup(room, { sides: value }))}>
                  {text}
                </button>
              ))}
            </div>
            <p className="note section-note">Side B wonders are trickier. Mixed gives each city a random side.</p>
            <p className="group-title">Seating, clockwise</p>
            <p className="note section-note">Match how people sit: your left neighbour is the next seat.</p>
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
            <button className="button primary" disabled={n < 3} onClick={() => act(startGame(room.code))}>
              {n < 3 ? `Need ${3 - n} more: add a bot?` : 'Start'}
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

// ---------- The game ----------

function Game({ room, moves, uid }: { room: Room; moves: WondersData['moves']; uid: string }) {
  const state = useMemo(() => replay(room.seed!, room.seats, room.sides, moves), [room.seed, room.seats, room.sides, moves]);
  const me = room.seats.indexOf(uid);
  const name = (seat: number) => (seat === me ? 'You' : room.names[room.seats[seat]]);
  const waiting = waitingFor(state);
  const count = useRef(moves.length);
  count.current = moves.length;
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [neighbour, setNeighbour] = useState<number | null>(null);
  const [everyone, setEveryone] = useState(false);

  const play = (move: Move, by?: string) => {
    setError(null);
    setViewing(null);
    void sendMove(room.code, () => count.current, move, by).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  // The host's phone plays the bots, once per turn each.
  const sentFor = useRef(new Set<string>());
  const isHost = room.host === uid;
  useEffect(() => {
    if (!isHost || state.phase === 'over') return;
    for (const seat of waiting) {
      const id = room.seats[seat];
      if (!isBot(id)) continue;
      const turnKey = `${seat}:${state.age}:${state.turn}:${state.reviving.join(',')}`;
      if (sentFor.current.has(turnKey)) continue;
      sentFor.current.add(turnKey);
      const move = botMove(state, seat);
      // If the write fails, forget it so the next render tries again.
      if (move) void sendMove(room.code, () => count.current, move, id).catch(() => sentFor.current.delete(turnKey));
    }
  }, [isHost, state, waiting, room]);

  // Over on every phone at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.phase === 'over' && room.status === 'playing') void finishGame(room.code).catch(() => {});
  }, [state.phase, room.status, room.code]);

  const mine = waiting.includes(me);
  const reviving = state.reviving[0] === me;
  const turns = state.turn === 7 ? 'last card' : `turn ${state.turn} of 6`;
  const pass = state.age === 2 ? '→' : '←';
  const picked = me >= 0 ? state.picks[me] : null;
  const others = waiting.filter((seat) => seat !== me).map(name);
  const left = leftOf(state, me);
  const city = state.cities[me];

  return (
    <>
      {state.phase === 'over' ? (
        <Outcome state={state} name={name} />
      ) : (
        <>
          <div className="duel-status with-info">
            <div className="status-text">
              <strong className={mine && !picked ? 'yours' : undefined}>
                {reviving ? 'Choose from the discards' : picked ? `You picked ${cardOf(baseId(picked.card)).name}` : mine ? 'Pick a card' : 'Waiting…'}
              </strong>
              <span className="note">
                {picked || !mine ? (others.length ? `Waiting for ${others.join(', ')}` : 'Revealing…') : `Age ${['I', 'II', 'III'][state.age - 1]}, ${turns} · hands pass ${pass}`}
              </span>
            </div>
            <button className="info-button" aria-label="Every player's details" onClick={() => setEveryone(true)}>
              i
            </button>
          </div>

          {me >= 0 && <Table state={state} me={me} name={name} onNeighbour={setNeighbour} />}

          {picked ? (
            <p className="note center-note">
              {picked.as === 'discard' ? 'Discarding it for 3 coins' : picked.as === 'wonder' ? 'Building a wonder stage with it' : 'Building it'}. Everyone's picks show when the last one is in.
            </p>
          ) : (
            me >= 0 && <Hand state={state} me={me} onOpen={setViewing} />
          )}
          {error && <p className="error">{error}</p>}
        </>
      )}

      {state.phase === 'over' && me >= 0 && <Table state={state} me={me} name={name} onNeighbour={setNeighbour} />}
      {state.phase === 'over' && (
        <button className="button" onClick={() => setEveryone(true)}>
          Every player's city
        </button>
      )}
      <LastTurn state={state} name={name} />

      {viewing !== null && me >= 0 && !picked && !reviving && <CardViewer state={state} me={me} start={viewing} canPick={mine} name={name} onMove={play} onClose={() => setViewing(null)} />}
      {neighbour !== null && (
        <Sheet title={neighbour === left ? 'Your left neighbour' : 'Your right neighbour'} onClose={() => setNeighbour(null)}>
          <p className="note">You trade with and fight only your two neighbours. Your shields: {shieldsOf(city)}.</p>
          <WonderBoard state={state} seat={neighbour} title={name(neighbour)} />
          <button className="button" onClick={() => setNeighbour(null)}>
            Close
          </button>
        </Sheet>
      )}
      {everyone && (
        <Sheet title="Every player" onClose={() => setEveryone(false)}>
          <p className="note">Round the table from you, clockwise: your left neighbour comes next, your right neighbour last.</p>
          {state.cities.map((_, k) => {
            const seat = me >= 0 ? (me + k) % state.n : k;
            const label = seat === me ? undefined : seat === left ? 'Left' : seat === rightOf(state, me) ? 'Right' : undefined;
            return <WonderBoard key={seat} state={state} seat={seat} title={label ? `${label}: ${name(seat)}` : name(seat)} />;
          })}
          <button className="button" onClick={() => setEveryone(false)}>
            Close
          </button>
        </Sheet>
      )}
      {reviving && <ReviveSheet state={state} me={me} onMove={play} />}
    </>
  );
}

/** Last turn in a line; the full picks and the battles open on tap. */
function LastTurn({ state, name }: { state: WondersState; name: (s: number) => string }) {
  if (!state.last) return null;
  const lines = state.last.picks.flatMap((p, seat) =>
    p ? [`${name(seat)} ${p.as === 'discard' ? 'discarded a card' : p.as === 'wonder' ? 'built a wonder stage' : `built ${cardOf(baseId(p.card)).name}`}`] : [],
  );
  const military = state.last.military;
  return (
    <SummaryRow label={military ? 'Last turn · battles' : 'Last turn'} title="Last turn">
      <ul className="group players">
        {lines.map((line) => (
          <li key={line} className="row">
            {line}
          </li>
        ))}
      </ul>
      {military && (
        <>
          <p className="group-title">Battles at the end of the age</p>
          <ul className="group players">
            {military.map((m) => (
              <li key={m.seat} className="row">
                <span>{name(m.seat)}</span>
                <span className="row-detail">
                  {m.vsLeft > 0 && m.vsRight > 0 ? 'won both' : m.vsLeft < 0 && m.vsRight < 0 ? 'lost both' : m.vsLeft + m.vsRight > 0 ? 'won one' : m.vsLeft + m.vsRight < 0 ? 'lost one' : 'held'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SummaryRow>
  );
}

function ReviveSheet({ state, me, onMove }: { state: WondersState; me: number; onMove: (m: Move) => void }) {
  const options = reviveOptions(state, me);
  return (
    <Sheet>
      <h3 className="sheet-title">Your wonder lets you build a discarded card for free</h3>
      {options.map((card) => {
        const c = cardOf(baseId(card));
        return (
          <button key={card} className="button choice-row" onClick={() => onMove({ type: 'revive', card })}>
            <strong>{c.name}</strong>
            <small>{cardText(c).join(' ')}</small>
          </button>
        );
      })}
      <button className="button ghost" onClick={() => onMove({ type: 'revive', card: null })}>
        None of these
      </button>
    </Sheet>
  );
}

function Outcome({ state, name }: { state: WondersState; name: (s: number) => string }) {
  const { scores, winners } = state.outcome!;
  const rows: [string, keyof Score][] = [
    ['Military', 'military'],
    ['Coins', 'coins'],
    ['Wonder', 'wonder'],
    ['Civic', 'blue'],
    ['Commercial', 'yellow'],
    ['Guilds', 'purple'],
    ['Science', 'green'],
    ['Total', 'total'],
  ];
  return (
    <div className="group card-pad phase">
      <p className="winner good">{winners.length > 1 ? `${winners.map(name).join(' and ')} share the win` : name(winners[0]) === 'You' ? 'You win' : `${name(winners[0])} wins`}</p>
      <div className="scores-wrap">
        <table className="scores">
          <thead>
            <tr>
              <th />
              {scores.map((_, seat) => (
                <th key={seat}>{name(seat)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key} className={key === 'total' ? 'total' : undefined}>
                <td>{label}</td>
                {scores.map((s, seat) => (
                  <td key={seat}>{s[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link className="button" to="/wonders">
        New game
      </Link>
    </div>
  );
}
