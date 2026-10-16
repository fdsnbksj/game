import { Count, Icon } from '../../components/GameIcons';
import { boardOf, cardOf, RESOURCES, type Color } from '../../games/wonders/cards';
import { COLOR_NAMES, RES_NAMES, stageText } from '../../games/wonders/describe';
import { leftOf, ownSupply, prices, rightOf, saleSupply, score, shieldsOf, stagesOf, type WondersState } from '../../games/wonders/state';
import { CostIcons, StageEffect } from './CardIcons';

const COLORS: Color[] = ['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple'];

/**
 * The table as you sit at it: your board in the middle, always showing, and what each
 * neighbour sells you down the side they sit on. A side opens that city in full.
 */
export function Table({ state, me, name, onNeighbour }: { state: WondersState; me: number; name: (s: number) => string; onNeighbour: (seat: number) => void }) {
  const left = leftOf(state, me);
  const right = rightOf(state, me);
  return (
    <div className="wonder-table">
      <Rail state={state} me={me} seat={left} side="left" name={name} onOpen={() => onNeighbour(left)} />
      <Board state={state} seat={me} />
      <Rail state={state} me={me} seat={right} side="right" name={name} onOpen={() => onNeighbour(right)} />
    </div>
  );
}

/** A neighbour: name, shields, and the materials they sell (outlined when they're 1 coin to you). */
function Rail({ state, me, seat, side, name, onOpen }: { state: WondersState; me: number; seat: number; side: 'left' | 'right'; name: (s: number) => string; onOpen: () => void }) {
  const city = state.cities[seat];
  const sale = saleSupply(city);
  const price = prices(state.cities[me])[side];
  return (
    <button className={`rail rail-${side}`} onClick={onOpen} aria-label={`${side === 'left' ? 'Left' : 'Right'} neighbour: ${name(seat)}`}>
      <span className="rail-arrow">{side === 'left' ? '◀' : '▶'}</span>
      <span className="rail-name">{name(seat)}</span>
      <Count name="shield" n={shieldsOf(city)} size={14} />
      <span className="rail-line" />
      {RESOURCES.filter((r) => sale.fixed[r] > 0).map((r) => (
        <span key={r} className={price[r] === 1 ? 'rail-res cheap' : 'rail-res'} title={`${RES_NAMES[r]}: ${price[r]} coin${price[r] === 1 ? '' : 's'} each`}>
          <Count name={r} n={sale.fixed[r]} size={16} />
        </span>
      ))}
      {sale.choices.map((choice, i) => (
        <span key={i} className={choice.every((r) => price[r] === 1) ? 'rail-res rail-choice cheap' : 'rail-res rail-choice'} title="One of these each turn">
          {choice.map((r) => (
            <Icon key={r} name={r} size={14} />
          ))}
        </span>
      ))}
    </button>
  );
}

/** Your wonder board: figures, stages (what each costs and gives), what you make, your cards by colour. */
function Board({ state, seat }: { state: WondersState; seat: number }) {
  const city = state.cities[seat];
  const board = boardOf(city.board);
  const supply = ownSupply(city);
  const stages = stagesOf(city);
  const cards = city.cards.map(cardOf);
  const science = (['compass', 'gear', 'tablet'] as const).map((sym) => [sym, cards.filter((c) => c.science === sym).length] as const);
  return (
    <section className="board" aria-label="Your wonder board">
      <header className="board-head">
        <strong>{board.name}</strong>
        <span className="note">side {city.side}</span>
      </header>
      <span className="board-figures">
        <Count name="coin" n={city.coins} size={16} />
        <Count name="shield" n={shieldsOf(city)} size={16} />
        <Count name="points" n={score(state, seat).total} size={16} />
      </span>
      <ol className="board-stages">
        {stages.map((st, i) => (
          <li key={i} className={i < city.stages ? 'board-stage built' : 'board-stage'} title={stageText(st)}>
            <span className="board-stage-n">{i < city.stages ? '✓' : i + 1}</span>
            {i >= city.stages && <CostIcons cost={st.cost} size={12} />}
            <span className="arrow">→</span>
            <StageEffect stage={st} size={12} />
          </li>
        ))}
      </ol>
      <div className="board-row">
        {RESOURCES.filter((r) => supply.fixed[r] > 0).map((r) => (
          <span key={r} className="have" title={RES_NAMES[r]}>
            <Count name={r} n={supply.fixed[r]} size={15} />
          </span>
        ))}
        {supply.choices.map((choice, i) => (
          <span key={`c${i}`} className="have choice" title="One of these each turn">
            {choice.map((r, k) => (
              <span key={r} className="icons">
                {k > 0 && <span className="slash">/</span>}
                <Icon name={r} size={13} />
              </span>
            ))}
          </span>
        ))}
        {science
          .filter(([, n]) => n > 0)
          .map(([sym, n]) => (
            <span key={sym} className="have">
              <Count name={sym} n={n} size={15} />
            </span>
          ))}
      </div>
      {cards.length > 0 && (
        <div className="board-row">
          {COLORS.map((c) => {
            const n = cards.filter((card) => card.color === c).length;
            return n ? (
              <span key={c} className={`pip c-${c}`} title={COLOR_NAMES[c]}>
                {n}
              </span>
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
