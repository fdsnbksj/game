import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SummaryRow } from '../../components/SummaryRow';
import { decodeLog, spawn, step, type Runner } from '../../games/traps/sim';
import { pickedItem, POINTS, TARGET, waitingOn, type Move, type RoundResult, type TrapsState } from '../../games/traps/state';
import { buildWorld, canPlace, ITEMS, TOWERS, type Cell, type ItemKind, type Placed, type World } from '../../games/traps/world';
import { draw, readPalette } from './render';
import { RunView, type Ghost } from './RunView';
import { TowerCanvas } from './TowerCanvas';

// Trap Tower's table, shared by a room (each phone acts for its own seat) and one phone
// passed round (it acts for whoever is next). The screen centres on what this phone has to
// do now: pick from the box, place it on the tower, or run. Scores sit in one line; when a
// round ends, every run of it climbs again at once, then the points.

export const ITEM_EMOJI: Record<ItemKind, string> = {
  block: '🟫',
  plank: '🪵',
  ice: '🧊',
  honey: '🍯',
  spring: '🌀',
  spikes: '🔺',
  saw: '⚙️',
  bow: '🏹',
  bomb: '💣',
};

/** A run under way: the tower as it was when it began, so it stays put if the round ends first. */
interface Running {
  seat: number;
  round: number;
  world: World;
  items: Placed[];
  ghosts: Ghost[];
}

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export function TrapsGame({
  state,
  actor,
  hotseat = false,
  nameOf,
  send,
  runKey,
  children,
}: {
  state: TrapsState;
  /** The seat this phone acts for now, or null while it waits on others. */
  actor: number | null;
  /** One phone passed round: ask for the next player before showing their turn. */
  hotseat?: boolean;
  nameOf: (seat: number) => string;
  send: (move: Move, seat: number) => Promise<void>;
  /** Names this game's runs for the run save, with the round and seat added. */
  runKey: string;
  /** What to offer once the game is over. */
  children?: ReactNode;
}) {
  const tower = TOWERS[state.tower];
  const world = useMemo(() => buildWorld(tower, state.items), [tower, state.items]);
  const palette = useMemo(readPalette, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [rot, setRot] = useState(0);
  const [handedTo, setHandedTo] = useState<string | null>(null);

  // A new phase or player clears the half-made placement.
  const turnKey = `${state.round}:${state.phase}:${actor}`;
  useEffect(() => {
    setCell(null);
    setRot(0);
    setError(null);
  }, [turnKey]);

  // A round that ends while you watch plays back; ones already over when the page opened don't.
  const seen = useRef(state.results.length);
  const [show, setShow] = useState<RoundResult | null>(null);
  useEffect(() => {
    if (state.results.length <= seen.current) return;
    seen.current = state.results.length;
    setShow(state.results.at(-1)!);
  }, [state.results]);

  const act = (move: Move, seat: number) => {
    setBusy(true);
    setError(null);
    return send(move, seat)
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      })
      .finally(() => setBusy(false));
  };

  const waiting = waitingOn(state);
  const scores = (
    <div className="traps-scores" aria-label="Scores">
      {state.scores.map((points, seat) => (
        <span key={seat} className={`traps-score seat-${seat}`}>
          <span className="traps-dot" aria-hidden="true" />
          {nameOf(seat)} <strong>{points}</strong>
        </span>
      ))}
    </div>
  );

  // Your run stays up over everything until you close it, even once the round (or game) is over.
  const runView = running && (
    <RunView
      key={`${running.round}:${running.seat}`}
      world={running.world}
      items={running.items}
      seat={running.seat}
      ghosts={running.ghosts}
      saveKey={`${runKey}:${running.round}:${running.seat}`}
      nameOf={nameOf}
      onSend={(log) => act({ type: 'run', round: running.round, log }, running.seat)}
      onClose={() => setRunning(null)}
    />
  );

  const roundShow = show && running === null && <RoundShow result={show} tower={state.tower} nameOf={nameOf} scores={state.scores} onClose={() => setShow(null)} />;

  if (state.winners) {
    const top = state.winners.map(nameOf);
    return (
      <>
        <div className="traps-result">
          <p className="micro">After {state.results.length} rounds</p>
          <strong>{top.length > 1 ? `${list(top)} share the win` : top[0] === 'You' ? 'You win!' : `${top[0]} wins`}</strong>
        </div>
        {scores}
        <TowerCanvas className="traps-small" paint={(ctx) => draw(ctx, palette, { world, tick: 0 }, state.items)} />
        {children}
        {runView}
        {roundShow}
      </>
    );
  }

  // One phone: hand it over before showing the next player's turn.
  if (hotseat && actor !== null && handedTo !== turnKey && running === null) {
    const verb = state.phase === 'pick' ? 'pick an item' : state.phase === 'place' ? 'place your item' : 'run';
    return (
      <>
        <Status state={state} line={`${nameOf(actor)}'s turn to ${verb}.`} scores={scores} />
        <div className="traps-handover">
          <p>Pass the phone to {nameOf(actor)}.</p>
          <button className="button primary" onClick={() => setHandedTo(turnKey)}>
            I'm {nameOf(actor)}
          </button>
        </div>
        {roundShow}
      </>
    );
  }

  const waitLine = `Waiting for ${list(waiting.map(nameOf))} to ${state.phase === 'pick' ? 'pick' : state.phase === 'place' ? 'place' : 'run'}.`;
  const preview = (extra?: Parameters<typeof draw>[2]['preview']) => (ctx: CanvasRenderingContext2D) => draw(ctx, palette, { world, tick: 0, grid: !!extra, preview: extra }, state.items);

  let body: ReactNode;
  if (actor === null) {
    body = (
      <>
        <Status state={state} line={waitLine} scores={scores} />
        <TowerCanvas className="traps-small" paint={preview()} />
      </>
    );
  } else if (state.phase === 'pick') {
    body = (
      <>
        <Status state={state} line={hotseat ? `${nameOf(actor)}: pick an item for the tower.` : 'Pick an item for the tower.'} scores={scores} />
        <div className="traps-box" role="group" aria-label="The box">
          {state.box.map((kind, i) => {
            const taker = state.picks.indexOf(i);
            return (
              <button key={i} className="traps-box-item" disabled={busy || taker >= 0} onClick={() => void act({ type: 'pick', round: state.round, index: i }, actor).catch(() => {})}>
                <span className="traps-box-emoji" aria-hidden="true">
                  {ITEM_EMOJI[kind]}
                </span>
                <strong>{ITEMS[kind].name}</strong>
                <small>{taker >= 0 ? `${nameOf(taker)} took it` : ITEMS[kind].hint}</small>
              </button>
            );
          })}
        </div>
        {error && <p className="error">{error}</p>}
        <TowerCanvas className="traps-small" paint={preview()} />
      </>
    );
  } else if (state.phase === 'place') {
    const kind = pickedItem(state, actor)!;
    const placing: Placed | null = cell ? { item: kind, x: cell.x, y: cell.y, rot: ITEMS[kind].turns ? rot : 0, by: actor } : null;
    const ok = !!placing && canPlace(tower, state.items, placing);
    body = (
      <>
        <Status state={state} line={cell ? (ok ? `Place your ${ITEMS[kind].name.toLowerCase()} here?` : 'Not there: pick an empty square.') : `Tap the tower where your ${ITEMS[kind].name.toLowerCase()} goes.`} scores={scores} />
        <TowerCanvas className="traps-big" paint={preview(placing && { item: placing, ok })} onCell={setCell} />
        {error && <p className="error">{error}</p>}
        <div className="traps-actions">
          {ITEMS[kind].turns && (
            <button className="button" onClick={() => setRot((r) => (r + 1) % 4)}>
              ↻ Turn
            </button>
          )}
          <button className="button primary" disabled={!ok || busy} onClick={() => placing && void act({ type: 'place', round: state.round, x: placing.x, y: placing.y, rot: placing.rot }, actor).catch(() => {})}>
            {ITEM_EMOJI[kind]} {kind === 'bomb' ? 'Set it off' : 'Place it'}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Status state={state} line={hotseat ? `${nameOf(actor)}: climb to the flag.` : 'Your run: climb to the flag.'} scores={scores} />
        <TowerCanvas className="traps-small" paint={preview()} />
        <button
          className="button primary"
          onClick={() =>
            setRunning({
              seat: actor,
              round: state.round,
              world,
              items: state.items,
              // Runs already in this round climb alongside.
              ghosts: state.runs.flatMap((r, seat) => (r ? [{ seat, inputs: decodeLog(r.log) ?? [] }] : [])),
            })
          }
        >
          Start your run
        </button>
      </>
    );
  }

  return (
    <>
      {body}
      <SummaryRow label="How to play" title="How to play">
        <HowTo />
      </SummaryRow>
      {runView}
      {roundShow}
    </>
  );
}

function Status({ state, line, scores }: { state: TrapsState; line: string; scores: ReactNode }) {
  return (
    <div className="traps-status">
      <span className="micro">
        Round {state.round + 1} · first to {TARGET} · {TOWERS[state.tower].name}
      </span>
      <strong>{line}</strong>
      {scores}
    </div>
  );
}

export function HowTo() {
  return (
    <div className="how-to">
      <p>Everyone climbs the same tower, from the start at the bottom to the flag at the top.</p>
      <p>Each round, a box of items opens and everyone picks one (first come, first served) and places it on the tower: planks to help, spikes, saws and crossbows to stop the others. A bomb clears what's around it.</p>
      <p>Then everyone runs, each on their own phone. Slide your thumb on the pad to run, flick up to jump; lift it to pause.</p>
      <p>
        Reach the flag for {POINTS.flag} points, {POINTS.first} more for the fastest. Your trap gets someone: {POINTS.trap}. But if everyone makes it, the tower was too easy and nobody scores. First to {TARGET} wins.
      </p>
    </div>
  );
}

const OUTCOME = (r: RoundResult['runs'][number], nameOf: (s: number) => string, seat: number) => {
  if (r.status === 'flag') return `made it in ${(r.ticks / 60).toFixed(1)} s`;
  if (r.status === 'time') return 'ran out of time';
  const what = r.cause === 'saw' ? 'saw' : r.cause === 'arrow' ? 'arrow' : 'spikes';
  const own = nameOf(seat) === 'You' ? 'your own' : 'their own';
  const whose = r.killer === null ? 'the' : r.killer === seat ? own : nameOf(r.killer) === 'You' ? 'your' : `${nameOf(r.killer)}’s`;
  return `hit ${whose} ${what}`;
};

/** A round's runs climbing at once over the tower as it was, then who scored. A tap skips ahead, then closes. */
function RoundShow({ result, tower, nameOf, scores, onClose }: { result: RoundResult; tower: number; nameOf: (s: number) => string; scores: number[]; onClose: () => void }) {
  const world = useMemo(() => buildWorld(TOWERS[tower], result.items), [tower, result.items]);
  const palette = useMemo(readPalette, []);
  const runs = useMemo(() => result.runs.map((r) => ({ inputs: decodeLog(r.log) ?? [], runner: spawn(world) as Runner })), [result, world]);
  const end = Math.max(...result.runs.map((r) => r.ticks));
  const tick = useRef(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      // Twice as fast as it was run, so a round's show stays short.
      for (let k = 0; k < 2 && tick.current < end; k++) {
        for (const r of runs) step(world, r.runner, r.inputs[r.runner.tick] ?? 0);
        tick.current++;
      }
      if (tick.current >= end) setDone(true);
      else frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [runs, world, end]);

  const skip = () => {
    if (done) return onClose();
    while (tick.current < end) {
      for (const r of runs) step(world, r.runner, r.inputs[r.runner.tick] ?? 0);
      tick.current++;
    }
    setDone(true);
  };

  const verdict = result.verdict === 'easy' ? 'Everyone made it: too easy, no points.' : result.verdict === 'none' ? 'Nobody made it: no points.' : 'Points this round';
  return (
    <div className="traps-show" role="dialog" aria-label="The round" onClick={skip}>
      <div className="traps-show-card">
        <p className="micro">Round {result.round + 1}</p>
        <TowerCanvas className="traps-show-tower" live={!done} paint={(ctx) => draw(ctx, palette, { world, tick: tick.current, figures: runs.map((r, seat) => ({ r: r.runner, seat })) }, result.items)} />
        {done ? (
          <>
            <strong>{verdict}</strong>
            <ul className="traps-show-list">
              {result.runs.map((r, seat) => (
                <li key={seat} className={`seat-${seat}`}>
                  <span className="traps-dot" aria-hidden="true" />
                  <span>
                    {nameOf(seat)} {OUTCOME(r, nameOf, seat)}
                  </span>
                  <strong>{result.points[seat] ? `+${result.points[seat]}` : ''}</strong>
                  <span className="row-detail">{scores[seat]}</span>
                </li>
              ))}
            </ul>
            <span className="note">Tap to carry on</span>
          </>
        ) : (
          <span className="note">Tap to skip</span>
        )}
      </div>
    </div>
  );
}
