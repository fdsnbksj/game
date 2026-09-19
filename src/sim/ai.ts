import { getUnit, MAX_ROUNDS, type TraitId } from './balance';
import type { Placed } from './combat';
import { copies } from './economy';
import { autoFill, boardUnits, buy, buyXp, move, newRun, nextRound, ownedUnits, reroll, sell, type RunState } from './planning';
import { stream } from './rng';

// Opponents for when there's no ghost to fight. A bot plays a whole run with the same shop,
// economy and rules as a player, so its boards are always ones a player could have had.

const TARGET_LEVEL = [0, 1, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7];
const FOCUSES: TraitId[] = ['voltage', 'glitch', 'chrome', 'bruiser', 'striker', 'caster'];

export interface AiOpponent {
  name: string;
  units: Placed[];
}

/** The bot's board at `round`. The same seed and round always give the same board. */
export function aiOpponent(seed: string, round: number): AiOpponent {
  const rng = stream(`${seed}:ai`);
  const focus = FOCUSES[rng(FOCUSES.length)];
  let run = newRun(`${seed}:ai`);
  for (let r = 1; r <= Math.min(round, MAX_ROUNDS); r++) {
    run = plan(run, focus);
    // Bots win every other round, for a middling economy.
    if (r < round) run = nextRound(run, r % 2 === 0);
  }
  return { name: BOT_NAMES[rng(BOT_NAMES.length)], units: boardUnits(run) };
}

const BOT_NAMES = ['Circuit', 'Neon', 'Static', 'Pulse', 'Vector', 'Glow', 'Flux', 'Byte'];

function wants(unitId: string, focus: TraitId, run: RunState): number {
  const unit = getUnit(unitId);
  const owned = ownedUnits(run).filter((u) => u.unitId === unitId).length;
  return (unit.origin === focus || unit.role === focus ? 3 : 0) + owned * 2 + unit.cost;
}

function plan(start: RunState, focus: TraitId): RunState {
  let run = start;
  const reserve = run.round >= 5 ? 10 : 0;

  if (run.level < TARGET_LEVEL[run.round] && run.gold >= 4 + reserve) run = buyXp(run);

  for (let pass = 0; pass < 3; pass++) {
    const order = run.shop
      .map((unitId, index) => ({ unitId, index }))
      .filter((slot): slot is { unitId: string; index: number } => slot.unitId !== null)
      .sort((x, y) => wants(y.unitId, focus, run) - wants(x.unitId, focus, run) || x.index - y.index);
    for (const slot of order) {
      if (run.gold - getUnit(slot.unitId).cost < reserve) continue;
      if (!run.bench.includes(null)) run = sellWeakestBench(run, focus);
      run = buy(run, slot.index);
    }
    if (pass < 2 && run.gold >= reserve + 6) run = reroll(run);
    else break;
  }

  return arrange(run, focus);
}

function value(unitId: string, star: number, focus: TraitId): number {
  const unit = getUnit(unitId);
  return unit.cost * copies(star) * 10 + (unit.origin === focus || unit.role === focus ? 5 : 0);
}

function sellWeakestBench(run: RunState, focus: TraitId): RunState {
  let weakest = -1;
  run.bench.forEach((unit, index) => {
    if (!unit) return;
    if (weakest < 0 || value(unit.unitId, unit.star, focus) < value(run.bench[weakest]!.unitId, run.bench[weakest]!.star, focus)) {
      weakest = index;
    }
  });
  return weakest < 0 ? run : sell(run, { area: 'bench', index: weakest });
}

/** Puts the strongest units on the board: bruisers in front, casters at the back. */
function arrange(start: RunState, focus: TraitId): RunState {
  let run = start;
  // Clear the board onto the bench, then place the best.
  for (let cell = 0; cell < run.board.length; cell++) {
    const free = run.bench.indexOf(null);
    if (run.board[cell] && free >= 0) run = move(run, { area: 'board', index: cell }, { area: 'bench', index: free });
  }
  const picks = run.bench
    .map((unit, index) => ({ unit, index }))
    .filter((slot) => slot.unit !== null)
    .sort((x, y) => value(y.unit!.unitId, y.unit!.star, focus) - value(x.unit!.unitId, x.unit!.star, focus) || x.index - y.index)
    .slice(0, run.level);
  const front = [3, 2, 4, 1, 5, 0, 6];
  const back = [24, 23, 25, 22, 26, 21, 27];
  const middle = [10, 9, 11, 8, 12, 7, 13];
  for (const pick of picks) {
    const role = getUnit(pick.unit!.unitId).role;
    const preferred = role === 'caster' ? [...back, ...middle, ...front] : role === 'bruiser' ? [...front, ...middle, ...back] : [...middle, ...front, ...back];
    const cell = preferred.find((c) => !run.board[c]);
    if (cell !== undefined) run = move(run, { area: 'bench', index: pick.index }, { area: 'board', index: cell });
  }
  return autoFill(run);
}
