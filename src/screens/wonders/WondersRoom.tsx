import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { botMove } from '../../games/wonders/bot';
import { boardOf, cardOf, RESOURCES, type Color } from '../../games/wonders/cards';
import { cardText, COLOR_NAMES, costText, RES_NAMES, shortEffect, stageText } from '../../games/wonders/describe';
import { baseId, type SideChoice } from '../../games/wonders/setup';
import {
  buildCost,
  canBuildFree,
  leftOf,
  ownSupply,
  replay,
  reviveOptions,
  rightOf,
  score,
  shieldsOf,
  stageCost,
  stagesOf,
  waitingFor,
  type Move,
  type Score,
  type WondersState,
} from '../../games/wonders/state';
import { addBot, finishGame, isBot, joinRoom, leaveRoom, sendMove, setup, startGame, watchRoom, type WondersData, type WondersRoom as Room } from '../../services/wonders';
import { useGameStore } from '../../store';

export function WondersRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<WondersData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.seats.includes(uid)) body = room.status === 'lobby' ? <NotIn room={room} /> : <Gone text="This game is already under way." />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  else body = <Game room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Ancient Wonders · ${code}`} back="/wonders">
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

  return (
    <>
      <div className="room-code">
        <span className="micro">Room code</span>
        <strong>{room.code}</strong>
        <span className="note">Everyone joins on their own phone: Ancient Wonders → Join a room.</span>
      </div>

      <p className="group-title">Seats · {n} of 7, clockwise</p>
      {isHost && <p className="note section-note">Seat everyone as they sit: your left neighbour is the next seat down.</p>}
      <ol className="group players">
        {room.seats.map((seat, i) => (
          <li key={seat} className="row">
            <span>
              {i + 1}. {seat === uid ? 'You' : room.names[seat]}
            </span>
            {seat === room.host && <span className="row-detail">Host</span>}
            {isBot(seat) && <span className="row-detail">Bot</span>}
            {isHost && (
              <span className="seat-moves">
                {n > 1 && (
                  <>
                    <button className="icon-button small" aria-label="Move up a seat" onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button className="icon-button small" aria-label="Move down a seat" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </>
                )}
                {isBot(seat) && (
                  <button className="icon-button small" aria-label="Remove this bot" onClick={() => act(setup(room, { seats: room.seats.filter((s) => s !== seat) }))}>
                    ✕
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
      {isHost && n < 7 && (
        <button className="button" onClick={() => act(addBot(room))}>
          Add a bot
        </button>
      )}

      <p className="group-title">Wonder boards</p>
      {isHost ? (
        <div className="segmented" role="radiogroup" aria-label="Wonder board sides">
          {sides.map(([value, label]) => (
            <button key={value} role="radio" aria-checked={room.sides === value} onClick={() => act(setup(room, { sides: value }))}>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="note">{sides.find(([v]) => v === room.sides)?.[1]}</p>
      )}
      <p className="note section-note">Side B boards have trickier wonders. Mixed gives each city a random side.</p>

      {error && <p className="error">{error}</p>}
      {isHost ? (
        <button className="button primary" disabled={n < 3} onClick={() => act(startGame(room.code))}>
          {n < 3 ? `Need ${3 - n} more (add bots?)` : 'Start'}
        </button>
      ) : (
        <>
          <p className="note">The host starts when everyone is in.</p>
          <button className="button ghost" onClick={() => act(leaveRoom(room))}>
            Leave the room
          </button>
        </>
      )}
    </>
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
  const [viewing, setViewing] = useState<string | null>(null);

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
  const turns = state.turn === 7 ? 'Last card' : `Turn ${state.turn} of 6`;
  const pass = state.age === 2 ? 'pass right →' : 'pass left ←';

  return (
    <>
      <div className="duel-status">
        <strong className={mine ? 'yours' : undefined}>
          {state.phase === 'over' ? 'Game over' : reviving ? 'Choose from the discards' : mine ? 'Pick a card' : 'Waiting…'}
        </strong>
        {state.phase !== 'over' && (
          <span className="note">
            Age {['I', 'II', 'III'][state.age - 1]} · {turns} · hands {pass}
            {!mine && waiting.length > 0 && ` · waiting for ${waiting.map(name).join(', ')}`}
          </span>
        )}
      </div>

      <LastTurn state={state} name={name} />

      {state.phase !== 'over' && me >= 0 && (
        <>
          <p className="group-title">Your hand{state.picks[me] ? ' · picked' : ''}</p>
          {state.picks[me] ? (
            <p className="note section-note">
              You {state.picks[me]!.as === 'discard' ? 'discard' : state.picks[me]!.as === 'wonder' ? 'build a wonder stage with' : 'build'}{' '}
              {cardOf(baseId(state.picks[me]!.card)).name}. It's revealed when everyone has picked.
            </p>
          ) : (
            <div className="hand">
              {state.hands[me].map((card) => {
                const c = cardOf(baseId(card));
                return (
                  <button key={card} className={`hand-card c-${c.color}`} disabled={!mine} onClick={() => setViewing(card)}>
                    <span className="dcard-band" />
                    <strong>{c.name}</strong>
                    <small>{shortEffect(c)}</small>
                    <small className="hand-cost">{costText(c.cost)}</small>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <CityPanel state={state} seat={me} name={name} mine />
      <p className="group-title">Neighbours</p>
      <CityPanel state={state} seat={leftOf(state, me)} name={name} label="Left" />
      {state.n > 2 && rightOf(state, me) !== leftOf(state, me) && <CityPanel state={state} seat={rightOf(state, me)} name={name} label="Right" />}
      {state.n > 3 && <TableSummary state={state} me={me} name={name} />}

      {error && <p className="error">{error}</p>}
      {state.phase === 'over' && <Outcome state={state} name={name} />}

      {viewing && mine && !reviving && <CardSheet state={state} me={me} card={viewing} name={name} onMove={play} onClose={() => setViewing(null)} />}
      {reviving && <ReviveSheet state={state} me={me} onMove={play} />}
    </>
  );
}

/** What everyone did last turn, and the battles at the end of an age. */
function LastTurn({ state, name }: { state: WondersState; name: (s: number) => string }) {
  if (!state.last) return null;
  const lines = state.last.picks.flatMap((p, seat) =>
    p ? [`${name(seat)} ${p.as === 'discard' ? 'discarded a card' : p.as === 'wonder' ? 'built a wonder stage' : `built ${cardOf(baseId(p.card)).name}`}`] : [],
  );
  const military = state.last.military;
  return (
    <div className="group card-pad history">
      {lines.length > 0 && <p className="note">Last turn: {lines.join('; ')}.</p>}
      {military && (
        <p className="note">
          Battles:{' '}
          {military
            .map((m) => `${name(m.seat)} ${m.vsLeft > 0 && m.vsRight > 0 ? 'won both' : m.vsLeft < 0 && m.vsRight < 0 ? 'lost both' : m.vsLeft + m.vsRight > 0 ? 'won one' : m.vsLeft + m.vsRight < 0 ? 'lost one' : 'held'}`)
            .join('; ')}
          .
        </p>
      )}
    </div>
  );
}

const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;

const COLORS: Color[] = ['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple'];

/** A city: wonder and stages, coins, shields, what it makes, its cards by colour. */
function CityPanel({ state, seat, name, mine, label }: { state: WondersState; seat: number; name: (s: number) => string; mine?: boolean; label?: string }) {
  const city = state.cities[seat];
  const board = boardOf(city.board);
  const supply = ownSupply(city);
  const stages = stagesOf(city);
  return (
    <section className={mine ? 'group card-pad city mine' : 'group card-pad city'}>
      <header className="city-head">
        <strong>
          {label ? `${label}: ` : ''}
          {name(seat)}
        </strong>
        <span className="city-figures">
          <span className="coins">
            {city.coins} {city.coins === 1 ? 'coin' : 'coins'}
          </span>
          <span className="note">{shieldsOf(city)} shields</span>
          <span className="note">{pts(score(state, seat).total)}</span>
        </span>
      </header>
      <p className="note wonder-line">
        {board.name} · side {city.side}
      </p>
      <div className="stages">
        {stages.map((st, i) => (
          <span key={i} className={i < city.stages ? 'stage built' : 'stage'} title={stageText(st)}>
            {i < city.stages ? '✓ ' : ''}
            {mine ? stageText(st) : `Stage ${i + 1}`}
            {mine && i >= city.stages ? ` (${costText(st.cost)})` : ''}
          </span>
        ))}
      </div>
      <div className="city-row">
        {RESOURCES.filter((r) => supply.fixed[r] > 0).map((r) => (
          <span key={r} className={`res res-${r}`}>
            {RES_NAMES[r]} {supply.fixed[r]}
          </span>
        ))}
        {supply.choices.length > 0 && <span className="chip">+{supply.choices.length} choice</span>}
        {COLORS.map((c) => {
          const n = city.cards.filter((id) => cardOf(id).color === c).length;
          return n ? (
            <span key={c} className={`pip c-${c}`} title={COLOR_NAMES[c]}>
              {n}
            </span>
          ) : null;
        })}
      </div>
      {mine && city.cards.length > 0 && <p className="note built-list">{city.cards.map((id) => cardOf(id).name).join(', ')}</p>}
    </section>
  );
}

/** The rest of the table, one line each. */
function TableSummary({ state, me, name }: { state: WondersState; me: number; name: (s: number) => string }) {
  const others = state.cities.map((_, seat) => seat).filter((seat) => seat !== me && seat !== leftOf(state, me) && seat !== rightOf(state, me));
  if (!others.length) return null;
  return (
    <>
      <p className="group-title">Across the table</p>
      <ol className="group players">
        {others.map((seat) => (
          <li key={seat} className="row">
            <span>{name(seat)}</span>
            <span className="row-detail">
              {state.cities[seat].coins}c · {shieldsOf(state.cities[seat])} shields · {state.cities[seat].stages}/{stagesOf(state.cities[seat]).length} stages · {pts(score(state, seat).total)}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet duel-sheet" role="dialog" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CardSheet({ state, me, card, name, onMove, onClose }: { state: WondersState; me: number; card: string; name: (s: number) => string; onMove: (m: Move) => void; onClose: () => void }) {
  const c = cardOf(baseId(card));
  const at = { type: 'pick' as const, age: state.age, turn: state.turn, card };
  const cost = buildCost(state, me, c.id);
  const owned = state.cities[me].cards.includes(c.id);
  const free = canBuildFree(state, me) && !owned;
  const stage = stagesOf(state.cities[me])[state.cities[me].stages];
  const stagePay = stageCost(state, me);
  const coins = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;
  const payText = (p: { coins: number; left: number; right: number; total: number }) => {
    const parts = [...(p.coins ? [`${coins(p.coins)} to the bank`] : []), ...(p.left ? [`${coins(p.left)} to ${name(leftOf(state, me))}`] : []), ...(p.right ? [`${coins(p.right)} to ${name(rightOf(state, me))}`] : [])];
    return parts.length ? parts.join(', ') : 'free';
  };
  return (
    <Sheet onClose={onClose}>
      <span className={`micro c-text-${c.color}`}>{COLOR_NAMES[c.color]}</span>
      <h3 className="sheet-title">{c.name}</h3>
      <p className="note">{costText(c.cost) === 'Free' ? 'Free to build.' : `Costs ${costText(c.cost)}.`}</p>
      {cardText(c).map((line) => (
        <p key={line} className="note">
          {line}
        </p>
      ))}
      <div className="sheet-actions">
        <button className="button primary" disabled={!cost} onClick={() => onMove({ ...at, as: 'build' })}>
          {owned ? 'You already have this' : cost ? (cost.chained ? 'Build: free through a chain' : `Build: ${payText(cost)}`) : 'Can’t afford to build'}
        </button>
        {free && !cost?.chained && (
          <button className="button" onClick={() => onMove({ ...at, as: 'build', free: true })}>
            Build free (once this age)
          </button>
        )}
        {stage && (
          <button className="button wonder-button" disabled={!stagePay} onClick={() => onMove({ ...at, as: 'wonder' })}>
            <span>Wonder stage {state.cities[me].stages + 1}: {stagePay ? payText(stagePay) : 'can’t afford'}</span>
            <small>{stageText(stage)}</small>
          </button>
        )}
        <button className="button" onClick={() => onMove({ ...at, as: 'discard' })}>
          Discard for 3 coins
        </button>
      </div>
    </Sheet>
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
