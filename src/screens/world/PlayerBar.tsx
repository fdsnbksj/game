import { Link } from 'react-router';
import { heroLevel } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useGameStore } from '../../store';
import { useWardrobeStore } from '../../wardrobeStore';
import { HeroFigure } from '../hero/Avatar';
import { GemIcon } from '../hero/Summon';

/** Who you are, along the top: your hero's face, your name, its level, your gems, and settings. */
export function PlayerBar() {
  const name = useGameStore((s) => s.player?.displayName);
  const hero = useHeroStore((s) => heroLevel(s.tree));
  const gems = useWardrobeStore((s) => s.gems);
  const look = useWardrobeStore((s) => s.look);
  const costume = useWardrobeStore((s) => s.costume);
  return (
    <header className="player-bar">
      <Link className="player-avatar" to="/account" aria-label="Your account">
        <HeroFigure appearance={{ look, costume }} className="player-face" />
      </Link>
      <div className="player-who">
        <strong>{name ?? 'Traveller'}</strong>
        <span className="player-chips">
          <span className="player-chip hero" title="Hero level">
            Hero {hero}
          </span>
          <span className="player-chip gems" title="Gems">
            <GemIcon />
            {gems}
          </span>
        </span>
      </div>
      <Link className="icon-button" to="/settings" aria-label="Settings">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm8-3.2-.02-.66 1.9-1.5-1.8-3.1-2.3.8a7.6 7.6 0 0 0-1.14-.66L16.3 4.4h-3.6l-.36 2.4c-.4.18-.78.4-1.14.66l-2.3-.8-1.8 3.1 1.9 1.5L9 12l.02.66-1.9 1.5 1.8 3.1 2.3-.8c.36.26.74.48 1.14.66l.36 2.4h3.6l.36-2.4c.4-.18.78-.4 1.14-.66l2.3.8 1.8-3.1-1.9-1.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </header>
  );
}
