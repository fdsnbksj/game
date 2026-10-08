import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { DEFENDER_SPREAD, tierOf } from '../../games/hero/arena';
import { replay, type HeroState } from '../../games/hero/state';
import { BOT_PLAYERS, useHeroStore, type ArenaFight as Saved } from '../../heroStore';
import { useGameStore } from '../../store';
import { Fight, useBotTurn } from './Fight';

interface Ended {
  fight: Saved;
  won: boolean;
  delta: number;
  rating: number;
}

/** A fight against another player's hero, saved move by move like a bot fight. */
export function ArenaFight() {
  const fight = useHeroStore((s) => s.arenaFight);
  const [ended, setEnded] = useState<Ended | null>(null);
  const shown = fight ?? ended?.fight;
  if (!shown) return <Navigate to="/hero/arena" replace />;
  return <ArenaFightView key={shown.seed} fight={shown} ended={ended} onEnd={setEnded} />;
}

function ArenaFightView({ fight, ended, onEnd }: { fight: Saved; ended: Ended | null; onEnd: (ended: Ended) => void }) {
  const navigate = useNavigate();
  const playArena = useHeroStore((s) => s.playArena);
  const endArenaFight = useHeroStore((s) => s.endArenaFight);
  const name = useGameStore((s) => s.player?.displayName ?? 'You');
  const foe = fight.opponent;
  const state: HeroState = useMemo(
    () => replay(fight.seed, [{ name, tree: fight.tree }, { name: foe.name, tree: foe.tree }], BOT_PLAYERS, fight.moves),
    [fight, foe, name],
  );

  useBotTurn(state, DEFENDER_SPREAD, (move) => playArena('bot', move));

  const finish = (won: boolean) => {
    const delta = endArenaFight(won);
    onEnd({ fight, won, delta, rating: useHeroStore.getState().arena?.rating ?? 0 });
  };

  // Over: count it once, after the last hit has shown.
  useEffect(() => {
    if (state.winner === null || ended) return;
    const t = setTimeout(() => finish(state.winner === 0), 1200);
    return () => clearTimeout(t);
    // finish is remade each render; the winner is what matters.
  }, [state.winner, ended]);

  return (
    <Page title={`Arena · ${foe.name}`} back="/hero/arena">
      <Fight state={state} me={0} names={[name, foe.name]} onMove={(move) => playArena('me', move)} waiting={`${foe.name} is choosing…`}>
        {ended && (
          <div className="overlay">
            <div className="panel" role="dialog" aria-label="Fight over">
              <p className="solved-title">{ended.won ? 'Victory' : 'Defeated'}</p>
              <p className="hero-result">{ended.won ? `You beat ${foe.name}` : `${foe.name} wins`}</p>
              <p className={`hero-reward${ended.delta < 0 ? ' down' : ''}`}>
                {ended.delta > 0 ? '+' : ''}
                {ended.delta} · {ended.rating} {tierOf(ended.rating)}
              </p>
              <Link className="button primary" to="/hero/arena">
                Fight again
              </Link>
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
            finish(false);
            navigate('/hero/arena');
          }}
        >
          Give up (counts as a loss)
        </button>
      )}
    </Page>
  );
}
