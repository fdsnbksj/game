import { Count, Icon, type IconName } from '../../components/GameIcons';
import { RESOURCES, type Card, type Cost, type Counting, type Res, type Stage } from '../../games/wonders/cards';

// Costs and effects drawn as icons, for cards in the hand, wonder stages and the card sheet.

/** A resource cost: one icon per unit, then coins. */
export function CostIcons({ cost, size = 14 }: { cost: Cost; size?: number }) {
  const units = RESOURCES.flatMap((res) => Array<Res>(cost.res?.[res] ?? 0).fill(res));
  if (!units.length && !cost.coins) return <span className="icons free">Free</span>;
  return (
    <span className="icons" aria-label="Cost">
      {cost.coins ? <Count name="coin" n={cost.coins} size={size} /> : null}
      {units.map((res, i) => (
        <Icon key={i} name={res} size={size} />
      ))}
    </span>
  );
}

const Or = ({ items, size }: { items: IconName[]; size: number }) => (
  <span className="icons or">
    {items.map((name, i) => (
      <span key={name} className="icons">
        {i > 0 && <span className="slash">/</span>}
        <Icon name={name} size={size} />
      </span>
    ))}
  </span>
);

/** What a guild or commercial card counts: a card of a colour, a wonder stage, or a defeat. */
function Counted({ c, size }: { c: Counting; size: number }) {
  const what =
    c.what === 'wonderStage' ? (
      <Icon name="stage" size={size} />
    ) : c.what === 'defeat' ? (
      <Icon name="defeat" size={size} />
    ) : c.what === 'brownGreyPurple' ? (
      <span className="icons">
        {(['brown', 'grey', 'purple'] as const).map((col) => (
          <span key={col} className={`card-pip c-${col}`} />
        ))}
      </span>
    ) : (
      <span className={`card-pip c-${c.what}`} />
    );
  // Whose: ◀ ▶ for both neighbours, ◀•▶ for them and you.
  const where = { own: null, neighbours: '◀▶', all: '◀•▶' }[c.where];
  return (
    <span className="icons per">
      <span className="slash">per</span>
      {what}
      {where && <span className="where">{where}</span>}
    </span>
  );
}

/** What a card gives, as icons. */
export function CardEffect({ card, size = 14 }: { card: Card; size?: number }) {
  const parts: React.ReactNode[] = [];
  if (card.produces)
    parts.push(
      <span key="p" className="icons">
        {(Object.entries(card.produces) as [Res, number][]).flatMap(([res, n]) => Array.from({ length: n }, (_, i) => <Icon key={`${res}${i}`} name={res} size={size} />))}
      </span>,
    );
  if (card.choice) parts.push(<Or key="c" items={card.choice} size={size} />);
  if (card.points) parts.push(<Count key="v" name="points" n={card.points} size={size} />);
  if (card.shields)
    parts.push(
      <span key="s" className="icons">
        {Array.from({ length: card.shields }, (_, i) => (
          <Icon key={i} name="shield" size={size} />
        ))}
      </span>,
    );
  if (card.science) parts.push(<Icon key="sc" name={card.science} size={size} />);
  if (card.scienceWild) parts.push(<Or key="sw" items={['compass', 'gear', 'tablet']} size={size} />);
  if (card.coins) parts.push(<Count key="co" name="coin" n={card.coins} size={size} />);
  if (card.discount) {
    const arrow = { left: '◀', right: '▶', both: '◀▶' }[card.discount.side];
    parts.push(
      <span key="d" className="icons">
        <span className="where">{arrow}</span>
        {card.discount.res.map((res) => (
          <Icon key={res} name={res} size={size} />
        ))}
        <Count name="coin" n={1} size={size} />
      </span>,
    );
  }
  if (card.coinsPer)
    parts.push(
      <span key="cp" className="icons">
        <Count name="coin" n={card.coinsPer.each} size={size} />
        <Counted c={card.coinsPer} size={size} />
      </span>,
    );
  if (card.pointsPer)
    parts.push(
      <span key="pp" className="icons">
        <Count name="points" n={card.pointsPer.each} size={size} />
        <Counted c={card.pointsPer} size={size} />
      </span>,
    );
  return <span className="icons effect">{parts}</span>;
}

/** What a wonder stage gives: icons where they fit, a few words for the rest. */
export function StageEffect({ stage, size = 14 }: { stage: Stage; size?: number }) {
  return (
    <span className="icons effect">
      {stage.points ? <Count name="points" n={stage.points} size={size} /> : null}
      {stage.coins ? <Count name="coin" n={stage.coins} size={size} /> : null}
      {stage.shields
        ? Array.from({ length: stage.shields }, (_, i) => <Icon key={`s${i}`} name="shield" size={size} />)
        : null}
      {stage.choice && <Or items={stage.choice} size={size} />}
      {stage.scienceWild && <Or items={['compass', 'gear', 'tablet']} size={size} />}
      {stage.freeBuildPerAge && <span className="words">free card each age</span>}
      {stage.reviveDiscard && <span className="words">build a discard</span>}
      {stage.playSeventh && <span className="words">play last card</span>}
      {stage.rawDiscount && (
        <span className="icons">
          <span className="where">◀▶</span>
          <Icon name="wood" size={size} />
          <Icon name="stone" size={size} />
          <Icon name="clay" size={size} />
          <Icon name="ore" size={size} />
          <Count name="coin" n={1} size={size} />
        </span>
      )}
      {stage.copyGuild && <span className="words">copy a guild</span>}
    </span>
  );
}
