import { stream } from '../../nonogram/rng';
import { DODGE, DOWN, JUMP, LEFT, RIGHT, SKILL1, SKILL2, UP, type Input } from './input';
import { SUB } from './stages';
import { attackOf, inPlay, isActive, nearest, stageOf, surface, type Match } from './state';
import { RANGED } from './weapons';

/**
 * A bot's input for this frame, worked out from the match alone, so a bot plays the same
 * on every phone. It thinks every few frames (slower when easier), and between thoughts it
 * only keeps moving. Bare-handed it runs for the nearest weapon; with a gun it gets level
 * with someone and shoots; with a blade it closes in; empty, it throws. It rolls away from
 * swings it sees coming, and when knocked off it heads back to solid ground, dashing when
 * it's out of jumps, or climbs back up from the floor.
 */
const THINK = [0, 14, 7, 3];
const AGGRESSION = [0, 0.35, 0.6, 0.85];
const DODGING = [0, 0, 0.2, 0.4];
/** How long a bot holds its heavy before letting go: harder bots charge it more. */
const CHARGE_WANT = [0, 6, 18, 34];

/** Direction bits pointing from one spot to another, one of eight ways. */
function aimBits(dx: number, dy: number): Input {
  let bits = 0;
  if (Math.abs(dx) * 2 > Math.abs(dy)) bits |= dx > 0 ? RIGHT : LEFT;
  if (Math.abs(dy) * 2 > Math.abs(dx)) bits |= dy > 0 ? DOWN : UP;
  return bits;
}

const surfaceSoft = (m: Match, platform: number) => surface(m, platform)?.soft ?? false;

export function botInput(m: Match, seat: number): Input {
  const me = m.fighters[seat];
  const level = m.seats[seat].bot || 2;
  if (!inPlay(me) || me.freeze > 0) return 0;
  const x = me.x / SUB;
  const y = me.y / SUB;
  const thinking = (m.frame + seat * 5) % THINK[level] === 0;
  const roll = stream(`${m.seed}:bot:${seat}:${m.frame}`);
  const chance = () => roll(1000) / 1000;
  const busy = me.move !== 0 || me.hitstun > 0 || me.lag > 0;

  // The nearest safe ground, and whether we're off it (beside it or below its top).
  const safe = stageOf(m).safe;
  let home = safe[0];
  for (const s of safe) if (Math.abs((s.left + s.right) / 2 - x) < Math.abs((home.left + home.right) / 2 - x)) home = s;
  const offstage = me.platform < 0 && (x < home.left - 10 || x > home.right + 10 || y > home.top);
  const homeX = (home.left + home.right) / 2;

  // Charging a heavy: hold it a while, then let go aimed at the nearest fighter, or straight up to get home.
  if (me.charge > 0) {
    if (offstage) return UP;
    const t = nearest(m, seat);
    const aim = t >= 0 ? aimBits((m.fighters[t].x - me.x) / SUB, (m.fighters[t].y - me.y) / SUB) : 0;
    if (me.charge >= CHARGE_WANT[level]) return me.weapon === 'fists' ? 0 : aim;
    return SKILL2 | (aim & (LEFT | RIGHT));
  }

  // Down on the floor with the fight above: out from under the ground, then jump back up.
  const above = nearest(m, seat);
  const low = me.platform >= 0 && y > home.top + 30;
  if (low && !busy && (above < 0 || (m.fighters[above].y - me.y) / SUB < -60)) {
    // Clear of the edge: jump straight up (the air logic steers in once above the ground).
    if (x > home.left - 30 && x < home.right + 30) return x < homeX ? LEFT : RIGHT;
    return thinking && !(me.prevInput & JUMP) ? JUMP : 0;
  }

  // Off the ground: get back above it, then over it.
  if (offstage) {
    let input = 0;
    const below = y > home.top - 10;
    // Under the ground: out from beneath it. Beside it but still below: rise straight up,
    // clear of the edge (drifting in would hit its underside). Above it: in toward the middle.
    const clear = x < home.left - 30 || x > home.right + 30;
    if (below && !clear) input |= x < homeX ? LEFT : RIGHT;
    else if (!below) input |= x < homeX ? RIGHT : LEFT;
    if (!busy && (me.vy > 0 || below) && thinking) {
      if (me.airJumps > 0 && !(me.prevInput & JUMP)) input |= JUMP;
      else if (!me.recoveryUsed && me.vy > 0) return SKILL2 | UP;
      else if (!me.airDashUsed && me.vy > 0) return DODGE | UP | (below ? 0 : x < homeX ? RIGHT : LEFT);
    }
    return input;
  }

  // Bare hands: a weapon nearby is worth more than a punch.
  const target = nearest(m, seat);
  if (me.weapon === 'fists' && m.items.length > 0) {
    let best = m.items[0];
    for (const it of m.items) if (Math.abs(it.x - me.x) + Math.abs(it.y - me.y) < Math.abs(best.x - me.x) + Math.abs(best.y - me.y)) best = it;
    const ix = (best.x - me.x) / SUB;
    const iy = (best.y - me.y) / SUB;
    const threat = target >= 0 && Math.abs(m.fighters[target].x - me.x) / SUB < 60 && Math.abs(m.fighters[target].y - me.y) / SUB < 60;
    if (!threat || level === 1) {
      let input = Math.abs(ix) > 12 ? (ix > 0 ? RIGHT : LEFT) : 0;
      if (thinking && !busy && iy < -60 && Math.abs(ix) < 200 && !(me.prevInput & JUMP)) input |= JUMP;
      if (me.platform >= 0 && iy > 40 && Math.abs(ix) < 160) input |= DOWN;
      return input;
    }
  }

  if (target < 0) return 0;
  const them = m.fighters[target];
  const dx = (them.x - me.x) / SUB;
  const dy = (them.y - me.y) / SUB;
  const ranged = RANGED.includes(me.weapon);
  const reach = me.weapon === 'spear' || me.weapon === 'scythe' ? 100 : me.weapon === 'fists' ? 45 : 70;
  const toward = dx > 0 ? RIGHT : LEFT;
  let input = 0;

  // A shot only flies eight ways: is the target on one of them (or close enough, for a lobbed grenade)?
  const lined = me.weapon === 'grenades' || Math.abs(dy) <= 60 || Math.abs(dx) <= 50 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 60;

  // Close in (or, with a gun, hold a middle distance once lined up), but not off the edge.
  // Only the main ground's edges matter: stepping off a ledge just lands you lower.
  const under = me.platform >= 0 ? surface(m, me.platform) : null;
  const onMain = !!under && safe.some((g) => under.top === g.top * SUB && under.left <= g.right * SUB && under.right >= g.left * SUB);
  const nearEdge = onMain && !!under && ((dx < 0 && me.x < under.left + 30 * SUB) || (dx > 0 && me.x > under.right - 30 * SUB));
  const want = ranged && lined ? 200 : ranged ? 60 : reach * 0.8;
  if (Math.abs(dx) > want && !nearEdge) input |= toward;
  // At the edge with them standing on ground across the gap: jump over to them.
  if (Math.abs(dx) > want && nearEdge && them.platform >= 0 && thinking && !busy && !(me.prevInput & JUMP)) return toward | JUMP;
  else if (ranged && Math.abs(dx) < 100 && !nearEdge) input |= dx > 0 ? LEFT : RIGHT;
  if (me.platform > 0 && dy > 60 && Math.abs(dx) < 140) input |= DOWN;

  if (!thinking || busy || attackOf(me)) return input;
  const r = chance();

  // A swing winding up close by: roll away from it.
  const theirs = attackOf(them);
  const coming = theirs !== null && !isActive(them, theirs) && them.moveFrame <= theirs.startup;
  if (coming && me.platform >= 0 && Math.abs(dx) < reach + 50 && Math.abs(dy) < 90 && me.dodgeCooldown === 0 && r < DODGING[level]) {
    return DODGE | (dx > 0 ? LEFT : RIGHT);
  }

  if (dy < -90 && Math.abs(dx) < 180 && (me.platform >= 0 || me.airJumps > 0) && !(me.prevInput & JUMP)) return input | JUMP;

  if (ranged) {
    // Lined up: shoot (a lobbed grenade only needs the side). Empty, the next Attack throws it.
    if (lined && Math.abs(dx) < 520 && r < AGGRESSION[level]) return SKILL1 | aimBits(dx, me.weapon === 'grenades' ? 0 : dy);
    // Not lined up: get level, up onto their ledge or down off ours.
    if (dy < -50 && me.platform >= 0 && !(me.prevInput & JUMP)) return input | JUMP;
    if (dy > 50 && me.platform >= 0 && surfaceSoft(m, me.platform)) return input | DOWN;
    return input;
  }

  if (Math.abs(dx) <= reach && Math.abs(dy) < 70 && r < AGGRESSION[level]) {
    // Now and then, a charged kick instead (harder bots more often).
    if (chance() < 0.1 * level) return SKILL2 | toward;
    return SKILL1 | (chance() < 0.5 ? toward : 0);
  }
  if (dy < -40 && Math.abs(dx) < 60 && r < AGGRESSION[level]) return SKILL1 | UP;
  return input;
}
