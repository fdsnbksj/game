import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page, Toggle } from '../../components/Page';
import type { Secret } from '../../games/avalon/deal';
import { failsToSink, isEvil, MAX_PLAYERS, MAX_REJECTIONS, MIN_PLAYERS, OPTIONAL_ROLES, QUESTS, ROLE_NAMES, roleList, TEAM_SIZES, type OptionalRole } from '../../games/avalon/rules';
import { derive, type GameState, type Proposal } from '../../games/avalon/state';
import {
  assassinate,
  emptyRoom,
  finish,
  joinRoom,
  leaveRoom,
  playCard,
  propose,
  setOptional,
  startGame,
  vote,
  watchRoom,
  type Room as RoomDoc,
  type RoomData,
} from '../../services/avalon';
import { useGameStore } from '../../store';

/** A room, from the lobby to the reveal. Everything follows the documents live. */
export function Room() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<RoomData>(emptyRoom);

  useEffect(() => (uid ? watchRoom(code, uid, setData) : undefined), [code, uid]);

  const room = data.room;
  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <p className="note">There's no room {code}.</p>;
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
  if (room.status !== 'lobby') return <p className="note">This game has already started.</p>;
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

  const toggle = (role: OptionalRole, on: boolean) =>
    void setOptional(room.code, on ? [...room.optional, role] : room.optional.filter((r) => r !== role));

  return (
    <>
      <div className="room-code">
        <span className="micro">Room code</span>
        <strong>{room.code}</strong>
        <span className="note">Everyone joins on their own phone: Avalon → Join a room.</span>
      </div>

      <p className="group-title">
        Players · {count} of {MAX_PLAYERS}
      </p>
      <ol className="group players">
        {room.playerIds.map((p) => (
          <li key={p} className="row">
            <span>{room.names[p]}</span>
            {p === room.host && <span className="row-detail">Host</span>}
            {p === uid && <span className="row-detail">You</span>}
          </li>
        ))}
      </ol>

      <p className="group-title">Roles</p>
      <div className="group">
        <div className="row">
          <span>Merlin and the Assassin</span>
          <span className="row-detail">Always</span>
        </div>
        {OPTIONAL_ROLES.map((role) =>
          isHost ? (
            <Toggle key={role} label={ROLE_NAMES[role]} on={room.optional.includes(role)} onChange={(on) => toggle(role, on)} />
          ) : (
            <div key={role} className="row">
              <span>{ROLE_NAMES[role]}</span>
              <span className="row-detail">{room.optional.includes(role) ? 'In' : 'Out'}</span>
            </div>
          ),
        )}
      </div>

      {problem && <p className="note">{problem}</p>}
      {error && <p className="error">{error}</p>}
      {isHost ? (
        <button className="button primary" disabled={problem !== null} onClick={() => void startGame(room).catch((e) => setError(String(e)))}>
          Deal the roles
        </button>
      ) : (
        <>
          <p className="note">The host deals the roles when everyone is in.</p>
          <button className="button ghost" onClick={() => void leaveRoom(room)}>
            Leave the room
          </button>
        </>
      )}
    </>
  );
}

// ---------- Game ----------

function Game({ room, data, uid }: { room: RoomDoc; data: RoomData; uid: string }) {
  const n = room.playerIds.length;
  const name = (p: string) => (p === uid ? 'You' : room.names[p]);
  const state = useMemo(
    () =>
      derive(
        { playerIds: room.playerIds, firstLeader: room.firstLeader, proposals: data.proposals, votes: data.votes, tallies: data.tallies, assassinated: room.assassinated },
        (p) => (data.secrets[p] ? data.secrets[p].role === 'merlin' : null),
      ),
    [room, data],
  );

  // Evil has won on quests or rejections: every phone sees it, and the first to say so ends the game.
  const over = state.phase.kind === 'over';
  useEffect(() => {
    if (over && room.status === 'playing') void finish(room.code).catch(() => {});
  }, [over, room.status, room.code]);

  return (
    <>
      {data.mine && room.status !== 'done' && <RoleCard secret={data.mine} name={name} />}
      <Board state={state} n={n} name={name} />
      <PhasePanel state={state} room={room} data={data} uid={uid} name={name} />
      <History state={state} name={name} />
      {room.status === 'done' && <Reveal room={room} secrets={data.secrets} name={name} />}
    </>
  );
}

/** Your role, shown only while you hold it, so a neighbour can't glance at it. */
function RoleCard({ secret, name }: { secret: Secret; name: (p: string) => string }) {
  const [shown, setShown] = useState(false);
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

function Board({ state, n, name }: { state: GameState; n: number; name: (p: string) => string }) {
  const leader = state.phase.kind === 'proposing' ? state.phase.leader : state.phase.kind === 'voting' || state.phase.kind === 'questing' ? state.phase.proposal.leader : null;
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
        <span className="note">{leader ? `Leader: ${name(leader)}` : ' '}</span>
        <span className="rejections" aria-label={`${state.rejections} of ${MAX_REJECTIONS} teams rejected`}>
          {Array.from({ length: MAX_REJECTIONS }, (_, i) => (
            <span key={i} className={i < state.rejections ? 'on' : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}

function PhasePanel({ state, room, data, uid, name }: { state: GameState; room: RoomDoc; data: RoomData; uid: string; name: (p: string) => string }) {
  const [error, setError] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => void p.then(() => setError(null), (e) => setError(e instanceof Error ? e.message : String(e)));
  const phase = state.phase;
  const team = (proposal: Proposal) => proposal.team.map(name).join(', ');
  let content: ReactNode;

  if (phase.kind === 'proposing') {
    content =
      phase.leader === uid ? (
        <TeamPicker room={room} size={phase.teamSize} name={name} onPropose={(t) => act(propose(room.code, state.quest, state.rejections, t))} />
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
          Team for quest {state.quest + 1}: <strong>{team(phase.proposal)}</strong>
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
          On quest {state.quest + 1}: <strong>{team(phase.proposal)}</strong>
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
  } else if (phase.kind === 'assassinating') {
    content =
      data.mine?.role === 'assassin' ? (
        <AssassinPicker room={room} uid={uid} name={name} onPick={(t) => act(assassinate(room.code, t))} />
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

function TeamPicker({ room, size, name, onPropose }: { room: RoomDoc; size: number; name: (p: string) => string; onPropose: (team: string[]) => void }) {
  const [team, setTeam] = useState<string[]>([]);
  // Functional, so quick taps in a row each count.
  const toggle = (p: string) => setTeam((current) => (current.includes(p) ? current.filter((t) => t !== p) : [...current, p]));
  return (
    <>
      <p className="lead-line">
        You lead. Choose {size} for the quest ({team.length} of {size}).
      </p>
      <div className="pick-list">
        {room.playerIds.map((p) => (
          <button key={p} className={team.includes(p) ? 'pick on' : 'pick'} aria-pressed={team.includes(p)} onClick={() => toggle(p)}>
            {name(p)}
          </button>
        ))}
      </div>
      <button className="button primary" disabled={team.length !== size} onClick={() => onPropose(room.playerIds.filter((p) => team.includes(p)))}>
        Propose this team
      </button>
    </>
  );
}

function AssassinPicker({ room, uid, name, onPick }: { room: RoomDoc; uid: string; name: (p: string) => string; onPick: (target: string) => void }) {
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <p className="lead-line">Good won three quests. Name Merlin to steal the win.</p>
      <div className="pick-list">
        {room.playerIds
          .filter((p) => p !== uid)
          .map((p) => (
            <button key={p} className={target === p ? 'pick on' : 'pick'} aria-pressed={target === p} onClick={() => setTarget(p)}>
              {name(p)}
            </button>
          ))}
      </div>
      <button className="button danger" disabled={!target} onClick={() => target && onPick(target)}>
        {target ? `Name ${name(target)} as Merlin` : 'Choose a player'}
      </button>
    </>
  );
}

/** The last vote and the quests so far. */
function History({ state, name }: { state: GameState; name: (p: string) => string }) {
  const last = state.votes.at(-1);
  if (!last && state.results.length === 0) return null;
  return (
    <div className="group card-pad history">
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
