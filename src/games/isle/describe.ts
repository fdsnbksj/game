import { RESOURCES, type Dev, type Res, type Terrain } from './setup';
import { handSize, type Event, type Hand } from './state';

// Words for the screen. Our own phrasing.

export const RES_NAMES: Record<Res, string> = { brick: 'Brick', lumber: 'Lumber', wool: 'Wool', grain: 'Grain', ore: 'Ore' };
export const TERRAIN_NAMES: Record<Terrain, string> = { hills: 'Hills', forest: 'Forest', pasture: 'Pasture', fields: 'Fields', mountains: 'Mountains', desert: 'Desert' };

export const DEV_NAMES: Record<Dev, string> = { knight: 'Knight', point: 'Victory point', roads: 'Road building', plenty: 'Plenty', monopoly: 'Monopoly' };
export const DEV_TEXT: Record<Dev, string> = {
  knight: 'Move the robber and steal a card. Three knights or more, and the most, make the largest army (2 points).',
  point: 'One point, kept hidden until the game ends.',
  roads: 'Build two roads free.',
  plenty: 'Take any two resources from the bank.',
  monopoly: 'Name a resource: everyone gives you all of theirs.',
};

/** "2 Wool, 1 Ore". */
export function handText(h: Hand): string {
  const parts = RESOURCES.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RES_NAMES[r]}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

/** One line of the log, as `viewer` sees it: a stolen card shows only to the two involved. */
export function eventText(e: Event, name: (seat: number) => string, viewer: number): string | null {
  switch (e.type) {
    case 'placed':
      return `${name(e.seat)} settled`;
    case 'rolled': {
      const total = e.dice[0] + e.dice[1];
      const got = e.gains[viewer] && handSize(e.gains[viewer]) ? ` · you got ${handText(e.gains[viewer])}` : '';
      return `${name(e.seat)} rolled ${total}${total === 7 ? ': the robber' : ''}${got}`;
    }
    case 'built':
      return `${name(e.seat)} built a ${e.what}`;
    case 'bought':
      return `${name(e.seat)} bought a development card`;
    case 'played':
      if (e.card === 'monopoly') return `${name(e.seat)} played Monopoly and took ${e.took} ${RES_NAMES[e.res!]}`;
      return `${name(e.seat)} played ${DEV_NAMES[e.card]}`;
    case 'discarded':
      return `${name(e.seat)} discarded ${e.count}`;
    case 'robbed': {
      if (e.victim === null) return `${name(e.seat)} moved the robber`;
      const what = e.res && (viewer === e.seat || viewer === e.victim) ? ` (${RES_NAMES[e.res]})` : '';
      return `${name(e.seat)} stole a card from ${name(e.victim)}${what}`;
    }
    case 'traded':
      return `${name(e.seat)} gave ${handText(e.give)} to ${e.with === 'bank' ? 'the bank' : name(e.with)} for ${handText(e.get)}`;
    case 'award':
      if (e.seat === null) return `Nobody holds the ${e.what} ${e.what === 'longest' ? 'road' : 'army'} now`;
      return `${name(e.seat)} ${e.seat === viewer ? 'have' : 'has'} the ${e.what} ${e.what === 'longest' ? 'road' : 'army'}`;
    case 'ended':
      return null;
    case 'won':
      return `${name(e.seat)} ${e.seat === viewer ? 'win' : 'wins'}`;
  }
}
