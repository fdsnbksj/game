import { cardOf, type Card, type Cost, type Counting, type Res, type Stage } from './cards';

// Words for what cards and wonder stages do, for the screen. Our own phrasing.

export const RES_NAMES: Record<Res, string> = { wood: 'Wood', stone: 'Stone', clay: 'Clay', ore: 'Ore', glass: 'Glass', cloth: 'Cloth', papyrus: 'Papyrus' };
export const COLOR_NAMES: Record<Card['color'], string> = {
  brown: 'Raw material',
  grey: 'Manufactured good',
  blue: 'Civic',
  yellow: 'Commercial',
  red: 'Military',
  green: 'Science',
  purple: 'Guild',
};
const SCIENCE = { compass: 'Compass', gear: 'Gear', tablet: 'Tablet' };

const list = (items: string[], word = 'or') => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`);

export function costText(cost: Cost): string {
  const parts = [...(cost.coins ? [`${cost.coins} coin${cost.coins > 1 ? 's' : ''}`] : []), ...Object.entries(cost.res ?? {}).map(([r, n]) => `${n} ${RES_NAMES[r as Res]}`)];
  return parts.length ? parts.join(', ') : 'Free';
}

const what = (c: Counting) => {
  const kind = {
    brown: 'brown card',
    grey: 'grey card',
    blue: 'civic card',
    yellow: 'commercial card',
    red: 'military card',
    green: 'science card',
    purple: 'guild',
    wonderStage: 'wonder stage built',
    defeat: 'defeat',
    brownGreyPurple: 'brown, grey or guild card',
  }[c.what];
  const where = { own: 'in your city', neighbours: "in your neighbours' cities", all: 'in your city and your neighbours’' }[c.where];
  return `${kind} ${where}`;
};

/** A few words for a card in the hand. */
export function shortEffect(card: Card): string {
  if (card.produces) return Object.entries(card.produces).map(([r, n]) => `${n > 1 ? `${n} ` : ''}${RES_NAMES[r as Res]}`).join(' ');
  if (card.choice) return card.choice.map((r) => RES_NAMES[r]).join('/');
  if (card.points) return `${card.points} points`;
  if (card.shields) return `${card.shields} shield${card.shields > 1 ? 's' : ''}`;
  if (card.science) return SCIENCE[card.science];
  if (card.coins) return `${card.coins} coins`;
  if (card.discount) return 'Cheaper trade';
  if (card.scienceWild) return 'Any science';
  if (card.pointsPer || card.coinsPer) return card.color === 'purple' ? 'Guild points' : 'Coins and points';
  return '';
}

export function cardText(card: Card): string[] {
  const out: string[] = [];
  if (card.produces) out.push(`Makes ${Object.entries(card.produces).map(([r, n]) => `${n} ${RES_NAMES[r as Res]}`).join(', ')} every turn.`);
  if (card.choice) out.push(`Makes one of ${list(card.choice.map((r) => RES_NAMES[r]))} each turn.`);
  if (card.points) out.push(`${card.points} points.`);
  if (card.shields) out.push(`${card.shields} shield${card.shields > 1 ? 's' : ''} for the battles at the end of each age.`);
  if (card.science) out.push(`Science symbol: ${SCIENCE[card.science]}.`);
  if (card.coins) out.push(`${card.coins} coins now.`);
  if (card.discount) {
    const side = { left: 'your left neighbour', right: 'your right neighbour', both: 'both neighbours' }[card.discount.side];
    out.push(`Buy ${list(card.discount.res.map((r) => RES_NAMES[r]), 'and')} from ${side} for 1 coin.`);
  }
  if (card.coinsPer) out.push(`${card.coinsPer.each} coin${card.coinsPer.each > 1 ? 's' : ''} now for each ${what(card.coinsPer)}.`);
  if (card.pointsPer) out.push(`At the end, ${card.pointsPer.each} point${card.pointsPer.each > 1 ? 's' : ''} for each ${what(card.pointsPer)}.`);
  if (card.scienceWild) out.push('At the end, a science symbol of your choice.');
  if (card.chainFrom) out.push(`Free if you have ${list(card.chainFrom.map((id) => cardOf(id).name))}.`);
  return out;
}

export function stageText(stage: Stage): string {
  const out: string[] = [];
  if (stage.points) out.push(`${stage.points} points`);
  if (stage.coins) out.push(`${stage.coins} coins`);
  if (stage.shields) out.push(`${stage.shields} shield${stage.shields > 1 ? 's' : ''}`);
  if (stage.choice) out.push(`one of ${list(stage.choice.map((r) => RES_NAMES[r]))} each turn`);
  if (stage.scienceWild) out.push('a science symbol of your choice');
  if (stage.freeBuildPerAge) out.push('build one card free each age');
  if (stage.reviveDiscard) out.push('build a discarded card free');
  if (stage.playSeventh) out.push('play the last card of each age');
  if (stage.rawDiscount) out.push('raw materials from neighbours for 1 coin');
  if (stage.copyGuild) out.push("copy a neighbour's guild at the end");
  const text = out.join(', ');
  return text[0].toUpperCase() + text.slice(1) + '.';
}
