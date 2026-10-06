import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { FIGHTER_IDS, FIGHTERS, type FighterId } from '../../games/brawl/fighters';
import { decode, encode, type Message } from '../../games/brawl/net';
import { Session } from '../../games/brawl/rollback';
import { newMatch, type Match } from '../../games/brawl/state';
import { forgetRoom } from '../../lastPage';
import {
  connect,
  finishBrawl,
  joinBrawl,
  MAX_ATTEMPTS,
  newRematchSeed,
  nextAttempt,
  pickFighter,
  startBrawl,
  watchAttempts,
  watchBrawl,
  type Brawl,
  type BrawlData,
  type Link as PeerLink,
} from '../../services/brawl';
import { useGameStore } from '../../store';
import { Arena, STEP_MS, type Driver } from './Arena';
import { WeaponGlyph } from './Weapons';

/** Quiet this long and the other phone is shown as waited for; this long and it's gone. */
const QUIET_MS = 1000;
const GONE_MS = 15_000;
const REMATCH_RESEND_MS = 250;

export function BrawlRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<BrawlData>({ room: null, missing: false });
  useEffect(() => watchBrawl(code, setData), [code]);
  const room = data.room;
  // Home offers this room until its fight is over, or it's gone, or you're not in it.
  const ended = data.missing || room?.status === 'done' || (!!uid && !!room && room.status !== 'lobby' && !room.playerIds.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/brawl/${code}`);
  }, [ended, code]);

  if (uid && room && room.status === 'playing' && room.seed && room.playerIds.includes(uid) && room.playerIds.length === 2) {
    return <OnlineFight room={room} uid={uid} />;
  }

  let body: ReactNode;
  if (!uid) body = <p className="note">Connecting…</p>;
  else if (data.missing) body = <Gone text={`There's no room ${code}.`} />;
  else if (!room) body = <div className="spinner" aria-label="Loading" />;
  else if (room.status === 'done') body = <Gone text="This fight is over." />;
  else if (!room.playerIds.includes(uid)) body = <NotIn room={room} />;
  else body = <Lobby room={room} uid={uid} />;

  return (
    <Page title={`Sky Brawl · ${code}`} back="/brawl/online">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <p className="note">{text}</p>
      <Link className="button primary" to="/brawl/online">
        Open or join another room
      </Link>
      <Link className="button ghost" to="/brawl">
        Fight bots
      </Link>
    </div>
  );
}

function NotIn({ room }: { room: Brawl }) {
  const [error, setError] = useState<string | null>(null);
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return <Gone text="This fight is already under way." />;
  return (
    <>
      <button className="button primary" onClick={() => void joinBrawl(room.code).then(setError, (e) => setError(String(e)))}>
        Join room {room.code}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Lobby({ room, uid }: { room: Brawl; uid: string }) {
  const [error, setError] = useState<string | null>(null);
  const ready = room.playerIds.length === 2;
  const mine = room.fighters[uid] ?? 'knight';
  const pick = (fighter: FighterId) => void pickFighter(room.code, fighter).catch((e) => setError(String(e)));
  return (
    <LobbyFrame
      code={room.code}
      players={
        <>
          <ol className="group players">
            {room.playerIds.map((p) => (
              <li key={p} className="row">
                <span>{p === uid ? 'You' : room.names[p]}</span>
                <span className="row-detail">{FIGHTERS[room.fighters[p] ?? 'knight'].name}</span>
              </li>
            ))}
            {!ready && (
              <li className="row">
                <span className="note">Waiting for a rival…</span>
              </li>
            )}
          </ol>
          <div className="brawl-fighters" role="radiogroup" aria-label="Your fighter">
            {FIGHTER_IDS.map((id) => (
              <button key={id} className="brawl-fighter" role="radio" aria-checked={mine === id} onClick={() => pick(id)}>
                <span className="game-glyph brawl">
                  <WeaponGlyph fighter={id} />
                </span>
                <strong>{FIGHTERS[id].name}</strong>
                <small>{FIGHTERS[id].blurb}</small>
              </button>
            ))}
          </div>
          <p className="note center-note">Best on the same Wi-Fi. Some mobile networks can't connect two phones directly.</p>
        </>
      }
      action={
        <>
          {error && <p className="error">{error}</p>}
          {room.host === uid ? (
            <button className="button primary" disabled={!ready} onClick={() => void startBrawl(room.code).catch((e) => setError(String(e)))}>
              {ready ? 'Fight' : 'Waiting for a rival'}
            </button>
          ) : (
            <p className="note center-note">The host starts the fight.</p>
          )}
        </>
      }
    />
  );
}

// ---------- The fight ----------

type Phase = 'connecting' | 'failed' | 'fighting' | 'lost';
type Lost = 'left' | 'quiet' | 'closed' | 'desync';

/**
 * A fight with the other phone. Connects (the host offers, the guest answers), then each
 * phone runs the same match with rollback. If the phones can't reach each other, says so
 * and offers bots; if the other phone goes quiet, waits, then gives up.
 */
function OnlineFight({ room, uid }: { room: Brawl; uid: string }) {
  const navigate = useNavigate();
  const host = room.host === uid;
  const local = room.playerIds.indexOf(uid);
  const other = room.playerIds[1 - local];
  const otherName = room.names[other] ?? 'Your rival';
  const seats = useMemo(
    () => room.playerIds.map((p) => ({ fighter: (room.fighters[p] ?? 'knight') as FighterId, bot: 0 as const })),
    [room.playerIds, room.fighters],
  );

  const [phase, setPhase] = useState<Phase>('connecting');
  const [lost, setLost] = useState<Lost>('closed');
  const [tries, setTries] = useState(0);
  const [round, setRound] = useState(0);
  const [ended, setEnded] = useState<Match | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Counts connections, so a reconnect starts the arena afresh.
  const [connection, setConnection] = useState(0);
  const waitingRef = useRef(false);

  const link = useRef<PeerLink | null>(null);
  const session = useRef<Session | null>(null);
  const lastHeard = useRef(0);
  const rematch = useRef<{ round: number; seed: string; sentAt: number } | null>(null);
  const over = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const send = (msg: Message) => {
    const channel = link.current?.channel;
    if (channel?.readyState !== 'open') return;
    try {
      channel.send(encode(msg));
    } catch {
      // A full or closing channel: the next frame sends again.
    }
  };

  const startRound = (r: number, seed: string) => {
    session.current = new Session(newMatch(seed, seats), local, r);
    lastHeard.current = performance.now();
    over.current = false;
    setEnded(null);
    setRound(r);
  };

  const loseWith = (why: Lost) => {
    if (phaseRef.current !== 'fighting') return;
    setLost(why);
    setPhase('lost');
    link.current?.close();
    link.current = null;
  };

  const onLink = (l: PeerLink) => {
    link.current = l;
    l.channel.addEventListener('message', (event) => {
      const msg = decode(String(event.data));
      if (!msg) return;
      lastHeard.current = performance.now();
      if (msg.t === 'bye') return loseWith('left');
      if (msg.t === 'rematch') {
        if (session.current && msg.round > session.current.round) startRound(msg.round, msg.seed);
        return;
      }
      if (msg.t === 'in' && rematch.current && msg.round === rematch.current.round) rematch.current = null;
      session.current?.receive(msg);
    });
    l.channel.addEventListener('close', () => loseWith('closed'));
    startRound(0, room.seed!);
    setConnection((c) => c + 1);
    setPhase('fighting');
  };

  // The host offers a connection; the guest answers whichever offer is newest.
  useEffect(() => {
    if (!host) return;
    const abort = new AbortController();
    setPhase('connecting');
    void (async () => {
      try {
        const attempt = await nextAttempt(room.code);
        if (attempt >= MAX_ATTEMPTS) throw new Error('too many');
        const l = await connect(room.code, true, attempt, abort.signal);
        if (abort.signal.aborted) return l.close();
        onLink(l);
      } catch {
        if (!abort.signal.aborted) setPhase('failed');
      }
    })();
    return () => abort.abort();
    // A new attempt for each "Try again".
  }, [host, room.code, tries]);

  useEffect(() => {
    if (host) return;
    let current: AbortController | null = null;
    let answered = -1;
    const stop = watchAttempts(room.code, (attempt) => {
      if (attempt <= answered) return;
      answered = attempt;
      current?.abort();
      const abort = new AbortController();
      current = abort;
      setPhase('connecting');
      connect(room.code, false, attempt, abort.signal).then(
        (l) => (abort.signal.aborted ? l.close() : onLink(l)),
        () => {
          if (!abort.signal.aborted) setPhase('failed');
        },
      );
    });
    return () => {
      stop();
      current?.abort();
    };
  }, [host, room.code]);

  // Leaving the screen tells the other phone, and closes the connection.
  useEffect(
    () => () => {
      for (let i = 0; i < 3; i++) send({ t: 'bye' });
      link.current?.close();
    },
    [],
  );

  const driver = useMemo<Driver>(() => {
    let carry = 0;
    return {
      local,
      run(elapsed, thumb) {
        const s = session.current!;
        const now = performance.now();
        s.settle();
        carry = Math.min(carry + elapsed, STEP_MS * 4);
        while (carry >= STEP_MS) {
          carry -= STEP_MS;
          if (!s.canAdvance()) {
            carry = 0;
            break;
          }
          // Sitting out a frame now and then lets the phone behind catch up.
          if (!s.shouldWait()) s.advance(thumb());
        }
        send(s.inputMessage());
        for (const msg of s.takeOutbox()) send(msg);
        if (rematch.current && now - rematch.current.sentAt > REMATCH_RESEND_MS) {
          send({ t: 'rematch', round: rematch.current.round, seed: rematch.current.seed });
          rematch.current.sentAt = now;
        }

        const quiet = now - lastHeard.current;
        if (quiet > QUIET_MS !== waitingRef.current) {
          waitingRef.current = quiet > QUIET_MS;
          setWaiting(waitingRef.current);
        }
        if (quiet > GONE_MS) loseWith('quiet');
        if (s.desync) loseWith('desync');
        if (s.over && !over.current) {
          over.current = true;
          setEnded(s.match);
        }
        return s.match;
      },
    };
    // One driver for the screen; it reads everything else through refs.
  }, [local]);

  const leave = () => {
    for (let i = 0; i < 3; i++) send({ t: 'bye' });
    link.current?.close();
    link.current = null;
    forgetRoom(`/brawl/${room.code}`);
    void finishBrawl(room.code).catch(() => {});
    navigate('/brawl');
  };

  const again = () => {
    const seed = newRematchSeed();
    const r = (session.current?.round ?? 0) + 1;
    rematch.current = { round: r, seed, sentAt: 0 };
    startRound(r, seed);
  };

  if (phase === 'connecting' || phase === 'failed') {
    return (
      <Page title={`Sky Brawl · ${room.code}`} back="/brawl/online">
        <div className="empty-state">
          {phase === 'connecting' ? (
            <>
              <div className="spinner" aria-label="Connecting" />
              <p className="note">Connecting to {otherName}…</p>
            </>
          ) : (
            <>
              <p className="brawl-result">Couldn't connect</p>
              <p className="note">Your phones couldn't reach each other on these networks. The same Wi-Fi usually works; two mobile networks often don't.</p>
              {host ? (
                <button className="button primary" onClick={() => setTries((t) => t + 1)}>
                  Try again
                </button>
              ) : (
                <p className="note">Waiting for {otherName} to try again…</p>
              )}
            </>
          )}
          <button className="button ghost" onClick={leave}>
            Fight bots instead
          </button>
        </div>
      </Page>
    );
  }

  const match = session.current!.match;
  const labels = match.seats.map((_, i) => (i === local ? 'You' : otherName));
  const won = ended?.winner === local;

  return (
    <Arena
      key={`${connection}:${round}`}
      driver={driver}
      initial={match}
      labels={labels}
      blocked={phase === 'lost'}
      action={
        <button className="icon-button" aria-label="Leave" onClick={() => setLeaving(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      {waiting && phase === 'fighting' && !ended && <p className="brawl-waiting">Waiting for {otherName}…</p>}
      {phase === 'lost' && (
        <div className="overlay">
          <div className="panel" role="dialog" aria-label="Connection lost">
            <p className="brawl-result">{lost === 'left' ? `${otherName} left` : lost === 'desync' ? 'Out of step' : 'Connection lost'}</p>
            <p className="note">
              {lost === 'desync' ? 'The two phones stopped agreeing on the fight, so it ended.' : lost === 'left' ? 'The fight is over.' : `${otherName}'s phone stopped answering.`}
            </p>
            {host && lost !== 'left' && (
              <button
                className="button primary"
                onClick={() => {
                  setPhase('connecting');
                  setTries((t) => t + 1);
                }}
              >
                Reconnect
              </button>
            )}
            <button className={host && lost !== 'left' ? 'button ghost' : 'button primary'} onClick={leave}>
              Fight bots
            </button>
          </div>
        </div>
      )}
      {ended && phase === 'fighting' && (
        <div className="overlay">
          <div className="panel" role="dialog" aria-label="Fight over">
            <p className="solved-title">Fight over</p>
            <p className="brawl-result">{won ? 'You win' : `${otherName} wins`}</p>
            <p className="note">
              {ended.fighters[local].kos} {ended.fighters[local].kos === 1 ? 'knockout' : 'knockouts'} · {ended.fighters[local].dealt}% damage dealt
            </p>
            {host ? (
              <button className="button primary" onClick={again}>
                Rematch
              </button>
            ) : (
              <p className="note center-note">{otherName} can start a rematch.</p>
            )}
            <button className="button ghost" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}
      {leaving && !ended && phase === 'fighting' && (
        <div className="overlay">
          <div className="panel" role="dialog" aria-label="Leave the fight">
            <p className="brawl-result">Leave the fight?</p>
            <p className="note">{otherName} will see that you left.</p>
            <button className="button primary" onClick={() => setLeaving(false)}>
              Keep fighting
            </button>
            <button className="button ghost" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}
    </Arena>
  );
}
