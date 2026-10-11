import { Link } from 'react-router';
import { heroLevel } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useGameStore } from '../../store';

/** Along the top: your hero's level on the left, your profile (your name) on the right. */
export function PlayerBar() {
  const name = useGameStore((s) => s.player?.displayName);
  const hero = useHeroStore((s) => heroLevel(s.tree));
  return (
    <header className="player-bar">
      <span className="player-chip" title="Hero level">
        Lv {hero}
      </span>
      <Link className="player-me" to="/account" aria-label="Your profile">
        {name ?? 'Traveller'}
      </Link>
    </header>
  );
}
