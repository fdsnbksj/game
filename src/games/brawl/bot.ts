import { stream } from '../../nonogram/rng';
import { DODGE, DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from './input';
import { PLATFORMS, SUB } from './stage';
import { ICE_BASE, inPlay, isActive, nearest, skillOf, type Match } from './state';
import { RANGED, WEAPONS } from './weapons';

/**
 * A bot's input for this frame, worked out from the match alone, so a bot plays the same
 * on every phone. It thinks every few frames (slower when easier), and between thoughts it
 * only keeps moving. Bare-handed it runs for the nearest weapon; armed, it closes in with a
 * blade or keeps its distance with a bow or bombs; it rolls away from swings it sees coming;
 * knocked off, it fights its way back, laying ice to stand on when it's out of jumps.
 */
const THINK = [0, 14, 7, 3];
const AGGRESSION = [0, 0.35, 0.6, 0.85];
const DODGING = [0, 0, 0.2, 0.4];
/** How long a bot holds its heavy before letting go: harder bots charge it more. */
const CHARGE_WANT = [0, 6, 18, 34];

const EDGE = PLATFORMS[0].right;

/** Direction bits pointing from one spot to another, one of eight ways. */
function aimBits(dx: number, dy: number): Input {
  let bits = 0;
  if (Math.abs(dx) * 2 > Math.abs(dy)) bits |= dx > 0 ? RIGHT : LEFT;
  if (Math.abs(dy) * 2 > Math.abs(dx)) bits |= dy > 0 ? DOWN : UP;
  return bits;
}

export function botInput(m: Match, seat: number): Input {
  const me = m.fighters[seat];
  const level = m.seats[seat].bot || 2;
  if (!inPlay(me) || me.freeze > 0) return 0;
  const x = me.x / SUB;
  const y = me.y / SUB;
  const thinking = (m.frame + seat * 5) % THINK[level] === 0;
  const roll = stream(`${m.seed}:bot:${seat}:${m.frame}`);
  const chance = () => roll(1000) / 1000;
  const busy = me.skill !== 0 || me.hitstun > 0 || me.lag > 0;

  const offstage = x < -EDGE || x > EDGE || y > 0;

  // Charging a heavy: hold it a while, then let go aimed at the nearest fighter, or straight up to get home.
  if (me.charge > 0) {
    if (offstage) return UP;
    const t = nearest(m, seat);
    const aim = t >= 0 ? aimBits((m.fighters[t].x - me.x) / SUB, (m.fighters[t].y - me.y) / SUB) : 0;
    if (me.charge >= CHARGE_WANT[level]) return aim;
    return SKILL2 | (aim & (LEFT | RIGHT));
  }
  // Standing on ice out over the drop: jump back toward the island.
  if (me.platform >= ICE_BASE && offstage) {
    const home = x < 0 ? RIGHT : LEFT;
    return thinking && !busy && !(me.prevInput & JUMP) ? home | JUMP : home;
  }

  // Off the island: get back above it, then over it.
  if (me.platform < 0 && offstage) {
    let input = 0;
    const below = y > -10;
    if (below && Math.abs(x) < EDGE + 40) input |= x < 0 ? LEFT : RIGHT;
    else if (!below || Math.abs(x) > EDGE + 120) input |= x < 0 ? RIGHT : LEFT;
    if (!busy && (me.vy > 0 || y > -40) && thinking) {
      if (me.airJumps > 0 && !(me.prevInput & JUMP)) input |= JUMP;
      else if (!me.recoveryUsed && me.vy > 0) return SKILL2 | UP;
      else if (!me.iceUsed && me.vy > 0) return DODGE;
    }
    return input;
  }

  // Bare hands: a weapon nearby is worth more than a punch.
  if (me.weapon === 'fists' && m.items.length > 0) {
    let best = m.items[0];
    for (const it of m.items) if (Math.abs(it.x - me.x) + Math.abs(it.y - me.y) < Math.abs(best.x - me.x) + Math.abs(best.y - me.y)) best = it;
    const ix = (best.x - me.x) / SUB;
    const iy = (best.y - me.y) / SUB;
    const near = nearest(m, seat);
    const threat = near >= 0 && Math.abs(m.fighters[near].x - me.x) / SUB < 60 && Math.abs(m.fighters[near].y - me.y) / SUB < 60;
    if (!threat || level === 1) {
      let input = Math.abs(ix) > 12 ? (ix > 0 ? RIGHT : LEFT) : 0;
      if (thinking && !busy && iy < -60 && Math.abs(ix) < 180 && !(me.prevInput & JUMP)) input |= JUMP;
      if (me.platform > 0 && iy > 40 && Math.abs(ix) < 160) input |= DOWN;
      return input;
    }
  }

  const target = nearest(m, seat);
  if (target < 0) return 0;
  const them = m.fighters[target];
  const dx = (them.x - me.x) / SUB;
  const dy = (them.y - me.y) / SUB;
  const ranged = RANGED.includes(me.weapon);
  const reach = me.weapon === 'spear' || me.weapon === 'scythe' ? 100 : me.weapon === 'hammer' || me.weapon === 'sword' || me.weapon === 'axe' ? 70 : 45;
  const toward = dx > 0 ? RIGHT : LEFT;
  const theyAreOff = Math.abs(them.x / SUB) > EDGE || them.y / SUB > 0;
  let input = 0;

  // Close in (or, with a bow or bombs, hold a middle distance), but not off the edge.
  const nearEdge = me.platform === 0 && Math.abs(x) > EDGE - 30 && Math.sign(dx) === Math.sign(x);
  const want = ranged ? 180 : reach * 0.8;
  if (Math.abs(dx) > want && !(nearEdge && theyAreOff)) input |= toward;
  else if (ranged && Math.abs(dx) < 90 && !nearEdge) input |= dx > 0 ? LEFT : RIGHT;
  if (me.platform > 0 && dy > 60 && Math.abs(dx) < 140) input |= DOWN;

  if (!thinking || busy || skillOf(me)) return input;
  const r = chance();

  // A swing winding up close by: roll away from it.
  const theirs = skillOf(them);
  const coming = theirs !== null && !isActive(them, theirs) && them.skillFrame <= theirs.startup;
  if (coming && me.platform >= 0 && Math.abs(dx) < reach + 50 && Math.abs(dy) < 90 && me.dodgeCooldown === 0 && r < DODGING[level]) {
    return DODGE | (dx > 0 ? LEFT : RIGHT);
  }

  if (dy < -90 && Math.abs(dx) < 160 && (me.platform >= 0 || me.airJumps > 0) && !(me.prevInput & JUMP)) return input | JUMP;

  if (ranged) {
    if (r < AGGRESSION[level] * 0.6 && Math.abs(dx) < 420) {
      // A bomb lobs on its own; an arrow wants a straight line.
      const aim = me.weapon === 'bombs' ? aimBits(dx, 0) : aimBits(dx, dy);
      return (chance() < 0.3 ? SKILL2 : SKILL1) | aim;
    }
    return input;
  }

  if (Math.abs(dx) <= reach && Math.abs(dy) < 70 && r < AGGRESSION[level]) {
    const finish = them.damage >= 90 - level * 10 && chance() < 0.3 + level * 0.15;
    const strong = WEAPONS[me.weapon].skills[1];
    if (finish && strong.kind === 'melee') return SKILL2 | toward;
    return SKILL1 | (chance() < 0.5 ? toward : 0);
  }
  if (dy < -40 && Math.abs(dx) < 60 && r < AGGRESSION[level]) return SKILL1 | UP;
  return input;
}
