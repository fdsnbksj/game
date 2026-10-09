import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { SummaryRow } from '../../components/SummaryRow';
import { ARENA_UNLOCK, START_RATING, tierOf } from '../../games/hero/arena';
import { BOT_LEVELS } from '../../games/hero/bots';
import { costumeOf } from '../../games/hero/costumes';
import { BOT_COUNT, heroLevel, rewardFor, statsOf } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useGameStore } from '../../store';
import { useWardrobeStore } from '../../wardrobeStore';
import { HeroFigure } from './Avatar';
import { CreatureThumb } from './Sprites';

// Home is Hero Gambit (the other games are hidden for now): your hero standing large, the
// next fight under the thumb, and round buttons to the tree, the wardrobe, Summon, the
// arena and a friend. The ladder and the rules fold away.

export function Home() {
  const navigate = useNavigate();
  const name = useGameStore((s) => s.player?.displayName ?? 'Traveller');
  const tree = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const fight = useHeroStore((s) => s.fight);
  const unspent = useHeroStore((s) => s.unspent());
  const startFight = useHeroStore((s) => s.startFight);
  const arenaOpen = useHeroStore((s) => s.arenaOpen());
  const rating = useHeroStore((s) => s.arena?.rating ?? START_RATING);
  const look = useWardrobeStore((s) => s.look);
  const costumeId = useWardrobeStore((s) => s.costume);
  const free = useWardrobeStore((s) => s.freeReady());
  const costume = costumeOf(costumeId);
  const stats = statsOf(tree, costume?.bonus);
  const next = Math.min(BOT_COUNT, cleared + 1);
  const nextBot = BOT_LEVELS[next - 1];

  const fightLevel = (level: number) => {
    startFight(level);
    navigate('/hero/fight');
  };

  return (
    <main className="screen home">
      <section className="home-stage">
        <span className="home-glow" />
        <span className="battle-platform home-platform" />
        <Link to="/hero/wardrobe" className="home-figure" aria-label="Change your look">
          <HeroFigure appearance={{ look, costume: costumeId }} />
        </Link>
      </section>

      <div className="home-plate">
        <strong>{name}</strong>
        <span className="home-chips">
          <span className="player-chip hero">Lv {heroLevel(tree)}</span>
          {arenaOpen && <span className="player-chip">{tierOf(rating)}</span>}
          {costume && <span className={`player-chip rarity-${costume.rarity}`}>{costume.name}</span>}
        </span>
        <span className="home-stats">
          <span>HP {stats.hp}</span>
          <span>DEF {stats.def}</span>
          <span>Crit {stats.crit}%</span>
          <span>Crit dmg {stats.critDmg}%</span>
        </span>
      </div>

      {fight ? (
        <Link className="button primary home-go" to="/hero/fight">
          Continue fight · {BOT_LEVELS[fight.level - 1].name}
        </Link>
      ) : (
        <button className="button primary home-go" onClick={() => fightLevel(next)}>
          {cleared >= BOT_COUNT ? `Fight ${nextBot.name} again` : `Fight level ${next} · ${nextBot.name}`}
        </button>
      )}

      <nav className="home-actions" aria-label="Your hero">
        <Round to="/hero/tree" label="Skills" badge={unspent > 0 ? String(unspent) : null}>
          <path d="M12 3v6M12 9l-6 5M12 9l6 5M6 14v5M18 14v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="3.5" r="2" fill="currentColor" />
          <circle cx="6" cy="19.5" r="2" fill="currentColor" />
          <circle cx="18" cy="19.5" r="2" fill="currentColor" />
        </Round>
        <Round to="/hero/wardrobe" label="Wardrobe">
          <path d="M9 4l3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </Round>
        <Round to="/hero/summon" label="Summon" badge={free ? 'Free' : null}>
          <circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 13h14M12 3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="13" r="2" fill="currentColor" />
        </Round>
        <Round to="/hero/arena" label={arenaOpen ? 'Arena' : `Arena · ${ARENA_UNLOCK}`} dim={!arenaOpen}>
          <path d="M5 19L17 7M17 7h-4M17 7v4M19 19L7 7M7 7h4M7 7v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </Round>
        <Round to="/hero/online" label="Friend">
          <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15c2.6-.4 4.6.8 5.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </Round>
      </nav>

      <div className="home-more">
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
            <p>
              <strong>Gems</strong> come from every win. Spend them in Summon on meme costumes (each with a small stat bonus) and rare parts for your look; there's a free pull every day.
            </p>
          </div>
        </SummaryRow>
      </div>
    </main>
  );
}

function Round({ to, label, badge = null, dim = false, children }: { to: string; label: string; badge?: string | null; dim?: boolean; children: ReactNode }) {
  return (
    <Link className={`home-round${dim ? ' dim' : ''}`} to={to}>
      <span className="home-round-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          {children}
        </svg>
        {badge && <span className="hero-badge">{badge}</span>}
      </span>
      <small>{label}</small>
    </Link>
  );
}
