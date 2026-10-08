import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Page } from '../../components/Page';
import { Lobby as LobbyFrame } from '../../components/RoomSetup';
import { replay, type Fighter, type Side } from '../../games/hero/state';
import { heroLevel, validTree } from '../../games/hero/stats';
import { heroReady, useHeroStore } from '../../heroStore';
import { forgetRoom } from '../../lastPage';
import { finishHeroRoom, joinHeroRoom, sendHeroMove, startHeroRoom, watchHeroRoom, type HeroRoom as Room, type HeroRoomData } from '../../services/hero';
import { useGameStore } from '../../store';
import { Fight } from './Fight';

/** A fight between two phones: each move is written to the room, and both replay them. */
export function HeroRoom() {
  const { code = '' } = useParams();
  const uid = useGameStore((s) => s.uid);
  const [data, setData] = useState<HeroRoomData>({ room: null, missing: false, moves: [] });
  useEffect(() => (uid ? watchHeroRoom(code, uid, setData) : undefined), [code, uid]);
  const ended = data.missing || data.room?.status === 'done' || (!!uid && !!data.room && data.room.status !== 'lobby' && !data.room.playerIds.includes(uid));
  useEffect(() => {
    if (ended) forgetRoom(`/hero/${code}`);
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
    <Page title={`Hero Gambit · ${code}`} back="/hero">
      {body}
    </Page>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <>
      <p className="note">{text}</p>
      <Link className="button" to="/hero">
        Back to your hero
      </Link>
    </>
  );
}

function NotIn({ room }: { room: Room }) {
  const [error, setError] = useState<string | null>(null);
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return <Gone text="This fight is already under way." />;
  const join = () => joinHeroRoom(room.code, () => useHeroStore.getState().tree, heroReady);
  return (
    <>
      <button className="button primary" onClick={() => void join().then(setError, (e) => setError(String(e)))}>
        Join room {room.code}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

const fighterOf = (room: Room, uid: string): Fighter | null => {
  const tree = validTree(room.fighters?.[uid]);
  return tree ? { name: room.names[uid] ?? 'Hero', tree } : null;
};

function Lobby({ room, uid }: { room: Room; uid: string }) {
  const [error, setError] = useState<string | null>(null);
  const ready = room.playerIds.length === 2;
  return (
    <LobbyFrame
      code={room.code}
      players={
        <ol className="group players">
          {room.playerIds.map((p) => {
            const f = fighterOf(room, p);
            return (
              <li key={p} className="row">
                <span>{p === uid ? 'You' : room.names[p]}</span>
                <span className="row-detail">
                  {f ? `Hero Lv ${heroLevel(f.tree)}` : ''}
                  {p === room.host ? ' · Host' : ''}
                </span>
              </li>
            );
          })}
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
            <button className="button primary" disabled={!ready} onClick={() => void startHeroRoom(room.code).catch((e) => setError(String(e)))}>
              {ready ? 'Start' : 'Waiting for a rival'}
            </button>
          ) : (
            <p className="note center-note">The host starts the fight.</p>
          )}
        </>
      }
    />
  );
}

function Game({ room, moves, uid }: { room: Room; moves: HeroRoomData['moves']; uid: string }) {
  const players = room.playerIds as [string, string];
  const [a, b] = useMemo(() => [fighterOf(room, players[0]), fighterOf(room, players[1])], [room, players]);
  const state = useMemo(() => (a && b ? replay(room.seed!, [a, b], players, moves) : null), [room.seed, a, b, players, moves]);
  const [error, setError] = useState<string | null>(null);
  // The move number being sent: the screen waits for the server to have it.
  const [sending, setSending] = useState<number | null>(null);
  useEffect(() => {
    if (sending !== null && moves.length > sending) setSending(null);
  }, [moves.length, sending]);
  // The result waits a moment, so the last hit shows first.
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (state?.winner === null || state?.winner === undefined) return;
    const t = setTimeout(() => setOver(true), 1200);
    return () => clearTimeout(t);
  }, [state?.winner]);

  useEffect(() => {
    if (state?.winner !== null && state?.winner !== undefined && room.status === 'playing') void finishHeroRoom(room.code).catch(() => {});
  }, [state?.winner, room.status, room.code]);

  if (!state || !a || !b) return <Gone text="This room's heroes couldn't be read." />;
  const me = players.indexOf(uid) as Side;
  const them = (me === 0 ? 1 : 0) as Side;
  const names: [string, string] = [a.name, b.name];

  return (
    <>
      <Fight
        state={state}
        me={me}
        names={names}
        waiting={sending !== null ? 'Sending your move…' : `${names[them]} is choosing…`}
        locked={sending !== null}
        onMove={(move) => {
          const n = moves.length;
          setError(null);
          setSending(n);
          void sendHeroMove(room.code, n, move).catch(() => {
            setSending(null);
            setError('That move didn’t go through. Check the connection and play it again.');
          });
        }}
      >
        {state.winner !== null && over && (
          <div className="overlay">
            <div className="panel" role="dialog" aria-label="Fight over">
              <p className="solved-title">{state.winner === me ? 'Victory' : 'Defeated'}</p>
              <p className="hero-result">{state.winner === me ? `You beat ${names[them]}` : `${names[them]} wins`}</p>
              <Link className="button primary" to="/hero/online">
                New fight
              </Link>
              <Link className="button ghost" to="/hero">
                Back to your hero
              </Link>
            </div>
          </div>
        )}
      </Fight>
      {error && <p className="error">{error}</p>}
    </>
  );
}
