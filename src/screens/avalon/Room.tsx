import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page, Toggle } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import type { Secret } from '../../games/avalon/deal';
import { failsToSink, isEvil, MAX_PLAYERS, MAX_REJECTIONS, MIN_PLAYERS, OPTIONAL_ROLES, QUESTS, ROLE_NAMES, roleList, TEAM_SIZES, type OptionalRole } from '../../games/avalon/rules';
import { derive, type GameState } from '../../games/avalon/state';
import {
  assassinate,
  emptyRoom,
  fileLadyResult,
  finish,
  joinRoom,
  leaveRoom,
  pickLady,
  playCard,
  propose,
  seat,
  setLady,
  setOptional,
  startGame,
  vote,
  watchRoom,
  type Room as RoomDoc,
  type RoomData,
} from '../../services/avalon';
import { useGameStore } from '../../store';
import { TableView, type SeatMarks } from './TableView';

/** A room, from the lobby to the reveal. Everything follows the documents live. */
export function Room() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<RoomData>(emptyRoom);

  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (!room.playerIds.includes(uid)) body = <NotIn room={room} />;
  else if (room.status === 'lobby') body = <Lobby room={room} uid={uid} />;
  else body = <Game room={room} data={data} uid={uid} />;

  return (
    <Page title={`Avalon · ${code}`} back="/avalon">
      {body}
    </Page>
  );
}

function NotIn({ room }: { room: RoomDoc }) {
  const [error, setError] = useState<string | null>(null);
  if (room.status !== 'lobby') return <Gone text="This game has already started." />;
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

function Lobby({ room, uid }: { room: RoomDoc; uid: string }) {
  const isHost = room.host === uid;
  const count = room.playerIds.length;
  const roles = roleList(Math.max(count, MIN_PLAYERS), room.optional);
  const problem = typeof roles === 'string' ? roles : count < MIN_PLAYERS ? `Waiting for ${MIN_PLAYERS - count} more to join.` : null;
  const [error, setError] = useState<string | null>(null);
  const name = (p: string) => (p === uid ? 'You' : room.names[p]);

  const toggle = (role: OptionalRole, on: boolean) =>
    void setOptional(room.code, on ? [...room.optional, role] : room.optional.filter((r) => r !== role));

  /** Moves a player one seat clockwise (+1) or back (-1). */
  const move = (i: number, by: number) => {
    const order = [...room.playerIds];
    const j = (i + by + order.length) % order.length;
    [order[i], order[j]] = [order[j], order[i]];
    void seat(room.code, order);
  };

  const inPlay = ['Merlin', 'Assassin', ...OPTIONAL_ROLES.filter((r) => room.optional.includes(r)).map((r) => ROLE_NAMES[r]), ...(room.lady ? ['Lady of the Lake'] : [])];

  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <p className="group-title">
            Players · {count} of {MAX_PLAYERS}
          </p>
          <ol className="group players">
            {room.playerIds.map((p) => (
              <li key={p} className="row">
                <span>{name(p)}</span>
                {p === room.host && <span className="row-detail">Host</span>}
              </li>
            ))}
          </ol>
          <p className="note section-note">With: {inPlay.join(', ')}.</p>
        </>
      }
      options={
        isHost && (
          <>
            <p className="group-title">Roles</p>
            <div className="group">
              {OPTIONAL_ROLES.map((role) => (
                <Toggle key={role} label={ROLE_NAMES[role]} on={room.optional.includes(role)} onChange={(on) => toggle(role, on)} />
              ))}
              <Toggle label="Lady of the Lake (best with 7+)" on={room.lady} onChange={(on) => void setLady(room.code, on)} />
            </div>
            <p className="group-title">Seating, clockwise</p>
            <p className="note section-note">Match how people sit: the lead passes to the next seat.</p>
            <ol className="group players">
              {room.playerIds.map((p, i) => (
                <li key={p} className="row">
                  <span>
                    {i + 1}. {name(p)}
                  </span>
                  {count > 1 && (
                    <span className="seat-moves">
                      <button className="icon-button small" aria-label={`Move ${name(p)} back a seat`} onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button className="icon-button small" aria-label={`Move ${name(p)} on a seat`} onClick={() => move(i, 1)}>
                        ↓
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )
      }
      action={
        <>
          {problem && <p className="note center-note">{problem}</p>}
          {error && <p className="error">{error}</p>}
          {isHost ? (
            <button className="button primary" disabled={problem !== null} onClick={() => void startGame(room).catch((e) => setError(String(e)))}>
              Deal the roles
            </button>
          ) : (
            <>
              <p className="note center-note">The host deals the roles when everyone is in.</p>
              <button className="button ghost" onClick={() => void leaveRoom(room)}>
                Leave the room
              </button>
            </>
          )}
        </>
      }
    />
  );
}

// ---------- Game ----------

/** What the table lets you choose right now, if anything. */
interface Picking {
  /** How many to choose. */
  count: number;
  can: (uid: string) => boolean;
}

function Game({ room, data, uid }: { room: RoomDoc; data: RoomData; uid: string }) {
  const n = room.playerIds.length;
  const name = (p: string) => (p === uid ? 'You' : room.names[p]);
  const state = useMemo(
    () =>
      derive(
        {
          playerIds: room.playerIds,
          firstLeader: room.firstLeader,
          proposals: data.proposals,
          votes: data.votes,
          tallies: data.tallies,
          assassinated: room.assassinated,
          lady: room.lady,
          ladyPicks: data.ladyPicks,
        },
        (p) => (data.secrets[p] ? data.secrets[p].role === 'merlin' : null),
      ),
    [room, data],
  );
  const phase = state.phase;

  // Evil has won on quests or rejections: every phone sees it, and the first to say so ends the game.
  const over = phase.kind === 'over';
  useEffect(() => {
    if (over && room.status === 'playing') void finish(room.code).catch(() => {});
  }, [over, room.status, room.code]);

  // Examined by the Lady: this phone tells the holder the truth (the rules check it).
  const filed = useRef(new Set<number>());
  useEffect(() => {
    if (!data.mine) return;
    for (const pick of data.ladyPicks) {
      if (pick.target !== uid || filed.current.has(pick.quest)) continue;
      filed.current.add(pick.quest);
      // Refused if it was already filed (a reload): that's fine.
      void fileLadyResult(room.code, pick.quest, isEvil(data.mine.role)).catch(() => {});
    }
  }, [data.ladyPicks, data.mine, room.code, uid]);

  // Choosing players on the table: the leader's team, the Lady's target, the assassin's guess.
  const picking: Picking | null =
    phase.kind === 'proposing' && phase.leader === uid
      ? { count: phase.teamSize, can: () => true }
      : phase.kind === 'lady' && phase.holder === uid
        ? { count: 1, can: (p) => phase.candidates.includes(p) }
        : phase.kind === 'assassinating' && data.mine?.role === 'assassin' && !room.assassinated
          ? { count: 1, can: (p) => p !== uid }
          : null;
  const pickKey = `${phase.kind}-${state.quest}-${state.rejections}`;
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [pickKey]);
  // Functional, so quick taps in a row each count.
  const toggle = (p: string) =>
    setPicked((current) => (current.includes(p) ? current.filter((x) => x !== p) : picking?.count === 1 ? [p] : [...current, p]));

  // While the role card is held, your night knowledge is marked on the seats too.
  const [revealing, setRevealing] = useState(false);
  const knowing = revealing && room.status !== 'done' ? data.mine : null;

  const last = state.votes.at(-1);
  const current = phase.kind === 'voting' || phase.kind === 'questing' ? phase.proposal : null;
  const marks = (p: string): SeatMarks => ({
    you: p === uid,
    knows: knowing?.sees.find((s) => s.uid === p)?.as,
    leader: state.leader === p,
    next: phase.kind !== 'over' && phase.kind !== 'assassinating' && state.nextLeader === p && state.leader !== p,
    lady: state.ladyHolder === p && phase.kind !== 'over',
    team: current?.team.includes(p),
    vote: phase.kind !== 'voting' && last && (phase.kind === 'questing' || phase.kind === 'proposing') ? (last.approvals.includes(p) ? 'approve' : 'reject') : undefined,
    done:
      phase.kind === 'voting' && phase.voted.includes(p)
        ? 'Voted'
        : phase.kind === 'questing' && (data.played[state.quest] ?? []).includes(p)
          ? 'Played'
          : undefined,
  });

  const caption =
    phase.kind === 'proposing'
      ? `Quest ${state.quest + 1} · team of ${phase.teamSize}`
      : phase.kind === 'voting'
        ? 'Vote on the team'
        : phase.kind === 'questing'
          ? `Quest ${state.quest + 1} under way`
          : phase.kind === 'lady'
            ? 'Lady of the Lake'
            : phase.kind === 'assassinating'
              ? 'The assassin chooses'
              : phase.winner === 'good'
                ? 'Good wins'
                : 'Evil wins';

  return (
    <>
      {data.mine && room.status !== 'done' && <RoleCard secret={data.mine} name={name} shown={revealing} setShown={setRevealing} />}
      <TableView
        playerIds={room.playerIds}
        names={room.names}
        marks={marks}
        picked={picked}
        canPick={picking?.can}
        onPick={picking ? toggle : undefined}
        center={<strong className="table-caption">{caption}</strong>}
      />
      {knowing && <Legend secret={knowing} />}
      <Board state={state} n={n} />
      <PhasePanel state={state} room={room} data={data} uid={uid} name={name} picked={picked} picking={picking} />
      <History state={state} data={data} uid={uid} name={name} />
      {room.status === 'done' && <Reveal room={room} secrets={data.secrets} name={name} />}
    </>
  );
}

/** Your role, shown only while you hold it, so a neighbour can't glance at it. */
function RoleCard({
  secret,
  name,
  shown,
  setShown,
}: {
  secret: Secret;
  name: (p: string) => string;
  /** Held down right now: the table shows your knowledge too while it is. */
  shown: boolean;
  setShown: (shown: boolean) => void;
}) {
  const evil = isEvil(secret.role);
  const names = (as: string) => secret.sees.filter((s) => s.as === as).map((s) => name(s.uid)).join(', ');
  let knows: string;
  if (secret.role === 'merlin') knows = secret.sees.length ? `Evil: ${names('evil')}. (Mordred, if in the game, is hidden from you.)` : 'You see no evil.';
  else if (secret.role === 'percival')
    knows = secret.sees.some((s) => s.as === 'merlin-or-morgana') ? `Merlin and Morgana are ${names('merlin-or-morgana')}. You can't tell which is which.` : `Merlin is ${names('merlin')}.`;
  else if (secret.role === 'oberon') knows = "You're evil, but you don't know the others and they don't know you.";
  else if (evil) knows = secret.sees.length ? `Your fellow evil: ${names('evil')}.` : 'You know no other evil.';
  else knows = 'You know no one. Watch the votes.';

  const hide = () => setShown(false);
  return (
    <button
      className={shown ? `group role-card shown ${evil ? 'evil' : 'good'}` : 'group role-card'}
      onPointerDown={() => setShown(true)}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
    >
      {shown ? (
        <>
          <span className="micro">{evil ? 'Evil' : 'Good'}</span>
          <strong>{ROLE_NAMES[secret.role]}</strong>
          <span className="note">{knows}</span>
        </>
      ) : (
        <>
          <strong>Hold to see your role</strong>
          <span className="note">Keep the screen turned away from others.</span>
        </>
      )}
    </button>
  );
}

/** What the knowledge marks on the seats mean, for your role; shown only while you hold your card. */
function Legend({ secret }: { secret: Secret }) {
  const items: [string, string, string][] = [];
  if (secret.role === 'merlin') items.push(['evil', 'Evil', 'Evil players you see. Mordred, if in the game, is hidden from you.']);
  else if (secret.role === 'percival') {
    if (secret.sees.some((s) => s.as === 'merlin-or-morgana')) items.push(['maybe', 'Merlin?', 'One is Merlin, the other Morgana. You can’t tell which.']);
    else items.push(['merlin', 'Merlin', 'Merlin. Protect them from the assassin.']);
  } else if (isEvil(secret.role) && secret.role !== 'oberon') items.push(['evil', 'Evil', 'Your fellow evil. Oberon, if in the game, is not shown.']);
  if (items.length === 0) return <p className="note legend">{secret.role === 'oberon' ? 'Oberon knows no one.' : 'You know no one. Watch the votes.'}</p>;
  return (
    <ul className="legend">
      {items.map(([kind, label, text]) => (
        <li key={kind}>
          <span className={`mark ${kind}`}>{label}</span>
          <span className="note">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Board({ state, n }: { state: GameState; n: number }) {
  return (
    <div className="group card-pad board-track">
      <ol className="quests">
        {Array.from({ length: QUESTS }, (_, q) => {
          const result = state.results.find((r) => r.quest === q);
          const current = q === state.quest && !result && state.phase.kind !== 'over' && state.phase.kind !== 'assassinating';
          const cls = ['quest', result ? (result.succeeded ? 'won' : 'lost') : '', current ? 'current' : ''].join(' ');
          return (
            <li key={q} className={cls}>
              {TEAM_SIZES[n][q]}
              {failsToSink(n, q) === 2 && <small>2 fails</small>}
            </li>
          );
        })}
      </ol>
      <div className="track-foot">
        <span className="note">Rejected teams</span>
        <span className="rejections" aria-label={`${state.rejections} of ${MAX_REJECTIONS} teams rejected`}>
          {Array.from({ length: MAX_REJECTIONS }, (_, i) => (
            <span key={i} className={i < state.rejections ? 'on' : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}

function PhasePanel({
  state,
  room,
  data,
  uid,
  name,
  picked,
  picking,
}: {
  state: GameState;
  room: RoomDoc;
  data: RoomData;
  uid: string;
  name: (p: string) => string;
  picked: string[];
  picking: Picking | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => void p.then(() => setError(null), (e) => setError(e instanceof Error ? e.message : String(e)));
  const phase = state.phase;
  const list = (ids: string[]) => ids.map(name).join(', ');
  let content: ReactNode;

  if (phase.kind === 'proposing') {
    content =
      phase.leader === uid ? (
        <>
          <p className="lead-line">
            You lead. Tap {phase.teamSize} players on the table for quest {state.quest + 1} ({picked.length} of {phase.teamSize}).
          </p>
          <button
            className="button primary"
            disabled={picked.length !== phase.teamSize}
            onClick={() => act(propose(room.code, state.quest, state.rejections, room.playerIds.filter((p) => picked.includes(p))))}
          >
            Propose this team
          </button>
        </>
      ) : (
        <p className="note">
          {name(phase.leader)} is choosing {phase.teamSize} players for quest {state.quest + 1}.
        </p>
      );
  } else if (phase.kind === 'voting') {
    const mine = phase.voted.includes(uid);
    const waiting = room.playerIds.filter((p) => !phase.voted.includes(p)).map(name);
    content = (
      <>
        <p className="lead-line">
          Team for quest {state.quest + 1}: <strong>{list(phase.proposal.team)}</strong>
        </p>
        {mine ? (
          <p className="note">Voted. Waiting for {waiting.join(', ')}.</p>
        ) : (
          <div className="choice-pair">
            <button className="button primary" onClick={() => act(vote(room.code, state.quest, state.rejections, true))}>
              Approve
            </button>
            <button className="button" onClick={() => act(vote(room.code, state.quest, state.rejections, false))}>
              Reject
            </button>
          </div>
        )}
      </>
    );
  } else if (phase.kind === 'questing') {
    const onTeam = phase.proposal.team.includes(uid);
    const played = (data.played[state.quest] ?? []).includes(uid);
    const good = data.mine ? !isEvil(data.mine.role) : true;
    content = (
      <>
        <p className="lead-line">
          On quest {state.quest + 1}: <strong>{list(phase.proposal.team)}</strong>
        </p>
        {onTeam && !played ? (
          <>
            <div className="choice-pair">
              <button className="button primary" onClick={() => act(playCard(room.code, state.quest, phase.proposal.attempt, false))}>
                Success
              </button>
              <button className="button danger" disabled={good} onClick={() => act(playCard(room.code, state.quest, phase.proposal.attempt, true))}>
                Fail
              </button>
            </div>
            {good && <p className="note">Good players must play Success.</p>}
          </>
        ) : (
          <p className="note">
            {phase.played} of {phase.proposal.team.length} cards played. The result shows when all are in.
          </p>
        )}
      </>
    );
  } else if (phase.kind === 'lady') {
    content =
      phase.holder === uid ? (
        <>
          <p className="lead-line">
            You hold the Lady of the Lake. Tap a player on the table to learn whether they are good or evil. Only you will
            see it, and she passes to them.
          </p>
          <button className="button primary" disabled={picked.length !== 1} onClick={() => act(pickLady(room.code, phase.afterQuest, picked[0]))}>
            {picked.length ? `Examine ${name(picked[0])}` : 'Choose a player'}
          </button>
        </>
      ) : (
        <p className="note">{name(phase.holder)} holds the Lady of the Lake and is choosing someone to examine.</p>
      );
  } else if (phase.kind === 'assassinating') {
    content =
      picking && data.mine?.role === 'assassin' ? (
        <>
          <p className="lead-line">Good won three quests. Tap the player you think is Merlin to steal the win.</p>
          <button className="button danger" disabled={picked.length !== 1} onClick={() => act(assassinate(room.code, picked[0]))}>
            {picked.length ? `Name ${name(picked[0])} as Merlin` : 'Choose a player'}
          </button>
        </>
      ) : room.assassinated ? (
        <p className="note">The assassin named {name(room.assassinated)}. Revealing…</p>
      ) : (
        <p className="note">Good completed three quests. The assassin is choosing whom to name as Merlin.</p>
      );
  } else {
    const reason = {
      quests: 'Three quests failed.',
      rejections: `${MAX_REJECTIONS} teams in a row were rejected.`,
      'assassin-missed': `The assassin named ${room.assassinated ? name(room.assassinated) : 'the wrong player'}, who wasn't Merlin.`,
      'assassin-found-merlin': `The assassin found Merlin: ${room.assassinated ? name(room.assassinated) : ''}.`,
    }[phase.reason];
    content = (
      <>
        <p className={phase.winner === 'good' ? 'winner good' : 'winner evil'}>{phase.winner === 'good' ? 'Good wins' : 'Evil wins'}</p>
        <p className="note">{reason}</p>
        <Link className="button" to="/avalon">
          New game
        </Link>
      </>
    );
  }

  return (
    <div className="group card-pad phase">
      {content}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** The last vote, the Lady's checks, and the quests so far. */
function History({ state, data, uid, name }: { state: GameState; data: RoomData; uid: string; name: (p: string) => string }) {
  const last = state.votes.at(-1);
  if (!last && state.results.length === 0 && state.ladyPicks.length === 0) return null;
  return (
    <div className="group card-pad history">
      {state.ladyPicks
        .filter((p) => p.holder === uid)
        .map((p) => (
          <p key={`seen-${p.quest}`} className={data.ladySeen[p.quest] === undefined ? 'note' : data.ladySeen[p.quest] ? 'lady-seen evil' : 'lady-seen good'}>
            {data.ladySeen[p.quest] === undefined ? (
              `Waiting for ${name(p.target)}'s phone to answer the Lady…`
            ) : (
              <>
                The Lady shows you: <strong>{name(p.target)}</strong> is <strong>{data.ladySeen[p.quest] ? 'evil' : 'good'}</strong>. Only you
                can see this.
              </>
            )}
          </p>
        ))}
      {last && (
        <p className="note">
          Last vote on {last.proposal.team.map(name).join(', ')}: <strong>{last.approved ? 'approved' : 'rejected'}</strong>{' '}
          {last.approvals.length}–{last.rejections.length}. For: {last.approvals.map(name).join(', ') || 'no one'}.
        </p>
      )}
      {state.results.map((r) => (
        <p key={r.quest} className="note">
          Quest {r.quest + 1}: <strong>{r.succeeded ? 'succeeded' : 'failed'}</strong>
          {r.fails > 0 ? ` with ${r.fails} ${r.fails === 1 ? 'fail' : 'fails'}` : ''}.
          {state.ladyPicks
            .filter((p) => p.quest === r.quest)
            .map((p) => ` ${name(p.holder)} examined ${name(p.target)} with the Lady.`)}
        </p>
      ))}
    </div>
  );
}

function Reveal({ room, secrets, name }: { room: RoomDoc; secrets: Record<string, Secret>; name: (p: string) => string }) {
  return (
    <>
      <p className="group-title">Everyone's role</p>
      <ol className="group players">
        {room.playerIds.map((p) => {
          const role = secrets[p]?.role;
          return (
            <li key={p} className="row">
              <span>{name(p)}</span>
              <span className={role && isEvil(role) ? 'row-detail evil' : 'row-detail good'}>{role ? ROLE_NAMES[role] : '…'}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** A room this phone can't play in, perhaps reopened from last time: a way out. */
function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/avalon">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/">
        All games
      </Link>
    </div>
  );
}
