import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { ARENA_UNLOCK, pickOpponent, START_RATING, tierOf, type ArenaHero } from '../../games/hero/arena';
import { BOT_LEVELS, sparringTree } from '../../games/hero/bots';
import { costumeOf } from '../../games/hero/costumes';
import { PLAIN } from '../../games/hero/look';
import { heroLevel, statsOf } from '../../games/hero/stats';
import { HeroFigure } from './Avatar';
import { useHeroStore } from '../../heroStore';
import { findOpponents } from '../../services/arena';
import { useGameStore } from '../../store';

/** Wider and wider, until someone turns up. */
const SPANS = [150, 400, null];

const newSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join('');

/** While the arena is empty (or offline), a bot-ladder hero near your level stands in. */
function sparring(cleared: number, seed: string): ArenaHero {
  const bot = BOT_LEVELS[Math.min(BOT_LEVELS.length - 1, Math.max(0, cleared - 1))];
  return { uid: `bot:${bot.level}:${seed}`, name: bot.name, tree: sparringTree(bot.level), rating: START_RATING, sparring: true };
}

/** The arena's front door: your standing, then an opponent to take on. */
export function Arena() {
  const navigate = useNavigate();
  const uid = useGameStore((s) => s.uid);
  const open = useHeroStore((s) => s.arenaOpen());
  const cleared = useHeroStore((s) => s.cleared);
  const arena = useHeroStore((s) => s.arena);
  const fight = useHeroStore((s) => s.arenaFight);
  const startArenaFight = useHeroStore((s) => s.startArenaFight);
  const [opponent, setOpponent] = useState<ArenaHero | null>(null);
  const [busy, setBusy] = useState(false);
  const rating = arena?.rating ?? START_RATING;

  const find = async () => {
    setBusy(true);
    const seed = newSeed();
    let found: ArenaHero | null = null;
    try {
      for (const span of SPANS) {
        found = pickOpponent(await findOpponents(rating, span), uid ?? '', seed);
        if (found) break;
      }
    } catch {
      // Offline: spar instead.
    }
    setOpponent(found ?? sparring(cleared, seed));
    setBusy(false);
  };

  if (!open) {
    return (
      <Page title="Arena" back="/">
        <section className="hero-card frame arena-card">
          <span className="micro">Locked</span>
          <strong className="arena-rating">Level {ARENA_UNLOCK}</strong>
          <p className="note center-note">Beat bot level {ARENA_UNLOCK} to enter the arena and fight other players' heroes.</p>
        </section>
        <Link className="button" to="/">
          Back to your hero
        </Link>
      </Page>
    );
  }

  return (
    <Page title="Arena" back="/">
      <section className="hero-card frame arena-card">
        <span className={`arena-tier ${tierOf(rating).toLowerCase()}`}>{tierOf(rating)}</span>
        <strong className="arena-rating">{rating}</strong>
        <span className="note">
          {arena?.wins ?? 0} won · {arena?.losses ?? 0} lost
        </span>
      </section>

      {opponent && !fight && <OpponentCard hero={opponent} mine={rating} />}

      <div className="front-door">
        {fight ? (
          <Link className="button primary" to="/hero/arena/fight">
            Continue fight · {fight.opponent.name}
          </Link>
        ) : opponent ? (
          <>
            <button
              className="button primary"
              onClick={() => {
                startArenaFight(opponent);
                navigate('/hero/arena/fight');
              }}
            >
              Fight {opponent.name}
            </button>
            <button className="button" disabled={busy} onClick={() => void find()}>
              Find another
            </button>
          </>
        ) : (
          <button className="button primary" disabled={busy} onClick={() => void find()}>
            {busy ? 'Looking…' : 'Find an opponent'}
          </button>
        )}
        <SummaryRow label="How the arena works" title="The arena">
          <div className="how-to">
            <p>Fight other players' heroes, as they've built them. While their owners are away, the heroes fight on their own.</p>
            <p>Win to raise your rating, more for beating a higher-rated hero; lose and it drops. Giving up counts as a loss.</p>
            <p>Tiers: Bronze, Silver from 1100, Gold from 1250, Platinum from 1400, Diamond from 1600. The arena gives no skill points; those come from the bot ladder.</p>
          </div>
        </SummaryRow>
      </div>
    </Page>
  );
}

function OpponentCard({ hero, mine }: { hero: ArenaHero; mine: number }) {
  const stats = statsOf(hero.tree, costumeOf(hero.appearance?.costume)?.bonus);
  const diff = hero.rating - mine;
  return (
    <section className="arena-opponent frame">
      <div className="hero-who">
        <HeroFigure appearance={hero.appearance ?? PLAIN} className="arena-figure" />
        <span>
          <strong>{hero.name}</strong>
          <small className="micro">
            {hero.sparring ? 'Sparring' : `${tierOf(hero.rating)} · ${hero.rating}${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}`} · Hero Lv {heroLevel(hero.tree)}
          </small>
        </span>
      </div>
      <div className="hero-stats">
        <span className="hero-stat">
          <small className="micro">HP</small>
          <strong>{stats.hp}</strong>
        </span>
        <span className="hero-stat">
          <small className="micro">DEF</small>
          <strong>{stats.def}</strong>
        </span>
        <span className="hero-stat">
          <small className="micro">Crit</small>
          <strong>{stats.crit}%</strong>
        </span>
        <span className="hero-stat">
          <small className="micro">Skills</small>
          <strong>
            {hero.tree.stopwatch}/{hero.tree.speed}/{hero.tree.poker}/{hero.tree.roulette}
          </strong>
        </span>
      </div>
    </section>
  );
}
