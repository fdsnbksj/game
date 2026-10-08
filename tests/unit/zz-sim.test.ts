import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { botInput } from '../../src/games/brawl/bot';
import { newMatch, step, type BotLevel, type Rules } from '../../src/games/brawl/state';
import { STAGES } from '../../src/games/brawl/stages';
it('sim', () => {
  const rows: string[] = [];
  let stuck = 0, total = 0, maxT = 0;
  for (const rules of [{ mode: 'score', value: 3 }, { mode: 'score', value: 5 }, { mode: 'timed', value: 3 }] as Rules[])
  for (const level of [1, 2, 3] as BotLevel[]) for (const n of [2, 3, 4]) for (let s = 0; s < 6; s++) {
    let m = newMatch(`s${level}${n}${s}`, Array.from({ length: n }, () => ({ bot: level })), rules);
    while (m.winner === null && m.frame < 60 * 60 * 12) m = step(m, m.seats.map((_, i) => botInput(m, i)));
    total++; if (m.winner === null) { stuck++; if (stuck < 10) rows.push(`stuck ${rules.mode}${rules.value} L${level} n${n} s${s} stage ${STAGES[m.stage].id} round ${m.round} pos=${m.fighters.map(f=>f.alive?`${Math.round(f.x/100)},${Math.round(f.y/100)}`:'x')}`); }
    maxT = Math.max(maxT, m.frame / 60);
  }
  rows.push(`stuck ${stuck}/${total} longest ${maxT.toFixed(0)}s`);
  writeFileSync('/private/tmp/claude-501/-Users-yiwei-game/6bbb5e2d-8bdd-4d43-b2d6-f97df4c2e43b/scratchpad/sim.txt', rows.join('\n'));
});
