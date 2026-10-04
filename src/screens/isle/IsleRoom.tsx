import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Count, Icon, type IconName } from '../../components/GameIcons';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { Sheet } from '../../components/Sheet';
import { SummaryRow } from '../../components/SummaryRow';
import { VERTICES } from '../../games/isle/board';
import { botMove } from '../../games/isle/bot';
import { DEV_NAMES, DEV_TEXT, eventText, handText, RES_NAMES } from '../../games/isle/describe';
import { RESOURCES, type Dev, type Res } from '../../games/isle/setup';
import {
  bankRate,
  canAfford,
  citySpots,
  COSTS,
  emptyHand,
  handSize,
  openingSpots,
  piecesLeft,
  playable,
  publicPoints,
  replay,
  roadLength,
  roadSpots,
  score,
  settleSpots,
  victims,
  waitingFor,
  type Hand,
  type IsleState,
  type Move,
  type Score,
} from '../../games/isle/state';
import { forgetRoom } from '../../lastPage';
import { addBot, finishGame, isBot, joinRoom, leaveRoom, MAX_SEATS, sendMove, setSeats, startGame, watchRoom, type IsleData, type IsleRoom as Room } from '../../services/isle';
import { useGameStore } from '../../store';
import { IslandMap, PLAYER_COLORS, type Targets } from './IslandMap';

const RES_ICONS: Record<Res, IconName> = { brick: 'brick', lumber: 'lumber', wool: 'wool', grain: 'grain', ore: 'ore' };

export function IsleRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<IsleData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);
  // Home offers this room until its game is over, or it's gone, or you're not in it.
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.seats.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/isle/${code}`);
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
    <Page title={`Island Settlers · ${code}`} back="/isle">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/isle">
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
            {room.seats.map((seat, i) => (
              <li key={seat} className="row">
                <span className="isle-who">
                  <span className="isle-dot" style={{ background: PLAYER_COLORS[i] }} />
                  {label(seat)}
                </span>
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
        n > 1 && (
          <>
            <p className="group-title">Turn order</p>
            <p className="note section-note">The first seat places first and rolls first.</p>
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

type Mode = 'road' | 'settlement' | 'city' | null;

function Game({ room, moves, uid }: { room: Room; moves: IsleData['moves']; uid: string }) {
  const state = useMemo(() => replay(room.seed!, room.seats, moves), [room.seed, room.seats, moves]);
  const me = room.seats.indexOf(uid);
  const name = (seat: number) => (seat === me ? 'You' : room.names[room.seats[seat]]);
  const waiting = waitingFor(state);
  const count = useRef(moves.length);
  count.current = moves.length;
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  /** The opening's chosen corner, or the robber's chosen land, before the second tap. */
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'build' | 'trade' | 'cards' | null>(null);

  // A new state from elsewhere clears any half-made choice.
  useEffect(() => {
    setMode(null);
    setPicked(null);
  }, [state.count]);

  const play = (move: Move, by?: string) => {
    setError(null);
    setSheet(null);
    setMode(null);
    setPicked(null);
    void sendMove(room.code, () => count.current, move, by).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  // The host's phone plays the bots: once per state for the player whose turn it is, and
  // once per 7 or per offer for the moves everyone makes together.
  const sentFor = useRef(new Set<string>());
  const isHost = room.host === uid;
  useEffect(() => {
    if (!isHost || state.phase === 'over') return;
    for (const seat of waiting) {
      const id = room.seats[seat];
      if (!isBot(id)) continue;
      const key =
        state.phase === 'discard' ? `${seat}:discard:${state.turn}` : seat !== state.current && state.offer ? `${seat}:offer:${state.offer.at}` : `${seat}:${state.count}`;
      if (sentFor.current.has(key)) continue;
      sentFor.current.add(key);
      const move = botMove(state, seat);
      // If the write fails, forget it so the next render tries again.
      if (move) void sendMove(room.code, () => count.current, move, id).catch(() => sentFor.current.delete(key));
    }
  }, [isHost, state, waiting, room]);

  // Over on every phone at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.phase === 'over' && room.status === 'playing') void finishGame(room.code).catch(() => {});
  }, [state.phase, room.status, room.code]);

  const mine = me === state.current;
  const owed = me >= 0 ? state.discarding[me] : 0;

  // What the map offers to tap now.
  let targets: Targets = {};
  if (mine && state.phase === 'setup') targets = picked === null ? { vertices: openingSpots(state) } : { edges: VERTICES[picked].edges.filter((e) => state.roads[e] === null) };
  else if (mine && state.phase === 'robber' && picked === null) targets = { hexes: state.setup.terrain.map((_, h) => h).filter((h) => h !== state.robber) };
  else if (mine && state.freeRoads) targets = { edges: roadSpots(state, me) };
  else if (mine && mode === 'road') targets = { edges: roadSpots(state, me) };
  else if (mine && mode === 'settlement') targets = { vertices: settleSpots(state, me) };
  else if (mine && mode === 'city') targets = { vertices: citySpots(state, me) };

  const onVertex = (v: number) => {
    if (state.phase === 'setup') setPicked(v);
    else if (mode === 'settlement') play({ type: 'settlement', vertex: v });
    else if (mode === 'city') play({ type: 'city', vertex: v });
  };
  const onEdge = (e: number) => {
    if (state.phase === 'setup' && picked !== null) play({ type: 'place', vertex: picked, edge: e });
    else play({ type: 'road', edge: e });
  };
  const onHex = (h: number) => {
    const options = victims(state, me, h);
    if (options.length > 1) setPicked(h);
    else play({ type: 'robber', hex: h, victim: options[0] ?? null });
  };

  if (state.phase === 'over') {
    return (
      <>
        <IslandMap state={state} targets={{}} onVertex={() => {}} onEdge={() => {}} onHex={() => {}} />
        <Outcome state={state} name={name} />
        <Log state={state} name={name} me={me} />
      </>
    );
  }

  return (
    <>
      <Status state={state} me={me} name={name} picked={picked} mode={mode} />
      <IslandMap
        state={state}
        targets={targets}
        pending={state.phase === 'setup' && picked !== null ? { vertex: picked, seat: me } : null}
        onVertex={onVertex}
        onEdge={onEdge}
        onHex={onHex}
      />

      {me >= 0 && <HandRow state={state} me={me} />}
      {state.offer && !mine && me >= 0 && !state.offer.declined.includes(me) && <OfferBanner state={state} me={me} name={name} onMove={play} />}
      {error && <p className="error">{error}</p>}

      <div className="isle-actions">
        <Actions state={state} me={me} mode={mode} picked={picked} name={name} setMode={setMode} setPicked={setPicked} setSheet={setSheet} onMove={play} />
      </div>

      {me >= 0 && (
        <SummaryRow mine label="You" title="You" figures={<Count name="points" n={score(state, me).total} />}>
          <YouPanel state={state} me={me} />
        </SummaryRow>
      )}
      <SummaryRow label="Players" figures={<PlayerDots state={state} />}>
        <Players state={state} name={name} />
      </SummaryRow>
      <Log state={state} name={name} me={me} />
      <SummaryRow label="Costs and rules" title="Costs and rules">
        <Rules />
      </SummaryRow>

      {owed > 0 && <DiscardSheet hand={state.players[me].hand} owed={owed} onMove={play} />}
      {sheet === 'build' && <BuildSheet state={state} me={me} onMode={(m) => {
            setSheet(null);
            setMode(m);
          }} onMove={play} onClose={() => setSheet(null)} />}
      {sheet === 'trade' && <TradeSheet state={state} me={me} name={name} onMove={play} onClose={() => setSheet(null)} />}
      {sheet === 'cards' && <CardsSheet state={state} me={me} onMove={play} onClose={() => setSheet(null)} />}
    </>
  );
}

/** What's happening, in a line, and what to do about it. */
function Status({ state, me, name, picked, mode }: { state: IsleState; me: number; name: (s: number) => string; picked: number | null; mode: Mode }) {
  const mine = me === state.current;
  const who = name(state.current);
  let line: string;
  let yours = mine;
  if (state.phase === 'setup') {
    const second = state.step >= state.n;
    line = mine ? (picked === null ? `Place your ${second ? 'second' : 'first'} settlement` : 'Now its road') : `${who} is settling`;
  } else if (state.phase === 'discard') {
    const owed = state.discarding[me] ?? 0;
    yours = owed > 0;
    const others = state.discarding.flatMap((n, seat) => (n > 0 && seat !== me ? [name(seat)] : []));
    line = owed > 0 ? `Discard ${owed}` : `Waiting for ${others.join(', ')} to discard`;
  } else if (state.phase === 'robber') line = mine ? (picked === null ? 'Move the robber' : 'Steal from whom?') : `${who} is moving the robber`;
  else if (state.phase === 'roll') line = mine ? 'Your turn: roll' : `${who}'s turn`;
  else if (mine && state.freeRoads) line = `Place a free road (${state.freeRoads} left)`;
  else if (mine && mode) line = `Tap where the ${mode} goes`;
  else line = mine ? 'Build, trade, or end your turn' : `${who}'s turn`;
  const dice = state.dice ? `Rolled ${state.dice[0] + state.dice[1]} (${state.dice[0]} + ${state.dice[1]})` : null;
  const setupNote = state.phase === 'setup' && state.step >= state.n ? 'The second settlement brings one of each land around it' : null;
  return (
    <div className="duel-status">
      <strong className={yours ? 'yours' : undefined}>{line}</strong>
      <span className="note">
        {[setupNote ?? dice, me >= 0 ? `You: ${score(state, me).total} of 10 points` : null].filter(Boolean).join(' · ')}
      </span>
    </div>
  );
}

/** Your five resources and your development cards, always in view. */
function HandRow({ state, me }: { state: IsleState; me: number }) {
  const p = state.players[me];
  const devs = p.devs.length + p.fresh.length;
  return (
    <div className="isle-hand" aria-label="Your cards">
      {RESOURCES.map((r) => (
        <span key={r} className={p.hand[r] ? 'isle-res' : 'isle-res none'} title={RES_NAMES[r]}>
          <Icon name={RES_ICONS[r]} size={22} />
          <strong>{p.hand[r]}</strong>
        </span>
      ))}
      <span className={devs ? 'isle-res' : 'isle-res none'} title="Development cards">
        <Icon name="devcard" size={22} />
        <strong>{devs}</strong>
      </span>
    </div>
  );
}

function Actions({
  state,
  me,
  mode,
  picked,
  name,
  setMode,
  setPicked,
  setSheet,
  onMove,
}: {
  state: IsleState;
  me: number;
  mode: Mode;
  picked: number | null;
  name: (s: number) => string;
  setMode: (m: Mode) => void;
  setPicked: (p: number | null) => void;
  setSheet: (s: 'build' | 'trade' | 'cards') => void;
  onMove: (m: Move) => void;
}) {
  if (me !== state.current) return null;
  const cards = playable(state, me);
  const cardsButton = (state.players[me].devs.length > 0 || state.players[me].fresh.length > 0) && (
    <button className="button" onClick={() => setSheet('cards')}>
      Cards{cards.length ? ' ·' : ''}
      {cards.length ? <span className="isle-badge">{cards.length}</span> : null}
    </button>
  );

  if (state.phase === 'setup' && picked !== null)
    return (
      <button className="button ghost" onClick={() => setPicked(null)}>
        Choose another corner
      </button>
    );
  if (state.phase === 'robber' && picked !== null)
    return (
      <div className="isle-choices">
        {victims(state, me, picked).map((v) => (
          <button key={v} className="button" onClick={() => onMove({ type: 'robber', hex: picked, victim: v })}>
            <span className="isle-dot" style={{ background: PLAYER_COLORS[v] }} />
            {name(v)} · {handSize(state.players[v].hand)} cards
          </button>
        ))}
        <button className="button ghost" onClick={() => setPicked(null)}>
          Choose another land
        </button>
      </div>
    );
  if (state.phase === 'roll')
    return (
      <div className="isle-row">
        {cardsButton}
        <button className="button primary" onClick={() => onMove({ type: 'roll' })}>
          Roll the dice
        </button>
      </div>
    );
  if (state.phase !== 'main' || state.freeRoads) return null;
  if (mode)
    return (
      <button className="button ghost" onClick={() => setMode(null)}>
        Cancel
      </button>
    );
  return (
    <>
      <div className="isle-row">
        <button className="button" onClick={() => setSheet('build')}>
          Build
        </button>
        <button className="button" onClick={() => setSheet('trade')}>
          Trade{state.offer ? ' ·' : ''}
          {state.offer ? <span className="isle-badge">1</span> : null}
        </button>
        {cardsButton}
      </div>
      <button className="button primary" onClick={() => onMove({ type: 'end' })}>
        End your turn
      </button>
    </>
  );
}

function OfferBanner({ state, me, name, onMove }: { state: IsleState; me: number; name: (s: number) => string; onMove: (m: Move) => void }) {
  const offer = state.offer!;
  const can = canAfford(state.players[me].hand, offer.get) && canAfford(state.players[state.current].hand, offer.give);
  return (
    <div className="group card-pad isle-offer">
      <p>
        <strong>{name(state.current)}</strong> offers <HandIcons hand={offer.give} /> for your <HandIcons hand={offer.get} />
      </p>
      <div className="isle-row">
        <button className="button" onClick={() => onMove({ type: 'decline' })}>
          No thanks
        </button>
        <button className="button" disabled={!can} onClick={() => onMove({ type: 'accept' })}>
          {can ? 'Accept' : 'You can’t pay that'}
        </button>
      </div>
    </div>
  );
}

function HandIcons({ hand }: { hand: Partial<Hand> }) {
  return (
    <span className="icons">
      {RESOURCES.filter((r) => hand[r]).map((r) => (
        <Count key={r} name={RES_ICONS[r]} n={hand[r]!} size={15} />
      ))}
    </span>
  );
}

// ---------- Sheets ----------

const BUILDS: { key: 'road' | 'settlement' | 'city' | 'dev'; label: string; icon: IconName; points?: string }[] = [
  { key: 'road', label: 'Road', icon: 'road' },
  { key: 'settlement', label: 'Settlement', icon: 'settlement', points: '1 point' },
  { key: 'city', label: 'City', icon: 'city', points: '2 points, double harvest' },
  { key: 'dev', label: 'Development card', icon: 'devcard' },
];

function BuildSheet({ state, me, onMode, onMove, onClose }: { state: IsleState; me: number; onMode: (m: Mode) => void; onMove: (m: Move) => void; onClose: () => void }) {
  const hand = state.players[me].hand;
  const left = piecesLeft(state, me);
  const spots = { road: roadSpots(state, me).length, settlement: settleSpots(state, me).length, city: citySpots(state, me).length, dev: state.deck.length };
  return (
    <Sheet title="Build" onClose={onClose}>
      {BUILDS.map(({ key, label, icon, points }) => {
        const pieces = key === 'dev' ? state.deck.length : left[key];
        const why = !canAfford(hand, COSTS[key]) ? 'Not enough cards' : !pieces ? (key === 'dev' ? 'None left' : 'No pieces left') : !spots[key] ? 'Nowhere to build one' : null;
        return (
          <button key={key} className="button choice-row isle-build" disabled={!!why} onClick={() => (key === 'dev' ? onMove({ type: 'buy' }) : onMode(key))}>
            <span className="isle-build-head">
              <Icon name={icon} size={20} />
              <strong>{label}</strong>
              <HandIcons hand={COSTS[key]} />
            </span>
            <small>{why ?? [points, key === 'dev' ? `${pieces} in the deck` : `${pieces} left`].filter(Boolean).join(' · ')}</small>
          </button>
        );
      })}
      <button className="button ghost" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}

function Stepper({ res, n, max, onChange }: { res: Res; n: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="isle-stepper">
      <Icon name={RES_ICONS[res]} size={20} title={RES_NAMES[res]} />
      <button className="icon-button small" aria-label={`One less ${RES_NAMES[res]}`} disabled={n <= 0} onClick={() => onChange(n - 1)}>
        −
      </button>
      <strong>{n}</strong>
      <button className="icon-button small" aria-label={`One more ${RES_NAMES[res]}`} disabled={n >= max} onClick={() => onChange(n + 1)}>
        +
      </button>
    </div>
  );
}

function DiscardSheet({ hand, owed, onMove }: { hand: Hand; owed: number; onMove: (m: Move) => void }) {
  const [cards, setCards] = useState<Hand>(emptyHand());
  const chosen = handSize(cards);
  return (
    <Sheet title={`A 7: discard ${owed} of your ${handSize(hand)} cards`}>
      <div className="isle-steppers">
        {RESOURCES.map((r) => (
          <Stepper key={r} res={r} n={cards[r]} max={Math.min(hand[r], cards[r] + owed - chosen)} onChange={(n) => setCards({ ...cards, [r]: n })} />
        ))}
      </div>
      <button className="button primary" disabled={chosen !== owed} onClick={() => onMove({ type: 'discard', cards })}>
        {chosen === owed ? `Discard ${handText(cards)}` : `Choose ${owed - chosen} more`}
      </button>
    </Sheet>
  );
}

function TradeSheet({ state, me, name, onMove, onClose }: { state: IsleState; me: number; name: (s: number) => string; onMove: (m: Move) => void; onClose: () => void }) {
  const hand = state.players[me].hand;
  const [tab, setTab] = useState<'bank' | 'players'>(state.offer ? 'players' : 'bank');
  const [give, setGive] = useState<Res | null>(null);
  const [get, setGet] = useState<Res | null>(null);
  const [offerGive, setOfferGive] = useState<Hand>(emptyHand());
  const [offerGet, setOfferGet] = useState<Hand>(emptyHand());
  const offer = state.offer;
  const others = state.players.map((_, seat) => seat).filter((seat) => seat !== me);

  return (
    <Sheet title="Trade" onClose={onClose}>
      <div className="segmented" role="radiogroup" aria-label="Trade with">
        <button role="radio" aria-checked={tab === 'bank'} onClick={() => setTab('bank')}>
          The bank
        </button>
        <button role="radio" aria-checked={tab === 'players'} onClick={() => setTab('players')}>
          Players
        </button>
      </div>
      {tab === 'bank' ? (
        <>
          <p className="micro">You give</p>
          <div className="isle-pick">
            {RESOURCES.map((r) => {
              const rate = bankRate(state, me, r);
              return (
                <button key={r} className="isle-pick-res" aria-pressed={give === r} disabled={hand[r] < rate} onClick={() => setGive(r)}>
                  <Icon name={RES_ICONS[r]} size={22} title={RES_NAMES[r]} />
                  <small>{rate}:1</small>
                </button>
              );
            })}
          </div>
          <p className="micro">You get one</p>
          <div className="isle-pick">
            {RESOURCES.map((r) => (
              <button key={r} className="isle-pick-res" aria-pressed={get === r} disabled={r === give || !state.bank[r]} onClick={() => setGet(r)}>
                <Icon name={RES_ICONS[r]} size={22} title={RES_NAMES[r]} />
                <small>{state.bank[r]} left</small>
              </button>
            ))}
          </div>
          <button className="button primary" disabled={!give || !get || give === get} onClick={() => give && get && onMove({ type: 'bank', give, get })}>
            {give && get && give !== get ? `Give ${bankRate(state, me, give)} ${RES_NAMES[give]} for 1 ${RES_NAMES[get]}` : 'Choose what to give and get'}
          </button>
          <p className="note">Harbours on your settlements and cities give better rates: 3:1 for anything, or 2:1 for their resource.</p>
        </>
      ) : offer ? (
        <>
          <p>
            You offer <HandIcons hand={offer.give} /> for <HandIcons hand={offer.get} />
          </p>
          <ul className="group players">
            {others.map((seat) => (
              <li key={seat} className="row">
                <span>{name(seat)}</span>
                <span className="row-detail">{offer.declined.includes(seat) ? 'No thanks' : 'Thinking…'}</span>
              </li>
            ))}
          </ul>
          <p className="note">The first to accept trades with you. Bots always say no.</p>
          <button className="button" onClick={() => onMove({ type: 'cancel' })}>
            Withdraw the offer
          </button>
        </>
      ) : (
        <>
          <p className="micro">You give</p>
          <div className="isle-steppers">
            {RESOURCES.map((r) => (
              <Stepper key={r} res={r} n={offerGive[r]} max={hand[r]} onChange={(n) => setOfferGive({ ...offerGive, [r]: n })} />
            ))}
          </div>
          <p className="micro">You want</p>
          <div className="isle-steppers">
            {RESOURCES.map((r) => (
              <Stepper key={r} res={r} n={offerGet[r]} max={offerGive[r] ? 0 : 9} onChange={(n) => setOfferGet({ ...offerGet, [r]: n })} />
            ))}
          </div>
          <button
            className="button primary"
            disabled={!handSize(offerGive) || !handSize(offerGet) || RESOURCES.some((r) => offerGive[r] && offerGet[r])}
            onClick={() => onMove({ type: 'offer', give: offerGive, get: offerGet })}
          >
            Offer to everyone
          </button>
        </>
      )}
    </Sheet>
  );
}

function CardsSheet({ state, me, onMove, onClose }: { state: IsleState; me: number; onMove: (m: Move) => void; onClose: () => void }) {
  const p = state.players[me];
  const can = playable(state, me);
  const [choosing, setChoosing] = useState<'plenty' | 'monopoly' | null>(null);
  const [take, setTake] = useState<Res[]>([]);
  const counts = (list: Dev[]) => [...new Set(list)].map((d) => [d, list.filter((x) => x === d).length] as const);

  if (choosing === 'monopoly')
    return (
      <Sheet title="Monopoly: name a resource" onClose={onClose}>
        <div className="isle-pick">
          {RESOURCES.map((r) => (
            <button key={r} className="isle-pick-res" onClick={() => onMove({ type: 'play', card: 'monopoly', res: r })}>
              <Icon name={RES_ICONS[r]} size={22} title={RES_NAMES[r]} />
              <small>{RES_NAMES[r]}</small>
            </button>
          ))}
        </div>
        <button className="button ghost" onClick={() => setChoosing(null)}>
          Back
        </button>
      </Sheet>
    );
  if (choosing === 'plenty')
    return (
      <Sheet title="Plenty: take two from the bank" onClose={onClose}>
        <div className="isle-pick">
          {RESOURCES.map((r) => (
            <button key={r} className="isle-pick-res" disabled={take.length >= 2 || state.bank[r] <= take.filter((x) => x === r).length} onClick={() => setTake([...take, r])}>
              <Icon name={RES_ICONS[r]} size={22} title={RES_NAMES[r]} />
              <small>{take.filter((x) => x === r).length || ''}</small>
            </button>
          ))}
        </div>
        <button className="button primary" disabled={take.length !== 2} onClick={() => onMove({ type: 'play', card: 'plenty', take: [take[0], take[1]] })}>
          {take.length === 2 ? `Take ${take.map((r) => RES_NAMES[r]).join(' and ')}` : `Choose ${2 - take.length} more`}
        </button>
        <button className="button ghost" onClick={() => (take.length ? setTake([]) : setChoosing(null))}>
          {take.length ? 'Start again' : 'Back'}
        </button>
      </Sheet>
    );

  return (
    <Sheet title="Your development cards" onClose={onClose}>
      {counts(p.devs).map(([d, n]) => (
        <button
          key={d}
          className="button choice-row"
          disabled={!can.includes(d)}
          onClick={() => (d === 'plenty' || d === 'monopoly' ? setChoosing(d) : onMove({ type: 'play', card: d as 'knight' | 'roads' }))}
        >
          <strong>
            {DEV_NAMES[d]}
            {n > 1 ? ` ×${n}` : ''}
          </strong>
          <small>{d === 'point' ? DEV_TEXT[d] : `${can.includes(d) ? 'Play: ' : ''}${DEV_TEXT[d]}`}</small>
        </button>
      ))}
      {p.fresh.length > 0 && <p className="note">New this turn, playable from your next: {p.fresh.map((d) => DEV_NAMES[d]).join(', ')}.</p>}
      {state.devPlayed && <p className="note">You've played a card this turn: one a turn.</p>}
      <button className="button ghost" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}

// ---------- Folded away ----------

function PlayerDots({ state }: { state: IsleState }) {
  return (
    <span className="icons">
      {state.players.map((_, seat) => (
        <span key={seat} className={seat === state.current ? 'isle-chip current' : 'isle-chip'}>
          <span className="isle-dot" style={{ background: PLAYER_COLORS[seat] }} />
          {publicPoints(state, seat)}
        </span>
      ))}
    </span>
  );
}

function Players({ state, name }: { state: IsleState; name: (s: number) => string }) {
  return (
    <ol className="group players">
      {state.players.map((p, seat) => (
        <li key={seat} className="row isle-player">
          <span className="isle-who">
            <span className="isle-dot" style={{ background: PLAYER_COLORS[seat] }} />
            {name(seat)}
          </span>
          <span className="row-detail icons">
            <Count name="points" n={publicPoints(state, seat)} />
            <span title="Cards in hand">{handSize(p.hand)} cards</span>
            <Count name="devcard" n={p.devs.length + p.fresh.length} />
            <span title="Knights played">⚔ {p.knights}</span>
            <Count name="road" n={roadLength(state, seat)} />
            {state.longest === seat && <span className="isle-award">Longest road</span>}
            {state.largest === seat && <span className="isle-award">Largest army</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function YouPanel({ state, me }: { state: IsleState; me: number }) {
  const s = score(state, me);
  const left = piecesLeft(state, me);
  return (
    <>
      <ScoreLines score={s} />
      <p className="note">
        Pieces left: {left.road} roads, {left.settlement} settlements, {left.city} cities. Your longest road: {roadLength(state, me)}. Knights played: {state.players[me].knights}.
      </p>
    </>
  );
}

function ScoreLines({ score: s }: { score: Score }) {
  const rows: [string, number][] = [
    ['Settlements', s.settlements],
    ['Cities', s.cities],
    ['Longest road', s.longest],
    ['Largest army', s.largest],
    ['Victory point cards', s.cards],
  ];
  return (
    <ul className="group players">
      {rows
        .filter(([, n]) => n > 0)
        .map(([label, n]) => (
          <li key={label} className="row">
            <span>{label}</span>
            <span className="row-detail">{n}</span>
          </li>
        ))}
      <li className="row">
        <strong>Total</strong>
        <strong className="row-detail">{s.total} of 10</strong>
      </li>
    </ul>
  );
}

function Log({ state, name, me }: { state: IsleState; name: (s: number) => string; me: number }) {
  const lines = state.log.flatMap((e) => {
    const text = eventText(e, name, me);
    return text ? [text] : [];
  });
  if (!lines.length) return null;
  return (
    <SummaryRow label={<span className="isle-last">{lines.at(-1)}</span>} title="What happened">
      <ol className="group players">
        {lines
          .slice(-40)
          .reverse()
          .map((line, i) => (
            <li key={i} className="row">
              {line}
            </li>
          ))}
      </ol>
    </SummaryRow>
  );
}

function Rules() {
  return (
    <>
      <ul className="group players">
        {BUILDS.map(({ key, label, icon }) => (
          <li key={key} className="row">
            <span className="isle-who">
              <Icon name={icon} size={18} />
              {label}
            </span>
            <span className="row-detail">
              <HandIcons hand={COSTS[key]} />
            </span>
          </li>
        ))}
      </ul>
      <div className="how-to">
        <p>Each land pays its resource to the settlements (1) and cities (2) on its corners when its number is rolled.</p>
        <p>On a 7 nobody is paid: anyone holding more than 7 cards discards half, and the roller moves the robber, which blocks a land, and steals a card from someone beside it.</p>
        <p>Settlements need a road leading to them and an empty corner on every side. Longest road (5 or more) and largest army (3 knights or more) are worth 2 points each.</p>
        <p>First to 10 points on their own turn wins.</p>
      </div>
    </>
  );
}

function Outcome({ state, name }: { state: IsleState; name: (s: number) => string }) {
  const winner = state.winner!;
  return (
    <div className="group card-pad phase">
      <p className="winner good">{name(winner) === 'You' ? 'You win' : `${name(winner)} wins`}</p>
      <div className="scores-wrap">
        <table className="scores">
          <thead>
            <tr>
              <th />
              {state.players.map((_, seat) => (
                <th key={seat}>{name(seat)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Settlements', 'settlements'],
                ['Cities', 'cities'],
                ['Longest road', 'longest'],
                ['Largest army', 'largest'],
                ['Point cards', 'cards'],
                ['Total', 'total'],
              ] as [string, keyof Score][]
            ).map(([label, key]) => (
              <tr key={key} className={key === 'total' ? 'total' : undefined}>
                <td>{label}</td>
                {state.players.map((_, seat) => (
                  <td key={seat}>{score(state, seat)[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link className="button" to="/isle">
        New game
      </Link>
    </div>
  );
}
