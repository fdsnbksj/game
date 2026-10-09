import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { botFighter } from '../../games/hero/bots';
import { replay, type HeroState } from '../../games/hero/state';
import { BOT_COUNT, heroLevel } from '../../games/hero/stats';
import { BOT_PLAYERS, botLevel, useHeroStore, type BotFight } from '../../heroStore';
import { useGameStore } from '../../store';
import { useWardrobeStore } from '../../wardrobeStore';
import { ResultTitle } from './ResultTitle';
import { Fight, turnShowMs, useBotTurn } from './Fight';

interface Ended {
  fight: BotFight;
  points: number;
  gems: number;
}

/** A fight against one bot level, saved move by move, so it reopens where it was left. */
export function HeroFight() {
  const fight = useHeroStore((s) => s.fight);
  // The fight just ended: kept here so the result shows once (the store has moved on).
  const [ended, setEnded] = useState<Ended | null>(null);
  const shown = fight ?? ended?.fight;
  if (!shown) return <Navigate to="/" replace />;
  return <BotFightView key={shown.seed} fight={shown} ended={ended} onEnd={setEnded} />;
}

function BotFightView({
  fight,
  ended,
  onEnd,
}: {
  fight: BotFight;
  ended: Ended | null;
  onEnd: (ended: Ended | null) => void;
}) {
  const navigate = useNavigate();
  const play = useHeroStore((s) => s.play);
  const endFight = useHeroStore((s) => s.endFight);
  const startFight = useHeroStore((s) => s.startFight);
  const quitFight = useHeroStore((s) => s.quitFight);
  const cleared = useHeroStore((s) => s.cleared);
  const name = useGameStore((s) => s.player?.displayName ?? 'You');
  const bot = botLevel(fight.level);
  const lookNow = useWardrobeStore((s) => s.look);
  const look = useMemo(() => ({ look: lookNow, costume: fight.costume ?? null }), [lookNow, fight.costume]);
  const state: HeroState = useMemo(
    () => replay(fight.seed, [{ name, tree: fight.tree, loadout: fight.loadout, costume: fight.costume }, botFighter(bot)], BOT_PLAYERS, fight.moves),
    [fight, bot, name],
  );

  useBotTurn(state, bot.spread, (move) => play('bot', move));

  // Over: count it once, after the last hit has shown.
  useEffect(() => {
    if (state.winner === null || ended) return;
    const t = setTimeout(() => onEnd({ fight, ...endFight(state.winner === 0) }), turnShowMs(state) + 400);
    return () => clearTimeout(t);
  }, [state.winner, ended, fight, endFight, onEnd]);

  const again = (level: number) => {
    onEnd(null);
    startFight(level);
  };

  const won = state.winner === 0;
  return (
    <Page title={`Level ${fight.level}${bot.boss ? ' · Boss' : ''}`} back="/">
      <Fight
        state={state}
        me={0}
        names={[name, bot.name]}
        levels={[heroLevel(fight.tree), bot.level]}
        foe={{ kind: 'creature', family: bot.kit.family, level: bot.level, boss: bot.boss }}
        look={look}
        onMove={(move) => play('me', move)} waiting={`${bot.name} is thinking…`}>
        {ended && (
          <div className="overlay">
            <div className="panel" role="dialog" aria-label="Fight over">
              <ResultTitle won={won} n={fight.moves.length} />
              <p className="hero-result">{won ? `You beat ${bot.name}` : `${bot.name} wins this time`}</p>
              {(ended.points > 0 || ended.gems > 0) && (
                <p className="hero-reward">
                  {[ended.points > 0 && `+${ended.points} skill ${ended.points === 1 ? 'point' : 'points'}`, ended.gems > 0 && `+${ended.gems} gems`].filter(Boolean).join(' · ')}
                </p>
              )}
              {won && ended.points > 0 ? (
                <Link className="button primary" to="/hero/tree">
                  Spend in the skill tree
                </Link>
              ) : won && fight.level < BOT_COUNT && fight.level <= cleared ? (
                <button className="button primary" onClick={() => again(Math.min(BOT_COUNT, cleared + 1))}>
                  Next level
                </button>
              ) : (
                <button className="button primary" onClick={() => again(fight.level)}>
                  {won ? 'Fight again' : 'Try again'}
                </button>
              )}
              {won && ended.points > 0 && fight.level < BOT_COUNT && (
                <button className="button" onClick={() => again(fight.level + 1)}>
                  Next level
                </button>
              )}
              <Link className="button ghost" to="/">
                Back to your hero
              </Link>
            </div>
          </div>
        )}
      </Fight>
      {!ended && state.winner === null && (
        <button
          className="button ghost hero-quit"
          onClick={() => {
            quitFight();
            navigate("/");
          }}
        >
          Give up this fight
        </button>
      )}
    </Page>
  );
}
