import { CreatureChip } from '../components/CreatureChip';
import { ItemChip } from '../components/ItemChip';
import { TraitIcon } from '../components/TraitIcon';
import { ITEMS, MAX_INTEREST, MAX_ROUNDS, REROLL_COST, START_HP, TRAITS, UNITS, XP_COST, XP_PER_BUY } from '../sim/balance';

const STEPS = [
  { title: 'Buy', text: 'Tap a creature in the shop. It lands on your bench.' },
  { title: 'Place', text: 'Drag it onto your hexes. Your level is how many can fight.' },
  { title: 'Sell', text: 'Drag a creature onto the shop to sell it.' },
  { title: 'Fight', text: 'Press Fight. The battle plays out on its own.' },
];

export function HowToPlay() {
  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Guide</p>
          <h1>How to play</h1>
        </div>
      </header>

      <section className="glass card-pad">
        <p className="lead">
          Start with {START_HP} HP. Each round your team fights a rival's by itself. Lose and you take damage; win as many of
          the {MAX_ROUNDS} rounds as you can.
        </p>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-number">{i + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <span className="note">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass card-pad">
        <p className="micro">Gold and levels</p>
        <p className="body-text">
          You earn gold every round, plus 1 for every 10 you've saved (up to {MAX_INTEREST}) and a bonus for a win. Reroll the
          shop for {REROLL_COST}, or buy {XP_PER_BUY} XP for {XP_COST}: higher levels field more creatures and find rarer
          ones. Selling refunds the full price. Three copies merge into ★★, three ★★ into ★★★.
        </p>
      </section>

      <section className="glass card-pad">
        <p className="micro">Traits</p>
        <ul className="trait-guide">
          {TRAITS.map((trait) => (
            <li key={trait.id}>
              <TraitIcon trait={trait.id} size={22} />
              <span>
                <strong>{trait.name}</strong>
                <span className="note">
                  {trait.thresholds.map((t, i) => `${t}: ${trait.description.replace('{v}', `${trait.values[i]}`)}`).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card-pad">
        <p className="micro">Items</p>
        <p className="note">One drops every few rounds. Drag it onto a creature; each holds one.</p>
        <ul className="item-guide">
          {ITEMS.map((item) => (
            <li key={item.id}>
              <ItemChip itemId={item.id} size={24} />
              <span>
                <strong>{item.name}</strong>
                <span className="note">{item.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="micro section-label">Creatures</p>
        <ul className="creature-grid">
          {UNITS.map((unit) => (
            <li key={unit.id} className={`glass creature-card cost-${unit.cost}`}>
              <span className="cost-gem">{unit.cost}</span>
              <CreatureChip unitId={unit.id} size={54} />
              <strong>{unit.name}</strong>
              <span className="creature-traits">
                <TraitIcon trait={unit.origin} size={14} />
                <TraitIcon trait={unit.role} size={14} />
              </span>
              <span className="note ability-note">
                <b>{unit.ability.name}</b> {unit.ability.description}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
