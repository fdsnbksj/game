import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { GAME_GLYPHS } from './GameGlyphs';
import { zoneOf } from '../screens/world/zones';
import { useGameStore } from '../store';
import { Page } from './Page';
import { Sheet } from './Sheet';

/**
 * A party game's front door: what it is in a line, Host a game, Join with a code, and
 * the rules a tap away. Shared by every party game.
 */
export function GameHome({
  title,
  tagline,
  base,
  back,
  howTo,
  onHost,
  onJoin,
}: {
  title: string;
  tagline: string;
  /** Where rooms live: `/avalon`, `/duel`, `/wonders`, `/isle`. */
  base: string;
  /** Where the back arrow goes; the game's zone unless given. */
  back?: string;
  howTo: ReactNode;
  onHost: () => Promise<string>;
  /** Joins; returns why not, or null. */
  onJoin: (code: string) => Promise<string | null>;
}) {
  const navigate = useNavigate();
  const ready = useGameStore((s) => s.player !== null);
  // The game this door belongs to, from its base path, for its emblem and the way back to its zone.
  const gameId = base.slice(1) as keyof typeof GAME_GLYPHS;
  const Glyph = GAME_GLYPHS[gameId];
  const [joining, setJoining] = useState(false);
  const [rules, setRules] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const room = await action();
      if (room) navigate(`${base}/${room}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={title} back={back ?? `/zone/${zoneOf(gameId)?.id ?? ''}`}>
      <section className="door-hero frame">
        {Glyph && (
          <span className={`game-glyph ${gameId}`}>
            <Glyph />
          </span>
        )}
        <h2 className="ribbon">{title}</h2>
        <p className="note">{tagline}</p>
      </section>
      {!ready && <p className="note">Connecting…</p>}
      <div className="front-door">
        <button className="button primary" disabled={!ready || busy} onClick={() => void run(onHost)}>
          Host a game
        </button>
        {joining ? (
          <form
            className="join-inline"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const room = code.trim().toUpperCase();
                const problem = await onJoin(room);
                if (problem) {
                  setError(problem);
                  return null;
                }
                return room;
              });
            }}
          >
            <input
              className="field code-field"
              placeholder="CODE"
              maxLength={4}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button className="button" disabled={!ready || busy || code.length !== 4}>
              Join
            </button>
          </form>
        ) : (
          <button className="button" disabled={!ready} onClick={() => setJoining(true)}>
            Join with a code
          </button>
        )}
        {error && <p className="error">{error}</p>}
        <button className="button ghost" onClick={() => setRules(true)}>
          How to play
        </button>
      </div>
      {rules && (
        <Sheet title={`How to play ${title}`} onClose={() => setRules(false)}>
          <div className="how-to">{howTo}</div>
          <button className="button" onClick={() => setRules(false)}>
            Got it
          </button>
        </Sheet>
      )}
    </Page>
  );
}

/**
 * A lobby: the code to read out, who's in, and one main button. Every setting folds
 * under Options, so the screen stays simple until someone wants them.
 */
export function Lobby({ code, players, options, action }: { code: string; players: ReactNode; options?: ReactNode; action: ReactNode }) {
  const [showOptions, setShowOptions] = useState(false);
  return (
    <>
      <div className="room-code frame">
        <span className="micro">Room code</span>
        <strong>{code}</strong>
        <span className="note">Friends tap “Join with a code” and type it in.</span>
      </div>
      {players}
      {options && (
        <>
          <button className="button ghost options-toggle" aria-expanded={showOptions} onClick={() => setShowOptions(!showOptions)}>
            {showOptions ? 'Hide options' : 'Options ›'}
          </button>
          {showOptions && <div className="lobby-options">{options}</div>}
        </>
      )}
      <div className="lobby-action">{action}</div>
    </>
  );
}
