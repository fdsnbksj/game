import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { Sheet } from '../../components/Sheet';
import { SummaryRow } from '../../components/SummaryRow';
import { botMove } from '../../games/wonders/bot';
import { boardOf, cardOf, RESOURCES, type Color } from '../../games/wonders/cards';
import { cardText, COLOR_NAMES, costText, RES_NAMES, stageText } from '../../games/wonders/describe';
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
import { CardEffect, CostIcons, StageEffect } from './CardIcons';
import { Count, Icon, type IconName } from '../../components/GameIcons';

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
  const turns = state.turn === 7 ? 'last card' : `turn ${state.turn} of 6`;
  const pass = state.age === 2 ? '→' : '←';
  const picked = me >= 0 ? state.picks[me] : null;
  const others = waiting.filter((seat) => seat !== me).map(name);
  const left = leftOf(state, me);
  const right = rightOf(state, me);
  const city = state.cities[me];

  return (
    <>
      {state.phase === 'over' ? (
        <Outcome state={state} name={name} />
      ) : (
        <>
          <div className="duel-status">
            <strong className={mine && !picked ? 'yours' : undefined}>
              {reviving ? 'Choose from the discards' : picked ? `You picked ${cardOf(baseId(picked.card)).name}` : mine ? 'Pick a card' : 'Waiting…'}
            </strong>
            <span className="note">
              {picked || !mine ? (others.length ? `Waiting for ${others.join(', ')}` : 'Revealing…') : `Age ${['I', 'II', 'III'][state.age - 1]}, ${turns} · hands pass ${pass}`}
            </span>
          </div>

          {picked ? (
            <p className="note center-note">
              {picked.as === 'discard' ? 'Discarding it for 3 coins' : picked.as === 'wonder' ? 'Building a wonder stage with it' : 'Building it'}. Everyone's picks show when the last one is in.
            </p>
          ) : (
            me >= 0 && <Hand state={state} me={me} disabled={!mine} onOpen={setViewing} />
          )}
          {error && <p className="error">{error}</p>}
        </>
      )}

      {me >= 0 && (
        <SummaryRow
          mine
          label="You"
          title={`You · ${boardOf(city.board).name}`}
          figures={<Figures state={state} seat={me} stages />}
        >
          <CityPanel state={state} seat={me} name={name} mine />
          <IconKey />
        </SummaryRow>
      )}
      <SummaryRow
        label={left === right ? `Neighbour: ${name(left)}` : `◀ ${name(left)} · ${name(right)} ▶`}
        title="Your neighbours"
        figures={
          <>
            <Count name="shield" n={shieldsOf(state.cities[left])} />
            {left !== right && <Count name="shield" n={shieldsOf(state.cities[right])} />}
          </>
        }
      >
        <p className="note">You trade with and fight only these two. Your shields: {shieldsOf(city)}.</p>
        <CityPanel state={state} seat={left} name={name} label="Left" />
        {left !== right && <CityPanel state={state} seat={right} name={name} label="Right" />}
      </SummaryRow>
      {state.n > 3 && (
        <SummaryRow label="Across the table" figures={<span className="note">{state.n - 3} more</span>}>
          <TableSummary state={state} me={me} name={name} />
        </SummaryRow>
      )}
      <LastTurn state={state} name={name} />

      {viewing && mine && !reviving && <CardSheet state={state} me={me} card={viewing} name={name} onMove={play} onClose={() => setViewing(null)} />}
      {reviving && <ReviveSheet state={state} me={me} onMove={play} />}
    </>
  );
}

/** Coins, shields and points (and wonder stages built) on one line. */
function Figures({ state, seat, stages }: { state: WondersState; seat: number; stages?: boolean }) {
  const city = state.cities[seat];
  return (
    <>
      <Count name="coin" n={city.coins} />
      <Count name="shield" n={shieldsOf(city)} />
      {stages && <Count name="stage" n={`${city.stages}/${stagesOf(city).length}`} />}
      <Count name="points" n={score(state, seat).total} />
    </>
  );
}

/** Your hand, big: each card's name, what it gives, and what it would cost you now. */
function Hand({ state, me, disabled, onOpen }: { state: WondersState; me: number; disabled: boolean; onOpen: (card: string) => void }) {
  return (
    <div className="hand">
      {state.hands[me].map((card) => {
        const c = cardOf(baseId(card));
        const owned = state.cities[me].cards.includes(c.id);
        const cost = buildCost(state, me, c.id);
        return (
          <button key={card} className={`hand-card c-${c.color}${cost ? '' : ' unaffordable'}`} disabled={disabled} onClick={() => onOpen(card)}>
            <span className="dcard-band" />
            <strong>{c.name}</strong>
            <span className="hand-effect">
              <CardEffect card={c} size={16} />
            </span>
            <span className="hand-cost">
              {owned ? (
                'Already built'
              ) : !cost ? (
                'Can’t build'
              ) : cost.chained ? (
                <span className="icons free">
                  <Icon name="chain" size={13} /> Free
                </span>
              ) : cost.total === 0 ? (
                <span className="free">Free</span>
              ) : (
                <Count name="coin" n={cost.total} size={13} />
              )}
            </span>
          </button>
        );
      })}
    </div>
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

const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;

const COLORS: Color[] = ['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple'];

/** A city: wonder and stages, coins, shields, what it makes, its cards by colour. */
function CityPanel({ state, seat, name, mine, label }: { state: WondersState; seat: number; name: (s: number) => string; mine?: boolean; label?: string }) {
  const city = state.cities[seat];
  const board = boardOf(city.board);
  const supply = ownSupply(city);
  const stages = stagesOf(city);
  const cards = city.cards.map(cardOf);
  const science = (['compass', 'gear', 'tablet'] as const).map((sym) => [sym, cards.filter((c) => c.science === sym).length] as const);
  const wins = city.victories.reduce((a, b) => a + b, 0);
  return (
    <section className={mine ? 'group card-pad city mine' : 'group card-pad city'}>
      <header className="city-head">
        <strong>
          {label ? `${label}: ` : ''}
          {name(seat)}
        </strong>
        <span className="city-figures" aria-label={`${city.coins} coins, ${shieldsOf(city)} shields, ${pts(score(state, seat).total)}`}>
          <Count name="coin" n={city.coins} size={16} />
          <Count name="shield" n={shieldsOf(city)} size={16} />
          <Count name="points" n={score(state, seat).total} size={16} />
        </span>
      </header>
      <p className="note wonder-line">
        <Icon name="stage" size={13} /> {board.name} · side {city.side}
      </p>
      <div className="stages">
        {stages.map((st, i) => (
          <span key={i} className={i < city.stages ? 'stage built' : 'stage'} title={stageText(st)}>
            {i < city.stages ? '✓' : `${i + 1}`}
            {mine && i >= city.stages && <CostIcons cost={st.cost} size={12} />}
            {mine && <span className="arrow">→</span>}
            {mine ? <StageEffect stage={st} size={12} /> : null}
          </span>
        ))}
      </div>
      <div className="city-row">
        {RESOURCES.filter((r) => supply.fixed[r] > 0).map((r) => (
          <span key={r} className="have" title={RES_NAMES[r]}>
            <Count name={r} n={supply.fixed[r]} size={15} />
          </span>
        ))}
        {supply.choices.map((choice, i) => (
          <span key={`c${i}`} className="have choice" title="One of these each turn">
            {choice.map((r, k) => (
              <span key={r} className="icons">
                {k > 0 && <span className="slash">/</span>}
                <Icon name={r} size={13} />
              </span>
            ))}
          </span>
        ))}
        {science
          .filter(([, n]) => n > 0)
          .map(([sym, n]) => (
            <span key={sym} className="have">
              <Count name={sym} n={n} size={15} />
            </span>
          ))}
        {(wins > 0 || city.defeats > 0) && (
          <span className="have" title="Battle points and defeats">
            {wins > 0 && <Count name="points" n={`+${wins}`} size={13} />}
            {city.defeats > 0 && <Count name="defeat" n={`−${city.defeats}`} size={13} />}
          </span>
        )}
      </div>
      <div className="city-row">
        {COLORS.map((c) => {
          const n = cards.filter((card) => card.color === c).length;
          return n ? (
            <span key={c} className={`pip c-${c}`} title={COLOR_NAMES[c]}>
              {n}
            </span>
          ) : null;
        })}
      </div>
      {mine && city.cards.length > 0 && <p className="note built-list">{cards.map((c) => c.name).join(', ')}</p>}
    </section>
  );
}

/** The rest of the table, one line each. */
function TableSummary({ state, me, name }: { state: WondersState; me: number; name: (s: number) => string }) {
  const others = state.cities.map((_, seat) => seat).filter((seat) => seat !== me && seat !== leftOf(state, me) && seat !== rightOf(state, me));
  if (!others.length) return null;
  return (
    <>
      <ol className="group players">
        {others.map((seat) => (
          <li key={seat} className="row">
            <span>{name(seat)}</span>
            <span className="row-detail icons effect">
              <Count name="coin" n={state.cities[seat].coins} />
              <Count name="shield" n={shieldsOf(state.cities[seat])} />
              <Count name="stage" n={`${state.cities[seat].stages}/${stagesOf(state.cities[seat]).length}`} />
              <Count name="points" n={score(state, seat).total} />
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

const KEY: [IconName, string][] = [
  ['coin', 'Coins'],
  ['points', 'Points at the end'],
  ['shield', 'Shields: win battles with your neighbours'],
  ['defeat', 'A lost battle: −1 point'],
  ['stage', 'Wonder stage'],
  ['chain', 'Free by chain'],
  ['wood', 'Wood'],
  ['stone', 'Stone'],
  ['clay', 'Clay'],
  ['ore', 'Ore'],
  ['glass', 'Glass'],
  ['cloth', 'Cloth'],
  ['papyrus', 'Papyrus'],
  ['compass', 'Science: compass'],
  ['gear', 'Science: gear'],
  ['tablet', 'Science: tablet'],
];

/** What the icons mean, folded away until wanted. */
function IconKey() {
  return (
    <details className="group card-pad icon-key">
      <summary>What the icons mean</summary>
      <ul>
        {KEY.map(([icon, text]) => (
          <li key={icon}>
            <Icon name={icon} size={18} />
            <span>{text}</span>
          </li>
        ))}
        <li>
          <span className="where">◀ ▶</span>
          <span>Your left and right neighbours (◀•▶: them and you)</span>
        </li>
        <li>
          <span className="where">/</span>
          <span>One of these, your choice, each turn</span>
        </li>
      </ul>
    </details>
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
  // The one that most likely makes sense goes first: build, else a wonder stage, else discard.
  const actions: { key: string; label: string; detail?: string; move: Move | null }[] = [
    {
      key: 'build',
      label: owned ? 'You already have this' : cost ? (cost.chained ? 'Build: free through a chain' : `Build: ${payText(cost)}`) : 'Can’t afford to build',
      move: cost ? { ...at, as: 'build' } : null,
    },
    ...(free && !cost?.chained ? [{ key: 'free', label: 'Build free (once this age)', move: { ...at, as: 'build' as const, free: true } }] : []),
    ...(stage
      ? [{ key: 'wonder', label: `Wonder stage ${state.cities[me].stages + 1}: ${stagePay ? payText(stagePay) : 'can’t afford'}`, detail: stageText(stage), move: stagePay ? { ...at, as: 'wonder' as const } : null }]
      : []),
    { key: 'discard', label: 'Discard for 3 coins', move: { ...at, as: 'discard' } },
  ];
  const best = cost ? 'build' : stagePay && stage ? 'wonder' : 'discard';
  actions.sort((x, y) => Number(y.key === best) - Number(x.key === best));
  return (
    <Sheet onClose={onClose}>
      <span className={`micro c-text-${c.color}`}>{COLOR_NAMES[c.color]}</span>
      <h3 className="sheet-title">{c.name}</h3>
      <div className="sheet-icons">
        <span className="micro">Gives</span>
        <CardEffect card={c} size={20} />
        <span className="micro">Costs</span>
        <CostIcons cost={c.cost} size={18} />
      </div>
      <p className="note">{costText(c.cost) === 'Free' ? 'Free to build.' : `Costs ${costText(c.cost)}.`}</p>
      {cardText(c).map((line) => (
        <p key={line} className="note">
          {line}
        </p>
      ))}
      <div className="sheet-actions">
        {actions.map(({ key, label, detail, move }) => (
          <button key={key} className={`button${key === best ? ' primary' : ''}${key === 'wonder' ? ' wonder-button' : ''}`} disabled={!move} onClick={() => move && onMove(move)}>
            <span>{label}</span>
            {detail && <small>{detail}</small>}
          </button>
        ))}
        <button className="button ghost" onClick={onClose}>
          Back to your hand
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
