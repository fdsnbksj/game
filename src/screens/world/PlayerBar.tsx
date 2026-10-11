import { Link } from 'react-router';
import { useGameStore } from '../../store';

/** Along the top: your profile (your name) on the right. */
export function PlayerBar() {
  const name = useGameStore((s) => s.player?.displayName);
  return (
    <header className="player-bar">
      <span />
      <Link className="player-me" to="/account" aria-label="Your profile">
        {name ?? 'Traveller'}
      </Link>
    </header>
  );
}
