import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { botMove } from '../../games/hero/bots';
import { replay, type HeroState } from '../../games/hero/state';
import { BOT_COUNT } from '../../games/hero/stats';
import { BOT_PLAYERS, botLevel, useHeroStore, type BotFight } from '../../heroStore';
import { useGameStore } from '../../store';
import { Fight } from './Fight';

/** How long a turn's result stays up before the bot plays. */
const BOT_DELAY_MS = 1600;

/** A fight against one bot level, saved move by move, so it reopens where it was left. */
export function HeroFight() {
  const fight = useHeroStore((s) => s.fight);
  // The fight just ended: kept here so the result shows once (the store has moved on).
  const [ended, setEnded] = useState<{ fight: BotFight; points: number } | null>(null);
  const shown = fight ?? ended?.fight;
  if (!shown) return <Navigate to="/hero" replace />;
  return <BotFightView key={shown.seed} fight={shown} ended={ended} onEnd={setEnded} />;
}

function BotFightView({
  fight,
  ended,
  onEnd,
}: {
  fight: BotFight;
  ended: { fight: BotFight; points: number } | null;
  onEnd: (ended: { fight: BotFight; points: number } | null) => void;
}) {
  const navigate = useNavigate();
  const play = useHeroStore((s) => s.play);
  const endFight = useHeroStore((s) => s.endFight);
  const startFight = useHeroStore((s) => s.startFight);
  const quitFight = useHeroStore((s) => s.quitFight);
  const cleared = useHeroStore((s) => s.cleared);
  const name = useGameStore((s) => s.player?.displayName ?? 'You');
  const bot = botLevel(fight.level);
  const state: HeroState = useMemo(
    () => replay(fight.seed, [{ name, tree: fight.tree }, { name: bot.name, tree: bot.tree }], BOT_PLAYERS, fight.moves),
    [fight, bot, name],
  );

  // The bot's turn: let the last result sink in, then play.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (state.winner !== null || state.turn !== 1) return;
    timer.current = setTimeout(() => play('bot', botMove(state, 1, bot)), state.log.length ? BOT_DELAY_MS : 700);
    return () => clearTimeout(timer.current);
  }, [state, bot, play]);

  // Over: count it once, after the last hit has shown.
  useEffect(() => {
    if (state.winner === null || ended) return;
    const t = setTimeout(() => onEnd({ fight, points: endFight(state.winner === 0) }), 1200);
    return () => clearTimeout(t);
  }, [state.winner, ended, fight, endFight, onEnd]);

  const again = (level: number) => {
    onEnd(null);
    startFight(level);
  };

  const won = state.winner === 0;
  return (
    <Page title={`Level ${fight.level}${bot.boss ? ' · Boss' : ''}`} back="/hero">
      <Fight state={state} me={0} names={[name, bot.name]} onMove={(move) => play('me', move)} waiting={`${bot.name} is thinking…`}>
        {ended && (
          <div className="overlay">
            <div className="panel" role="dialog" aria-label="Fight over">
              <p className="solved-title">{won ? 'Victory' : 'Defeated'}</p>
              <p className="hero-result">{won ? `You beat ${bot.name}` : `${bot.name} wins this time`}</p>
              {ended.points > 0 && <p className="hero-reward">+{ended.points} skill {ended.points === 1 ? 'point' : 'points'}</p>}
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
              <Link className="button ghost" to="/hero">
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
            navigate('/hero');
          }}
        >
          Give up this fight
        </button>
      )}
    </Page>
  );
}
