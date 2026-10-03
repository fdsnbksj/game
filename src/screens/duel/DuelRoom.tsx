import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { Sheet } from '../../components/Sheet';
import { SummaryRow } from '../../components/SummaryRow';
import { cardOf, RESOURCES, tokenOf, wonderOf, type TokenId } from '../../games/duel/cards';
import { cardText, COLOR_NAMES, costText, RES_NAMES, SCIENCE_NAMES, wonderText } from '../../games/duel/describe';
import { production } from '../../games/duel/pay';
import {
  accessible,
  actor,
  cardCost,
  discardValue,
  replay,
  score,
  wonderCost,
  type DuelState,
  type Move,
  type Player,
} from '../../games/duel/state';
import { finishDuel, joinDuel, sendMove, startDuel, watchDuel, type Duel, type DuelData } from '../../services/duel';
import { forgetRoom } from '../../lastPage';
import { useGameStore } from '../../store';
import { Structure } from './Structure';
import { CardEffect, CostIcons, WonderEffect } from './CardIcons';
import { Count, Icon } from '../../components/GameIcons';

export function DuelRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<DuelData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchDuel(code, uid, setData) : undefined), [code, uid]);
  // Home offers this room until its game is over, or it's gone, or you're not in it.
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.playerIds.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/duel/${code}`);
  }, [ended, code]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.playerIds.includes(uid)) body = <NotIn room={room} />;
  else if (room.status === 'lobby' || !room.seed) body = <Lobby room={room} uid={uid} />;
  else body = <Game room={room} moves={data.moves} uid={uid} />;

  return (
    <Page title={`Rival Wonders · ${code}`} back="/duel">
      {body}
    </Page>
  );
}

function NotIn({ room }: { room: Duel }) {
  const [error, setError] = useState<string | null>(null);
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return <Gone text="This game is already under way." />;
  return (
    <>
      <button className="button primary" onClick={() => void joinDuel(room.code).then(setError, (e) => setError(String(e)))}>
        Join room {room.code}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Lobby({ room, uid }: { room: Duel; uid: string }) {
  const [error, setError] = useState<string | null>(null);
  const ready = room.playerIds.length === 2;
  return (
    <LobbyFrame
      code={room.code}
      players={
        <ol className="group players">
          {room.playerIds.map((p) => (
            <li key={p} className="row">
              <span>{p === uid ? 'You' : room.names[p]}</span>
              {p === room.host && <span className="row-detail">Host</span>}
            </li>
          ))}
          {!ready && (
            <li className="row">
              <span className="note">Waiting for a rival…</span>
            </li>
          )}
        </ol>
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {room.host === uid ? (
            <button className="button primary" disabled={!ready} onClick={() => void startDuel(room.code).catch((e) => setError(String(e)))}>
              {ready ? 'Start' : 'Waiting for a rival'}
            </button>
          ) : (
            <p className="note center-note">The host starts the game.</p>
          )}
        </>
      }
    />
  );
}

// ---------- The game ----------

function Game({ room, moves, uid }: { room: Duel; moves: DuelData['moves']; uid: string }) {
  const players = room.playerIds as [string, string];
  const state = useMemo(() => replay(room.seed!, players, moves), [room.seed, players, moves]);
  const me = players.indexOf(uid) as Player;
  const them = (me === 0 ? 1 : 0) as Player;
  const name = (p: Player) => (p === me ? 'You' : room.names[players[p]]);
  const turn = actor(state);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  // The game is over on both phones at once; the first to say so marks the room done.
  useEffect(() => {
    if (state.phase === 'over' && room.status === 'playing') void finishDuel(room.code).catch(() => {});
  }, [state.phase, room.status, room.code]);

  // A new move came in: whatever card sheet was open is stale.
  useEffect(() => setViewing(null), [moves.length]);

  const play = (move: Move) => {
    setError(null);
    setViewing(null);
    // Refused if the other phone wrote this move number first; the watcher catches up.
    void sendMove(room.code, moves.length, move).catch(() => setError('That move didn’t go through. Try again.'));
  };

  const last = moves.at(-1);
  const lastBy = last ? (players.indexOf(last.by) as Player) : null;
  const status =
    state.phase === 'over'
      ? 'Game over'
      : turn === me
        ? state.pending.length
          ? 'Your choice'
          : state.phase === 'draft'
            ? 'Your pick'
            : 'Your turn'
        : `${name(them)} is playing…`;

  return (
    <>
      <div className="duel-status">
        <strong className={turn === me ? 'yours' : undefined}>{status}</strong>
        {last && lastBy !== null && state.log && (
          <span className="note">
            {name(lastBy)} {state.log}.
          </span>
        )}
      </div>

      {state.phase === 'draft' ? (
        <Draft state={state} me={me} turn={turn} name={name} onPick={(wonder) => play({ type: 'pickWonder', wonder })} />
      ) : (
        <>
          <CityRow state={state} p={them} name={name} />
          <Military state={state} me={me} rival={name(them)} />
          <div className="age-row">
            <span className="micro">Age {['I', 'II', 'III'][state.age - 1]}</span>
            <Tokens tokens={state.boardTokens} />
          </div>
          {state.taken.every(Boolean) ? (
            // Between ages, or the end: no empty table taking up the screen.
            <p className="note age-label">{state.phase === 'over' ? 'Every card is taken.' : `Age ${['I', 'II'][state.age - 1]} is over.`}</p>
          ) : (
            <Structure state={state} mine={turn === me && !state.pending.length && state.phase === 'play'} onPick={setViewing} />
          )}
          <CityRow state={state} p={me} name={name} mine />
        </>
      )}

      {error && <p className="error">{error}</p>}
      {state.phase === 'over' && state.outcome && <Outcome state={state} me={me} name={name} />}

      {viewing !== null && state.phase === 'play' && (
        <CardSheet state={state} slot={viewing} me={me} canAct={turn === me && !state.pending.length} onMove={play} onClose={() => setViewing(null)} />
      )}
      {turn === me && state.pending[0] && <ChoiceSheet state={state} me={me} name={name} onMove={play} />}
    </>
  );
}

function Draft({ state, me, turn, name, onPick }: { state: DuelState; me: Player; turn: Player | null; name: (p: Player) => string; onPick: (w: string) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  return (
    <>
      <p className="note">{turn === me ? 'Choose a wonder. Each of you drafts four.' : `${name(turn ?? 0)} is choosing a wonder.`}</p>
      <ul className="wonder-list">
        {state.draft.offered.map((id) => (
          <li key={id}>
            <button className="group card-pad wonder-card" onClick={() => setShown(id)}>
              <strong>{wonderOf(id).name}</strong>
              <span className="wonder-icons">
                <CostIcons cost={wonderOf(id).cost} size={18} />
                <span className="arrow">→</span>
                <WonderEffect wonder={wonderOf(id)} size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {[me, me === 0 ? 1 : 0].map((p) => (
        <p key={p} className="note">
          {name(p as Player)}: {state.cities[p].wonders.map((w) => wonderOf(w.id).name).join(', ') || 'none yet'}
        </p>
      ))}
      {shown && (
        <Sheet title={wonderOf(shown).name} onClose={() => setShown(null)}>
          <div className="sheet-icons">
            <span className="micro">Gives</span>
            <WonderEffect wonder={wonderOf(shown)} size={20} />
            <span className="micro">Costs</span>
            <CostIcons cost={wonderOf(shown).cost} size={18} />
          </div>
          {wonderText(wonderOf(shown)).map((line) => (
            <p key={line} className="note">
              {line}
            </p>
          ))}
          <div className="sheet-actions">
            {turn === me && state.draft.offered.includes(shown) && (
              <button
                className="button primary"
                onClick={() => {
                  setShown(null);
                  onPick(shown);
                }}
              >
                Take this wonder
              </button>
            )}
            <button className="button ghost" onClick={() => setShown(null)}>
              Close
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** A player in one line (coins, points, wonders built), opening their whole city. */
function CityRow({ state, p, name, mine }: { state: DuelState; p: Player; name: (p: Player) => string; mine?: boolean }) {
  const city = state.cities[p];
  return (
    <SummaryRow
      mine={mine}
      label={name(p)}
      title={mine ? 'Your city' : `${name(p)}’s city`}
      figures={
        <>
          <Count name="coin" n={city.coins} />
          <Count name="stage" n={`${city.wonders.filter((w) => w.built).length}/${city.wonders.filter((w) => !w.out).length}`} />
          <Count name="points" n={score(state)[p].total} />
        </>
      }
    >
      <CityStrip state={state} p={p} name={name} />
      <p className="group-title">Wonders</p>
      <ul className="group players wonder-rows">
        {city.wonders.map((w) => (
          <li key={w.id} className={w.out ? 'row out' : 'row'}>
            <span>
              {w.built ? '✓ ' : ''}
              {wonderOf(w.id).name}
              {w.out ? ' (out of play)' : ''}
            </span>
            <span className="row-detail icons effect">
              {!w.built && !w.out && <CostIcons cost={wonderOf(w.id).cost} size={13} />}
              <span className="arrow">→</span>
              <WonderEffect wonder={wonderOf(w.id)} size={13} />
            </span>
          </li>
        ))}
      </ul>
      {city.tokens.length > 0 && (
        <>
          <p className="group-title">Progress tokens</p>
          {city.tokens.map((t) => (
            <p key={t} className="note">
              <strong>{tokenOf(t).name}</strong>: {tokenOf(t).text}
            </p>
          ))}
        </>
      )}
    </SummaryRow>
  );
}

/** A city at a glance: coins, points so far, what it makes, its science, tokens and wonders. */
function CityStrip({ state, p, name }: { state: DuelState; p: Player; name: (p: Player) => string }) {
  const city = state.cities[p];
  const made = production(city.cards);
  const sci = city.cards.flatMap((c) => (cardOf(c).science ? [cardOf(c).science!] : []));
  const colors = ['brown', 'grey', 'blue', 'green', 'red', 'yellow', 'purple'] as const;
  const points = score(state)[p].total;
  return (
    <section className="group card-pad city">
      <header className="city-head">
        <strong>{name(p)}</strong>
        <span className="city-figures">
          <Count name="coin" n={city.coins} size={16} />
          <Count name="points" n={points} size={16} />
        </span>
      </header>
      <div className="city-row">
        {RESOURCES.filter((r) => made[r] > 0).map((r) => (
          <span key={r} className="have" title={RES_NAMES[r]}>
            <Count name={r} n={made[r]} size={15} />
          </span>
        ))}
        {colors.map((c) => {
          const n = city.cards.filter((id) => cardOf(id).color === c).length;
          return n ? (
            <span key={c} className={`pip c-${c}`} title={COLOR_NAMES[c]}>
              {n}
            </span>
          ) : null;
        })}
      </div>
      {sci.length > 0 && (
        <div className="city-row">
          {sci.map((s, i) => (
            <span key={`${s}-${i}`} className="have" title={SCIENCE_NAMES[s]}>
              <Icon name={s} size={15} />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** The conflict track: your capital at the left end, your rival's at the right; the pawn between. */
function Military({ state, me, rival }: { state: DuelState; me: Player; rival: string }) {
  // From my side: positive means toward my rival's capital.
  const lead = me === 0 ? state.pawn : -state.pawn;
  const theirLoot = state.loot[me === 0 ? 1 : 0];
  const myLoot = state.loot[me];
  return (
    <div className="military-wrap">
      <div className="military" aria-label={`Military: ${lead > 0 ? `you lead by ${lead}` : lead < 0 ? `your rival leads by ${-lead}` : 'level'}`}>
        {Array.from({ length: 19 }, (_, i) => {
          const pos = i - 9;
          const loot = (pos === -3 && myLoot[0]) || (pos === -6 && myLoot[1]) || (pos === 3 && theirLoot[0]) || (pos === 6 && theirLoot[1]);
          return (
            <span key={pos} className={['track', pos === lead && 'pawn', Math.abs(pos) === 9 && 'capital', loot && 'loot'].filter(Boolean).join(' ')}>
              {pos === lead ? '●' : loot ? (Math.abs(pos) === 3 ? '2' : '5') : ''}
            </span>
          );
        })}
      </div>
      <div className="military-ends">
        <span>◀ Your capital</span>
        <span>{lead > 0 ? `You lead by ${lead}` : lead < 0 ? `${rival} leads by ${-lead}` : 'Level'}</span>
        <span>{rival} ▶</span>
      </div>
    </div>
  );
}

/** The progress tokens still on the table: one chip, the list on tap. */
function Tokens({ tokens }: { tokens: TokenId[] }) {
  const [open, setOpen] = useState(false);
  if (!tokens.length) return null;
  return (
    <>
      <button className="chip token" onClick={() => setOpen(true)}>
        Progress tokens ({tokens.length}) ›
      </button>
      {open && (
        <Sheet title="Progress tokens" onClose={() => setOpen(false)}>
          <p className="note">Pair two matching science symbols to take one.</p>
          {tokens.map((t) => (
            <p key={t} className="note">
              <strong>{tokenOf(t).name}</strong>: {tokenOf(t).text}
            </p>
          ))}
          <button className="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}

/** A card from the table: what it does, and, on your turn, what you can do with it. */
function CardSheet({ state, slot, me, canAct, onMove, onClose }: { state: DuelState; slot: number; me: Player; canAct: boolean; onMove: (m: Move) => void; onClose: () => void }) {
  const id = state.setup.ages[state.age][slot];
  const card = cardOf(id);
  const open = canAct && state.phase === 'play' && accessibleNow(state, slot);
  const cost = cardCost(state, me, id);
  const city = state.cities[me];
  const coinsText = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;
  return (
    <Sheet onClose={onClose}>
      <span className={`micro c-text-${card.color}`}>{COLOR_NAMES[card.color]}</span>
      <h3 className="sheet-title">{card.name}</h3>
      <div className="sheet-icons">
        <span className="micro">Gives</span>
        <CardEffect card={card} size={20} />
        <span className="micro">Costs</span>
        <CostIcons cost={card.cost} size={18} />
      </div>
      <p className="note">{costText(card.cost) === 'Free' ? 'Free to build.' : `Costs ${costText(card.cost)}.`}</p>
      {cardText(card).map((line) => (
        <p key={line} className="note">
          {line}
        </p>
      ))}
      {open ? (
        <div className="sheet-actions">
          <button className="button primary" disabled={!cost} onClick={() => onMove({ type: 'build', slot })}>
            {cost ? (cost.chained ? 'Build: free through a chain' : cost.total ? `Build for ${coinsText(cost.total)}` : 'Build: free') : 'Can’t afford to build'}
          </button>
          <button className="button" onClick={() => onMove({ type: 'discard', slot })}>
            Discard for {coinsText(discardValue(city))}
          </button>
          {city.wonders
            .filter((w) => !w.built && !w.out)
            .map((w) => {
              const c = wonderCost(state, me, w.id);
              return (
                <button key={w.id} className="button wonder-button" disabled={!c} onClick={() => onMove({ type: 'wonder', slot, wonder: w.id })}>
                  <span>
                    Build {wonderOf(w.id).name} {c ? (c.total ? `for ${coinsText(c.total)}` : 'free') : '(can’t afford)'}
                  </span>
                  <WonderEffect wonder={wonderOf(w.id)} size={15} />
                </button>
              );
            })}
        </div>
      ) : (
        <button className="button" onClick={onClose}>
          Close
        </button>
      )}
    </Sheet>
  );
}

const accessibleNow = (state: DuelState, slot: number) => !state.taken[slot] && actor(state) !== null && accessible(state).includes(slot);

/** A choice the game is waiting on you for. */
function ChoiceSheet({ state, me, name, onMove }: { state: DuelState; me: Player; name: (p: Player) => string; onMove: (m: Move) => void }) {
  const p = state.pending[0];
  const them = (me === 0 ? 1 : 0) as Player;
  if (p.kind === 'token')
    return (
      <Sheet>
        <h3 className="sheet-title">{p.from === 'board' ? 'A science pair: choose a progress token' : 'The Great Library: choose a token'}</h3>
        {p.options.map((t) => (
          <button key={t} className="button choice-row" onClick={() => onMove({ type: 'token', token: t })}>
            <strong>{tokenOf(t).name}</strong>
            <small>{tokenOf(t).text}</small>
          </button>
        ))}
      </Sheet>
    );
  if (p.kind === 'destroy')
    return (
      <Sheet>
        <h3 className="sheet-title">Destroy one of {name(them)}'s {p.color} cards</h3>
        {state.cities[them].cards
          .filter((c) => cardOf(c).color === p.color)
          .map((c) => (
            <button key={c} className="button choice-row" onClick={() => onMove({ type: 'destroy', card: c })}>
              {cardOf(c).name}
            </button>
          ))}
      </Sheet>
    );
  if (p.kind === 'revive')
    return (
      <Sheet>
        <h3 className="sheet-title">Build a discarded card for free</h3>
        {state.discard.map((c) => (
          <button key={c} className="button choice-row" onClick={() => onMove({ type: 'revive', card: c })}>
            <strong>{cardOf(c).name}</strong>
            <small>{cardText(cardOf(c)).join(' ')}</small>
          </button>
        ))}
      </Sheet>
    );
  return (
    <Sheet>
      <h3 className="sheet-title">Age {['II', 'III'][state.age - 1]} is next. Who starts it?</h3>
      <p className="note">You're behind on military, or took the last card, so you choose.</p>
      <div className="choice-pair">
        <button className="button primary" onClick={() => onMove({ type: 'starter', player: me })}>
          I start
        </button>
        <button className="button" onClick={() => onMove({ type: 'starter', player: them })}>
          {name(them)} starts
        </button>
      </div>
    </Sheet>
  );
}

function Outcome({ state, me, name }: { state: DuelState; me: Player; name: (p: Player) => string }) {
  const o = state.outcome!;
  const how = { military: 'by military supremacy', science: 'by scientific supremacy', points: 'on points' }[o.how];
  const rows: [string, keyof (typeof o.scores)[0]][] = [
    ['Civic', 'blue'],
    ['Science', 'green'],
    ['Commercial', 'yellow'],
    ['Guilds', 'guilds'],
    ['Wonders', 'wonders'],
    ['Tokens', 'tokens'],
    ['Military', 'military'],
    ['Coins', 'coins'],
    ['Total', 'total'],
  ];
  const them = (me === 0 ? 1 : 0) as Player;
  return (
    <div className="group card-pad phase">
      <p className={o.winner === me ? 'winner good' : o.winner === null ? 'winner' : 'winner evil'}>
        {o.winner === null ? 'A shared victory' : o.winner === me ? 'You win' : `${name(o.winner)} wins`}
      </p>
      <p className="note">{o.winner === null ? 'Level on points and on civic points.' : `Won ${how}.`}</p>
      {o.how === 'points' && (
        <table className="scores">
          <thead>
            <tr>
              <th />
              <th>You</th>
              <th>{name(them)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key} className={key === 'total' ? 'total' : undefined}>
                <td>{label}</td>
                <td>{o.scores[me][key]}</td>
                <td>{o.scores[them][key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link className="button" to="/duel">
        New game
      </Link>
    </div>
  );
}

/** A room this phone can't play in, perhaps reopened from last time: a way out. */
function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/duel">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/">
        All games
      </Link>
    </div>
  );
}
