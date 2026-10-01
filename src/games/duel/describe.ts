import { ALL_CARDS, cardOf, type Card, type Cost, type Res, type Science, type Wonder } from './cards';

// Words for what cards and wonders do, for the screen. Our own phrasing throughout.

export const RES_NAMES: Record<Res, string> = { wood: 'Wood', clay: 'Clay', stone: 'Stone', glass: 'Glass', papyrus: 'Papyrus' };
export const SCIENCE_NAMES: Record<Science, string> = {
  wheel: 'Wheel',
  mortar: 'Mortar',
  quill: 'Quill',
  plumb: 'Plumb line',
  sundial: 'Sundial',
  globe: 'Globe',
  law: 'Scales',
};
export const COLOR_NAMES: Record<Card['color'], string> = {
  brown: 'Raw material',
  grey: 'Manufactured good',
  blue: 'Civic',
  green: 'Science',
  red: 'Military',
  yellow: 'Commercial',
  purple: 'Guild',
};

const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

export function costText(cost: Cost): string {
  const parts = [
    ...(cost.coins ? [`${cost.coins} ${cost.coins === 1 ? 'coin' : 'coins'}`] : []),
    ...Object.entries(cost.res ?? {}).map(([res, n]) => `${n} ${RES_NAMES[res as Res]}`),
  ];
  return parts.length ? parts.join(', ') : 'Free';
}

/** A few words for the face of a small card. */
export function shortEffect(card: Card): string {
  if (card.produces) return Object.entries(card.produces).map(([res, n]) => `${n > 1 ? `${n} ` : ''}${RES_NAMES[res as Res]}`).join(' ');
  if (card.choice) return card.choice.map((r) => RES_NAMES[r][0]).join('/');
  if (card.fixes) return `${card.fixes.map((r) => RES_NAMES[r]).join('+')} at 1`;
  if (card.shields) return `${card.shields} shield${card.shields > 1 ? 's' : ''}`;
  if (card.science) return SCIENCE_NAMES[card.science];
  if (card.guild) return 'Guild';
  if (card.points && card.color === 'blue') return `${card.points} points`;
  if (card.coins) return `+${card.coins} coins`;
  if (card.coinsPer) return `${card.points ?? 0} pts, coins`;
  return '';
}

const GUILD_TEXT: Record<NonNullable<Card['guild']>, string> = {
  yellow: 'At the end, 1 point per commercial card in the city with the most. Now, 1 coin per such card.',
  brownGrey: 'At the end, 1 point per brown and grey card in the city with the most. Now, 1 coin per such card.',
  blue: 'At the end, 1 point per civic card in the city with the most. Now, 1 coin per such card.',
  green: 'At the end, 1 point per science card in the city with the most. Now, 1 coin per such card.',
  red: 'At the end, 1 point per military card in the city with the most. Now, 1 coin per such card.',
  wonders: 'At the end, 2 points per wonder built in the city with the most.',
  coins: 'At the end, 1 point per 3 coins in the richest city.',
};

/** What a card does, in full. */
export function cardText(card: Card): string[] {
  const out: string[] = [];
  if (card.produces) out.push(`Makes ${Object.entries(card.produces).map(([r, n]) => `${n} ${RES_NAMES[r as Res]}`).join(', ')} every turn.`);
  if (card.choice) out.push(`Makes one of ${list(card.choice.map((r) => RES_NAMES[r]))} each turn. Doesn't raise your opponent's prices.`);
  if (card.fixes) out.push(`You buy ${card.fixes.map((r) => RES_NAMES[r]).join(' and ')} from the bank for 1 coin each.`);
  if (card.shields) out.push(`${card.shields} shield${card.shields > 1 ? 's' : ''}: the conflict pawn moves toward your opponent.`);
  if (card.science) out.push(`Science symbol: ${SCIENCE_NAMES[card.science]}. A matching pair earns a progress token; six different symbols win.`);
  if (card.coins) out.push(`${card.coins} coins now.`);
  if (card.coinsPer) {
    const what = { grey: 'grey card', brown: 'brown card', red: 'military card', yellow: 'commercial card', wonder: 'wonder you have built' }[card.coinsPer.what];
    out.push(`${card.coinsPer.each} ${card.coinsPer.each === 1 ? 'coin' : 'coins'} now for each ${what} in your city.`);
  }
  if (card.guild) out.push(GUILD_TEXT[card.guild]);
  if (card.points) out.push(`${card.points} ${card.points === 1 ? 'point' : 'points'} at the end.`);
  if (card.chainFrom) {
    const from = cardOfChain(card.chainFrom);
    if (from) out.push(`Free if you have ${from.name}.`);
  }
  if (card.chainTo) {
    const to = chainTargets(card.chainTo).map((c) => c.name);
    if (to.length) out.push(`Makes ${list(to)} free later.`);
  }
  return out;
}

const cardOfChain = (link: string) => ALL_CARDS.find((c) => c.chainTo === link);
const chainTargets = (link: string) => ALL_CARDS.filter((c) => c.chainFrom === link);

export function wonderText(w: Wonder): string[] {
  const out: string[] = [];
  if (w.points) out.push(`${w.points} points.`);
  if (w.coins) out.push(`${w.coins} coins now.`);
  if (w.opponentLoses) out.push(`Your opponent loses ${w.opponentLoses} coins.`);
  if (w.shields) out.push(`${w.shields} shield${w.shields > 1 ? 's' : ''}.`);
  if (w.choice) out.push(`Makes one of ${list(w.choice.map((r) => RES_NAMES[r]))} each turn.`);
  if (w.destroy) out.push(`Destroy one of your opponent's ${w.destroy} cards.`);
  if (w.revive) out.push('Build one card from the discards for free.');
  if (w.library) out.push('Choose one of three progress tokens from those out of the game.');
  if (w.playAgain) out.push('Take another turn.');
  return out;
}

export const nameOf = (id: string) => cardOf(id).name;
