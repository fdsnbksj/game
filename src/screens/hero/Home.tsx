import { Link, useNavigate } from 'react-router';
import { SummaryRow } from '../../components/SummaryRow';
import { BOT_LEVELS } from '../../games/hero/bots';
import { BOT_COUNT, rewardFor, statsOf } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { Stickman } from './Stickman';

// Home is Hero Gambit (the other games are hidden for now), kept plain: your stick figure
// and its stats, the next bot fight, the skill tree and a friend. The ladder and the rules
// fold away.

export function Home() {
  const navigate = useNavigate();
  const tree = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const fight = useHeroStore((s) => s.fight);
  const unspent = useHeroStore((s) => s.unspent());
  const startFight = useHeroStore((s) => s.startFight);
  const stats = statsOf(tree);
  const next = Math.min(BOT_COUNT, cleared + 1);
  const nextBot = BOT_LEVELS[next - 1];

  const fightLevel = (level: number) => {
    startFight(level);
    navigate('/hero/fight');
  };

  return (
    <main className="screen home">
      <section className="home-hero">
        <Stickman />
        <p className="home-stats">
          HP {stats.hp} · DEF {stats.def} · Crit {stats.crit}% · Crit dmg {stats.critDmg}%
        </p>
      </section>

      {fight ? (
        <Link className="button primary" to="/hero/fight">
          Back to the fight
        </Link>
      ) : (
        <button className="button primary" onClick={() => fightLevel(next)}>
          Fight level {next}: {nextBot.name}
          {cleared >= BOT_COUNT && ' (again)'}
        </button>
      )}
      <Link className="button" to="/hero/tree">
        Skill tree{unspent > 0 && ` · ${unspent} ${unspent === 1 ? 'point' : 'points'} to spend`}
      </Link>
      <Link className="button" to="/hero/online">
        Vs a friend
      </Link>

      <div className="home-more">
        <SummaryRow label="Bot ladder" figures={`${cleared} / ${BOT_COUNT}`} title="Bot ladder">
          <ol className="group">
            {BOT_LEVELS.map((bot) => {
              const open = bot.level <= cleared + 1;
              const done = bot.level <= cleared;
              return (
                <li key={bot.level}>
                  <button className="row ladder-row" disabled={!open || !!fight} onClick={() => fightLevel(bot.level)}>
                    <span>
                      {bot.level}. {open ? bot.name : '???'}
                      {bot.boss && ' (boss)'}
                    </span>
                    <span className="row-detail">{done ? 'Cleared' : open ? `+${rewardFor(bot.level)} ${rewardFor(bot.level) === 1 ? 'point' : 'points'}` : 'Locked'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </SummaryRow>
        <SummaryRow label="How to play" title="How to play Hero Gambit">
          <div className="how-to">
            <p>Take turns using one skill from your loadout (up to four). After you use a skill it rests a few turns: Stopwatch never, I'm Speed 1, Poker 2, Roulette 3. Bring the other side's HP to 0 to win.</p>
            <p>
              <strong>Stopwatch:</strong> you're shown a time between 1.00 and 10.00 seconds, like 4.37. Press Start, count, press Stop. The closer you are, the harder the hit. Within 0.05 s is Perfect: a sure crit.
            </p>
            <p>
              <strong>I'm Speed</strong> (opens at Stopwatch 5): tap Ready, wait for the light to turn green, then tap. The faster, the harder; 0.15 s or less is a sure crit. Tap on red and you miss.
            </p>
            <p>
              <strong>Roulette:</strong> pick a number from 0 to 36. You start with one ball and get another at levels 5 and 10 (three at most); the other levels make your punch harder. If any ball lands on your number, it's an instant kill; if not, you punch.
            </p>
            <p>
              <strong>Poker:</strong> you each pick a face-down card, 2 low to A high. Higher card hits for 100 as a crit; lower does nothing.
            </p>
            <p>
              <strong>The bot ladder</strong> is twenty bots. They don't use skills: they hit, drain, burn you, weaken your hits, hide your stopwatch clock in smoke, raise their guard or wind up a big one. Every fifth is a boss, with a finisher, enraged below half HP.
            </p>
            <p>
              Beat a bot level for the first time for a skill point (2 for a boss), then spend them in the skill tree. A skill costs 5 to unlock, then 1 for level 2, 2 for level 3 and so on; a stat's level N costs N. I'm Speed opens at Stopwatch 5, Roulette at Poker 5. A reset costs 1 point, then a point more each time.
            </p>
          </div>
        </SummaryRow>
      </div>
    </main>
  );
}
