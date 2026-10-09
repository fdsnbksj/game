import { Link } from 'react-router';
import { heroLevel } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useGameStore } from '../../store';
import { useWardrobeStore } from '../../wardrobeStore';
import { HeroFigure } from '../hero/Avatar';
import { GemIcon } from '../hero/Summon';

/** Along the top: your hero's level and gems on the left, your profile (name and face) on the right. */
export function PlayerBar() {
  const name = useGameStore((s) => s.player?.displayName);
  const hero = useHeroStore((s) => heroLevel(s.tree));
  const gems = useWardrobeStore((s) => s.gems);
  const look = useWardrobeStore((s) => s.look);
  const costume = useWardrobeStore((s) => s.costume);
  return (
    <header className="player-bar">
      <span className="player-chips">
        <span className="player-chip hero" title="Hero level">
          Lv {hero}
        </span>
        <Link className="player-chip gems" to="/hero/summon" title="Gems">
          <GemIcon />
          {gems}
        </Link>
      </span>
      <Link className="player-me" to="/account" aria-label="Your profile">
        <strong>{name ?? 'Traveller'}</strong>
        <span className="player-avatar">
          <HeroFigure appearance={{ look, costume }} className="player-face" />
        </span>
      </Link>
    </header>
  );
}
