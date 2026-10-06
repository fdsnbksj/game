import { stream } from '../../nonogram/rng';
import { FIGHTERS } from './fighters';
import { DODGE, DOWN, HEAVY, JUMP, LEFT, LIGHT, RIGHT, UP, type Input } from './input';
import { BODY_W, PLATFORMS, SUB } from './stage';
import { inPlay, isActive, moveOf, type Match } from './state';

/**
 * A bot's input for this frame, worked out from the match alone, so a bot plays the same
 * on every phone. It thinks every few frames (slower when easier), and between thoughts it
 * only keeps moving. It walks toward the nearest fighter, swings when in reach, dodges
 * what it sees coming, and fights its way back to the island when knocked off.
 */
const THINK = [0, 14, 7, 3];
const AGGRESSION = [0, 0.35, 0.6, 0.85];
const DODGING = [0, 0, 0.2, 0.4];

const EDGE = PLATFORMS[0].right;

export function botInput(m: Match, seat: number): Input {
  const me = m.fighters[seat];
  const level = m.seats[seat].bot || 2;
  if (!inPlay(me) || me.freeze > 0) return 0;
  const x = me.x / SUB;
  const y = me.y / SUB;
  const thinking = (m.frame + seat * 5) % THINK[level] === 0;
  const roll = stream(`${m.seed}:bot:${seat}:${m.frame}`);
  const chance = () => roll(1000) / 1000;
  const busy = me.move !== null || me.hitstun > 0 || me.lag > 0 || me.dodge > 0;

  // Off the island: get back above it, then over it.
  if (me.platform < 0 && (x < -EDGE || x > EDGE || y > 0)) {
    let input = 0;
    const below = y > -10;
    if (below && Math.abs(x) < EDGE + 40) input |= x < 0 ? LEFT : RIGHT;
    else if (!below || Math.abs(x) > EDGE + 120) input |= x < 0 ? RIGHT : LEFT;
    if (!busy && (me.vy > 0 || y > -40) && thinking) {
      if (me.airJumps > 0 && !(me.prevInput & JUMP)) input |= JUMP;
      else if (!me.recoveryUsed && me.vy > 0) input |= HEAVY | UP;
    }
    return input;
  }

  let target = -1;
  let best = Infinity;
  m.fighters.forEach((f, i) => {
    if (i === seat || !inPlay(f)) return;
    const d = Math.abs(f.x - me.x) + Math.abs(f.y - me.y);
    if (d < best) {
      best = d;
      target = i;
    }
  });
  if (target < 0) return 0;

  const them = m.fighters[target];
  const dx = (them.x - me.x) / SUB;
  const dy = (them.y - me.y) / SUB;
  const reach = BODY_W / 2 + (m.seats[seat].fighter === 'lancer' ? 70 : 50);
  const toward = dx > 0 ? RIGHT : LEFT;
  const theyAreOff = Math.abs(them.x / SUB) > EDGE || them.y / SUB > 0;
  let input = 0;

  // Close in, but don't walk off the edge after someone who's already off it.
  const nearEdge = me.platform === 0 && Math.abs(x) > EDGE - 30 && Math.sign(dx) === Math.sign(x);
  if (Math.abs(dx) > reach * 0.8 && !(nearEdge && theyAreOff)) input |= toward;
  // Below on a soft ledge: drop down to them.
  if (me.platform > 0 && dy > 60 && Math.abs(dx) < 140) input |= DOWN;

  if (!thinking || busy) return input;
  const r = chance();

  const theirMove = moveOf(m, target);
  const incoming = theirMove !== null && !isActive(them, theirMove) && them.moveFrame <= theirMove.startup;
  if (incoming && Math.abs(dx) < reach + 40 && Math.abs(dy) < 90 && me.dodgeCooldown === 0 && r < DODGING[level]) {
    return DODGE | (dx > 0 ? LEFT : RIGHT);
  }

  if (dy < -90 && Math.abs(dx) < 160 && (me.platform >= 0 || me.airJumps > 0) && !(me.prevInput & JUMP)) return input | JUMP;

  if (Math.abs(dx) <= reach && Math.abs(dy) < 70 && r < AGGRESSION[level]) {
    const finish = them.damage >= 90 - level * 10 && chance() < 0.3 + level * 0.15;
    if (finish) return HEAVY | toward;
    if (me.platform < 0 && dy > 30) return LIGHT | DOWN;
    return LIGHT | (chance() < 0.6 ? toward : 0);
  }
  if (dy < -40 && Math.abs(dx) < 60 && r < AGGRESSION[level]) return LIGHT | UP;

  // Wary of a strong opponent, the hard bot sometimes uses a heavy that reaches further.
  if (level === 3 && Math.abs(dx) < reach + 30 && Math.abs(dy) < 50 && r > 0.9 && FIGHTERS[m.seats[seat].fighter].weapon !== 'hammer') {
    return HEAVY | toward;
  }
  return input;
}
