import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { ARENA_UNLOCK, START_RATING, tierOf } from '../../games/hero/arena';
import { BOT_LEVELS } from '../../games/hero/bots';
import { CreatureThumb } from './Sprites';
import { BOT_COUNT, heroLevel, rewardFor, SKILLS, statsOf } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useGameStore } from '../../store';
import { SkillIcon } from './Fight';

/** Hero Gambit's front door: your hero, the next bot to beat, and the way to the tree. */
export function HeroHome() {
  const navigate = useNavigate();
  const name = useGameStore((s) => s.player?.displayName ?? 'Traveller');
  const tree = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const fight = useHeroStore((s) => s.fight);
  const unspent = useHeroStore((s) => s.unspent());
  const startFight = useHeroStore((s) => s.startFight);
  const arenaOpen = useHeroStore((s) => s.arenaOpen());
  const rating = useHeroStore((s) => s.arena?.rating ?? START_RATING);
  const stats = statsOf(tree);
  const next = Math.min(BOT_COUNT, cleared + 1);
  const nextBot = BOT_LEVELS[next - 1];

  const fightLevel = (level: number) => {
    startFight(level);
    navigate('/hero/fight');
  };

  return (
    <Page title="Hero Gambit" back="/zone/arena">
      <section className="hero-card frame">
        <div className="hero-who">
          <span className="hero-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{name}</strong>
            <small className="micro">Hero Lv {heroLevel(tree)}</small>
          </span>
        </div>
        <div className="hero-stats">
          <Stat label="HP" value={stats.hp} />
          <Stat label="DEF" value={stats.def} />
          <Stat label="Crit" value={`${stats.crit}%`} />
          <Stat label="Crit dmg" value={`${stats.critDmg}%`} />
        </div>
        <div className="hero-skill-row">
          {SKILLS.map((s) => (
            <span key={s} className={`hero-skill-chip${tree[s] ? '' : ' locked'}`}>
              <SkillIcon skill={s} />
              {tree[s] ? `Lv ${tree[s]}` : 'Locked'}
            </span>
          ))}
        </div>
      </section>

      <div className="front-door">
        {fight ? (
          <Link className="button primary" to="/hero/fight">
            Continue fight · {BOT_LEVELS[fight.level - 1].name}
          </Link>
        ) : (
          <button className="button primary" onClick={() => fightLevel(next)}>
            {cleared >= BOT_COUNT ? `Fight ${nextBot.name} again` : `Fight level ${next} · ${nextBot.name}`}
          </button>
        )}
        <Link className="button" to="/hero/tree">
          Skill tree{unspent > 0 && <span className="hero-badge">{unspent}</span>}
        </Link>
        <Link className="button" to="/hero/arena">
          {arenaOpen ? `Arena · ${tierOf(rating)} ${rating}` : `Arena · unlocks at level ${ARENA_UNLOCK}`}
        </Link>
        <Link className="button" to="/hero/online">
          Play a friend
        </Link>
        <SummaryRow label="Bot ladder" figures={`${cleared} / ${BOT_COUNT}`} title="Bot ladder">
          <ol className="group hero-ladder">
            {BOT_LEVELS.map((bot) => {
              const open = bot.level <= cleared + 1;
              return (
                <li key={bot.level}>
                  <button className={`row${bot.level <= cleared ? ' done' : ''}`} disabled={!open || !!fight} onClick={() => fightLevel(bot.level)}>
                    <span className="hero-ladder-name">
                      <CreatureThumb family={bot.kit.family} level={bot.level} boss={bot.boss} />
                      {bot.level}. {bot.name}
                      {bot.boss && <span className="hero-boss">Boss</span>}
                    </span>
                    <span className="row-detail">{bot.level <= cleared ? 'Cleared' : `+${rewardFor(bot.level)} pts`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </SummaryRow>
        <SummaryRow label="How to play" title="How to play Hero Gambit">
          <div className="how-to">
            <p>Take turns using one skill each. Bring the other side's HP to 0 to win.</p>
            <p>
              <strong>Stopwatch:</strong> you're shown a time between 1.00 and 10.00 seconds, like 4.37. Press Start, count, press Stop. The closer you are, the harder the hit. Within 0.05 s is Perfect: a sure crit.
            </p>
            <p>
              <strong>Roulette:</strong> pick a number from 0 to 36. Each level adds a ball. If any ball lands on your number, it's an instant kill; if not, you punch.
            </p>
            <p>
              <strong>Poker:</strong> you each draw a card, 2 low to A high. Higher card hits for 100 as a crit; lower does nothing.
            </p>
            <p>
              <strong>The bot ladder</strong> is twenty creatures. They don't use skills: they hit, drain, burn you, weaken your hits, hide your stopwatch clock in smoke, raise their guard or wind up a big one. Bosses have a finisher and get enraged below half HP.
            </p>
            <p>Beat a bot level for the first time to earn skill points, then spend them in the skill tree on skills, HP, DEF, Crit and Crit damage.</p>
          </div>
        </SummaryRow>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="hero-stat">
      <small className="micro">{label}</small>
      <strong>{value}</strong>
    </span>
  );
}
