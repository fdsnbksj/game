import { Link } from 'react-router';
import { CreatureChip } from '../components/CreatureChip';
import {
  getTrait,
  MAX_INTEREST,
  MAX_ROUNDS,
  REROLL_COST,
  START_HP,
  TRAITS,
  UNITS,
  XP_COST,
  XP_PER_BUY,
} from '../sim/balance';

export function HowToPlay() {
  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>How to play</h2>
      </header>

      <section className="guide">
        <h3>The goal</h3>
        <p>
          You start with {START_HP} HP. Each round your team fights a rival's, all on its own. Lose and you take damage;
          survive all {MAX_ROUNDS} rounds, or win as many as you can before you're knocked out.
        </p>

        <h3>Each round</h3>
        <ol>
          <li>
            <b>Buy</b> creatures from the shop. They land on your bench.
          </li>
          <li>
            <b>Drag</b> them onto your hexes. Your level is how many can fight.
          </li>
          <li>
            <b>Fight.</b> The battle plays out by itself.
          </li>
        </ol>

        <h3>Gold</h3>
        <p>
          You earn gold every round, plus 1 per 10 you've saved (up to {MAX_INTEREST}) and a bonus for a win. Reroll the
          shop for {REROLL_COST}, or buy {XP_PER_BUY} XP for {XP_COST} to level up: higher levels field more creatures and
          find rarer ones. Selling refunds the full price.
        </p>

        <h3>Stars</h3>
        <p>Three copies of a creature merge into a stronger ★★. Three ★★ make a ★★★.</p>

        <h3>Traits</h3>
        <p>Field different creatures that share a trait to switch it on.</p>
        <ul className="trait-lines">
          {TRAITS.map((trait) => (
            <li key={trait.id}>
              <strong>{trait.name}</strong>{' '}
              <span className="muted">
                {trait.thresholds.map((t, i) => `(${t}) ${trait.description.replace('{v}', `${trait.values[i]}`)}`).join('  ')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="guide">
        <h3>Creatures</h3>
        <ul className="roster">
          {UNITS.map((unit) => (
            <li key={unit.id} className={`cost-${unit.cost}`}>
              <CreatureChip unitId={unit.id} size={48} />
              <div>
                <strong>{unit.name}</strong> <span className="roster-cost">{unit.cost}g</span>
                <p className="muted">
                  {getTrait(unit.origin).name} · {getTrait(unit.role).name} — <b>{unit.ability.name}</b>: {unit.ability.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
