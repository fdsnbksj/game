import type { ReactNode } from 'react';
import { Count, Icon, type IconName } from '../../components/GameIcons';
import { RESOURCES, type Card, type Cost, type Res, type Wonder } from '../../games/duel/cards';

// Rival Wonders' costs and effects as icons, the same set Ancient Wonders uses.

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

const Repeat = ({ name, n, size }: { name: IconName; n: number; size: number }) => (
  <span className="icons">
    {Array.from({ length: n }, (_, i) => (
      <Icon key={i} name={name} size={size} />
    ))}
  </span>
);

const Pip = ({ colors }: { colors: string[] }) => (
  <span className="icons">
    {colors.map((c) => (
      <span key={c} className={`card-pip c-${c}`} />
    ))}
  </span>
);

const GUILD: Record<NonNullable<Card['guild']>, string[]> = {
  yellow: ['yellow'],
  brownGrey: ['brown', 'grey'],
  blue: ['blue'],
  green: ['green'],
  red: ['red'],
  wonders: [],
  coins: [],
};

export function CardEffect({ card, size = 14 }: { card: Card; size?: number }) {
  const parts: ReactNode[] = [];
  if (card.produces)
    for (const [res, n] of Object.entries(card.produces) as [Res, number][]) parts.push(<Repeat key={`p${res}`} name={res} n={n} size={size} />);
  if (card.choice) parts.push(<Or key="c" items={card.choice} size={size} />);
  if (card.fixes)
    parts.push(
      <span key="f" className="icons">
        {card.fixes.map((res) => (
          <Icon key={res} name={res} size={size} />
        ))}
        <span className="slash">at</span>
        <Count name="coin" n={1} size={size} />
      </span>,
    );
  if (card.points && !card.coinsPer) parts.push(<Count key="v" name="points" n={card.points} size={size} />);
  if (card.shields) parts.push(<Repeat key="s" name="shield" n={card.shields} size={size} />);
  if (card.science) parts.push(<Icon key="sc" name={card.science} size={size} />);
  if (card.coins) parts.push(<Count key="co" name="coin" n={card.coins} size={size} />);
  if (card.coinsPer) {
    const { what, each } = card.coinsPer;
    parts.push(
      <span key="cp" className="icons">
        <Count name="points" n={card.points ?? 0} size={size} />
        <Count name="coin" n={each} size={size} />
        <span className="slash">per</span>
        {what === 'wonder' ? <Icon name="stage" size={size} /> : <Pip colors={[what]} />}
      </span>,
    );
  }
  if (card.guild) {
    const kind = card.guild;
    parts.push(
      <span key="g" className="icons">
        {kind === 'wonders' ? (
          <>
            <Count name="points" n={2} size={size} />
            <span className="slash">per</span>
            <Icon name="stage" size={size} />
          </>
        ) : kind === 'coins' ? (
          <>
            <Count name="points" n={1} size={size} />
            <span className="slash">per</span>
            <Count name="coin" n={3} size={size} />
          </>
        ) : (
          <>
            <Count name="points" n={1} size={size} />
            <Count name="coin" n={1} size={size} />
            <span className="slash">per</span>
            <Pip colors={GUILD[kind]} />
          </>
        )}
        <span className="slash">most</span>
      </span>,
    );
  }
  return <span className="icons effect">{parts}</span>;
}

export function WonderEffect({ wonder, size = 14 }: { wonder: Wonder; size?: number }) {
  return (
    <span className="icons effect">
      {wonder.points ? <Count name="points" n={wonder.points} size={size} /> : null}
      {wonder.coins ? <Count name="coin" n={wonder.coins} size={size} /> : null}
      {wonder.opponentLoses ? (
        <span className="icons">
          <Count name="coin" n={`−${wonder.opponentLoses}`} size={size} />
          <span className="slash">rival</span>
        </span>
      ) : null}
      {wonder.shields ? <Repeat name="shield" n={wonder.shields} size={size} /> : null}
      {wonder.choice && <Or items={wonder.choice} size={size} />}
      {wonder.destroy && (
        <span className="icons">
          <span className="words">destroy</span>
          <Pip colors={[wonder.destroy]} />
        </span>
      )}
      {wonder.revive && <span className="words">build a discard</span>}
      {wonder.library && <span className="words">pick a token</span>}
      {wonder.playAgain && <Icon name="again" size={size} />}
    </span>
  );
}
